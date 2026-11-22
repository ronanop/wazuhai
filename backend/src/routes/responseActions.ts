import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { writeAudit } from "../lib/audit.js";
import { ensureChatbotSettings } from "../ai/settingsService.js";
import { ensurePlaybooks } from "../soar/ensurePlaybooks.js";
import {
  countActionsToday,
  executeResponseAction,
  notifyActionStakeholders,
} from "../soar/actionExecutor.js";

const router = Router();

const proposeSchema = z.object({
  playbookKey: z.string().min(1).max(80),
  rationale: z.string().min(3).max(4000),
  dryRun: z.boolean().optional(),
  targetType: z.string().max(40).nullish(),
  targetId: z.string().max(120).nullish(),
  targetLabel: z.string().max(240).nullish(),
  agentId: z.string().max(40).nullish(),
  agentName: z.string().max(120).nullish(),
  incidentId: z.string().max(40).nullish(),
  params: z.record(z.unknown()).nullish(),
});

router.get("/", requireAuth, async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : "";
  const incidentId = typeof req.query.incidentId === "string" ? req.query.incidentId : "";
  const agent = typeof req.query.agent === "string" ? req.query.agent.trim() : "";
  const from = typeof req.query.from === "string" ? req.query.from.trim() : "";
  const to = typeof req.query.to === "string" ? req.query.to.trim() : "";
  const sortDir = String(req.query.sort ?? "").toLowerCase() === "asc" ? "asc" : "desc";
  const actions = await prisma.responseAction.findMany({
    where: {
      ...(status ? { status: status as never } : {}),
      ...(incidentId ? { incidentId } : {}),
      ...(agent
        ? {
            OR: [
              { agentName: { contains: agent, mode: "insensitive" } },
              { agentId: { contains: agent, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    },
    include: {
      proposedBy: { select: { id: true, name: true, email: true } },
      reviewedBy: { select: { id: true, name: true, email: true } },
      playbook: true,
    },
    orderBy: { createdAt: sortDir },
    take: 100,
  });
  return res.json({ actions });
});

router.get("/:id", requireAuth, async (req, res) => {
  const action = await prisma.responseAction.findUnique({
    where: { id: req.params.id },
    include: {
      proposedBy: { select: { id: true, name: true, email: true } },
      reviewedBy: { select: { id: true, name: true, email: true } },
      playbook: true,
    },
  });
  if (!action) return res.status(404).json({ error: "Action not found" });
  return res.json({ action });
});

router.post("/", requireAuth, async (req, res) => {
  const parsed = proposeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid action payload" });

  const settings = await ensureChatbotSettings();
  if (!settings.toolsEnabled) {
    return res.status(403).json({ error: "SOAR tools are disabled in settings" });
  }

  const used = await countActionsToday(req.user!.id);
  if (used >= settings.maxActionsPerDay) {
    return res.status(429).json({ error: `Daily action limit reached (${settings.maxActionsPerDay})` });
  }

  await ensurePlaybooks();
  const playbook = await prisma.playbook.findUnique({ where: { key: parsed.data.playbookKey } });
  if (!playbook || !playbook.enabled) {
    return res.status(404).json({ error: "Playbook not found" });
  }

  if (playbook.actionType === "wazuh_active_response" && !settings.activeResponseEnabled) {
    // still allow propose as dry-run recommendation path
  }

  const dryRun = parsed.data.dryRun ?? settings.dryRunDefault;
  const action = await prisma.responseAction.create({
    data: {
      playbookId: playbook.id,
      playbookKey: playbook.key,
      playbookName: playbook.name,
      status: "PROPOSED",
      dryRun,
      rationale: parsed.data.rationale,
      targetType: parsed.data.targetType ?? null,
      targetId: parsed.data.targetId ?? null,
      targetLabel: parsed.data.targetLabel ?? null,
      agentId: parsed.data.agentId ?? null,
      agentName: parsed.data.agentName ?? null,
      incidentId: parsed.data.incidentId ?? null,
      params: (parsed.data.params as object | undefined) ?? undefined,
      proposedById: req.user!.id,
    },
    include: {
      proposedBy: { select: { id: true, name: true, email: true } },
      playbook: true,
    },
  });

  if (parsed.data.incidentId) {
    await prisma.incidentActivity.create({
      data: {
        incidentId: parsed.data.incidentId,
        userId: req.user!.id,
        action: "soar.proposed",
        detail: `${playbook.name} (${dryRun ? "dry-run" : "live"})`,
      },
    });
  }

  await writeAudit({
    userId: req.user!.id,
    action: "soar.action.propose",
    outcome: "success",
    meta: { actionId: action.id, playbookKey: playbook.key, dryRun },
  });

  // Auto-execute low-risk playbooks that do not require approval
  if (!playbook.requiresApproval) {
    try {
      const result = await executeResponseAction(action);
      const updated = await prisma.responseAction.update({
        where: { id: action.id },
        data: {
          status: result.status,
          result: result.result as object,
          executedAt: new Date(),
          reviewedById: req.user!.id,
          reviewedAt: new Date(),
          errorMessage: result.errorMessage,
        },
        include: {
          proposedBy: { select: { id: true, name: true, email: true } },
          reviewedBy: { select: { id: true, name: true, email: true } },
          playbook: true,
        },
      });
      await notifyActionStakeholders(updated, result.status);
      return res.status(201).json({ action: updated, autoExecuted: true });
    } catch (err) {
      const failed = await prisma.responseAction.update({
        where: { id: action.id },
        data: {
          status: "FAILED",
          errorMessage: err instanceof Error ? err.message : "Execution failed",
          executedAt: new Date(),
        },
        include: {
          proposedBy: { select: { id: true, name: true, email: true } },
          playbook: true,
        },
      });
      return res.status(201).json({ action: failed, autoExecuted: true });
    }
  }

  await notifyActionStakeholders(action, "PROPOSED");
  return res.status(201).json({ action, autoExecuted: false });
});

router.post("/:id/approve", requireAuth, requireRoles("ADMINISTRATOR"), async (req, res) => {
  const action = await prisma.responseAction.findUnique({
    where: { id: req.params.id },
    include: { playbook: true },
  });
  if (!action) return res.status(404).json({ error: "Action not found" });
  if (!["PROPOSED", "APPROVED"].includes(action.status)) {
    return res.status(400).json({ error: `Cannot approve action in status ${action.status}` });
  }

  const approved = await prisma.responseAction.update({
    where: { id: action.id },
    data: {
      status: "APPROVED",
      reviewedById: req.user!.id,
      reviewedAt: new Date(),
    },
    include: { playbook: true },
  });

  try {
    await prisma.responseAction.update({
      where: { id: action.id },
      data: { status: "EXECUTING" },
    });
    const result = await executeResponseAction(approved);
    const updated = await prisma.responseAction.update({
      where: { id: action.id },
      data: {
        status: result.status,
        result: result.result as object,
        executedAt: new Date(),
        errorMessage: result.errorMessage,
      },
      include: {
        proposedBy: { select: { id: true, name: true, email: true } },
        reviewedBy: { select: { id: true, name: true, email: true } },
        playbook: true,
      },
    });
    await writeAudit({
      userId: req.user!.id,
      action: "soar.action.approve_execute",
      outcome: "success",
      meta: { actionId: action.id, status: result.status },
    });
    await notifyActionStakeholders(updated, result.status);
    return res.json({ action: updated });
  } catch (err) {
    const failed = await prisma.responseAction.update({
      where: { id: action.id },
      data: {
        status: "FAILED",
        errorMessage: err instanceof Error ? err.message : "Execution failed",
        executedAt: new Date(),
        reviewedById: req.user!.id,
        reviewedAt: new Date(),
      },
      include: {
        proposedBy: { select: { id: true, name: true, email: true } },
        reviewedBy: { select: { id: true, name: true, email: true } },
        playbook: true,
      },
    });
    await writeAudit({
      userId: req.user!.id,
      action: "soar.action.approve_execute",
      outcome: "failure",
      meta: { actionId: action.id, error: failed.errorMessage },
    });
    await notifyActionStakeholders(failed, "FAILED");
    return res.status(502).json({ action: failed, error: failed.errorMessage });
  }
});

router.post("/:id/reject", requireAuth, requireRoles("ADMINISTRATOR"), async (req, res) => {
  const reason =
    typeof req.body?.reason === "string" && req.body.reason.trim()
      ? req.body.reason.trim()
      : "Rejected by administrator";
  const action = await prisma.responseAction.findUnique({ where: { id: req.params.id } });
  if (!action) return res.status(404).json({ error: "Action not found" });
  if (action.status !== "PROPOSED") {
    return res.status(400).json({ error: `Cannot reject action in status ${action.status}` });
  }
  const updated = await prisma.responseAction.update({
    where: { id: action.id },
    data: {
      status: "REJECTED",
      reviewedById: req.user!.id,
      reviewedAt: new Date(),
      errorMessage: reason,
    },
    include: {
      proposedBy: { select: { id: true, name: true, email: true } },
      reviewedBy: { select: { id: true, name: true, email: true } },
      playbook: true,
    },
  });
  await writeAudit({
    userId: req.user!.id,
    action: "soar.action.reject",
    outcome: "success",
    meta: { actionId: action.id, reason },
  });
  await notifyActionStakeholders(updated, "REJECTED");
  return res.json({ action: updated });
});

export default router;
