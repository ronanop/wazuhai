import type { Playbook, ResponseAction } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { ensureChatbotSettings } from "../ai/settingsService.js";
import { runActiveResponse } from "./activeResponse.js";
import { notifyUser } from "../lib/notify.js";

export async function countActionsToday(userId: string) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return prisma.responseAction.count({
    where: {
      proposedById: userId,
      createdAt: { gte: start },
    },
  });
}

export async function executeResponseAction(action: ResponseAction & { playbook: Playbook | null }) {
  const settings = await ensureChatbotSettings();
  const playbook = action.playbook;
  if (!playbook) throw new Error("Playbook missing for action");

  const dryRun = action.dryRun || settings.dryRunDefault;

  if (playbook.actionType === "recommend_only") {
    return {
      status: "SUCCEEDED" as const,
      result: {
        kind: "recommendation",
        dryRun: true,
        summary: playbook.description,
        guidance: [
          "This playbook is recommendation-only.",
          "Document the decision in the incident notes.",
          "Escalate to an approved containment workflow if needed.",
        ],
      },
      errorMessage: null as string | null,
    };
  }

  if (playbook.actionType === "create_ticket") {
    const params = (action.params as Record<string, unknown> | null) ?? {};
    const title =
      typeof params.title === "string" && params.title.trim()
        ? params.title.trim()
        : `Follow-up: ${action.targetLabel || action.playbookName}`;
    const ticket = await prisma.ticket.create({
      data: {
        title,
        description:
          typeof params.description === "string"
            ? params.description
            : `Created from SOAR playbook ${playbook.key}.\n\nRationale: ${action.rationale}`,
        priority: "HIGH",
        createdById: action.proposedById,
        incidentId: action.incidentId ?? null,
        linkedAlertId: action.targetType === "alert" ? action.targetId : null,
        linkedAgentName: action.agentName ?? null,
      },
    });
    if (action.incidentId) {
      await prisma.incidentActivity.create({
        data: {
          incidentId: action.incidentId,
          userId: action.proposedById,
          action: "soar.ticket_created",
          detail: `Ticket ${ticket.id} via ${playbook.key}`,
        },
      });
    }
    return {
      status: "SUCCEEDED" as const,
      result: { kind: "ticket", ticketId: ticket.id, title: ticket.title, dryRun: false },
      errorMessage: null,
    };
  }

  if (playbook.actionType === "update_incident_status") {
    if (!action.incidentId) throw new Error("Incident id required for status update playbook");
    const nextStatus = playbook.command;
    if (!["INVESTIGATING", "CONTAINED", "RESOLVED", "CLOSED", "OPEN"].includes(nextStatus)) {
      throw new Error(`Unsupported incident status: ${nextStatus}`);
    }
    if (dryRun) {
      return {
        status: "SUCCEEDED" as const,
        result: {
          kind: "incident_status",
          dryRun: true,
          wouldSet: nextStatus,
          incidentId: action.incidentId,
        },
        errorMessage: null,
      };
    }
    await prisma.incident.update({
      where: { id: action.incidentId },
      data: {
        status: nextStatus as "INVESTIGATING" | "CONTAINED" | "RESOLVED" | "CLOSED" | "OPEN",
        closedAt: ["RESOLVED", "CLOSED"].includes(nextStatus) ? new Date() : null,
      },
    });
    await prisma.incidentActivity.create({
      data: {
        incidentId: action.incidentId,
        userId: action.proposedById,
        action: "soar.status_update",
        detail: `Status → ${nextStatus} via ${playbook.key}`,
      },
    });
    return {
      status: "SUCCEEDED" as const,
      result: { kind: "incident_status", dryRun: false, status: nextStatus, incidentId: action.incidentId },
      errorMessage: null,
    };
  }

  if (playbook.actionType === "wazuh_active_response") {
    if (!settings.activeResponseEnabled && !dryRun) {
      throw new Error("Active response is disabled in Chatbot/SOAR settings");
    }
    const params = (action.params as Record<string, unknown> | null) ?? {};
    const argList: string[] = [];
    if (typeof params.srcip === "string" && params.srcip.trim()) argList.push(params.srcip.trim());
    if (Array.isArray(params.arguments)) {
      for (const a of params.arguments) {
        if (typeof a === "string" && a.trim()) argList.push(a.trim());
      }
    }
    const ar = await runActiveResponse({
      command: playbook.command,
      agentId: action.agentId,
      arguments: argList,
      dryRun: dryRun || !settings.activeResponseEnabled,
    });
    return {
      status: "SUCCEEDED" as const,
      result: { kind: "active_response", ...ar },
      errorMessage: null,
    };
  }

  throw new Error(`Unsupported action type: ${playbook.actionType}`);
}

export async function notifyActionStakeholders(action: ResponseAction, outcome: string) {
  try {
    const admins = await prisma.user.findMany({
      where: { role: "ADMINISTRATOR", status: "ACTIVE" },
      select: { id: true },
    });
    const targets = new Set<string>([action.proposedById, ...admins.map((a) => a.id)]);
    await Promise.all(
      [...targets].map((userId) =>
        notifyUser({
          userId,
          title: `SOAR action ${outcome}`,
          body: `${action.playbookName}: ${action.targetLabel || action.targetId || "target"}`,
          type: outcome === "SUCCEEDED" ? "success" : outcome === "REJECTED" ? "warning" : "info",
          href: "/app/response-actions",
        }),
      ),
    );
  } catch {
    // non-fatal
  }
}
