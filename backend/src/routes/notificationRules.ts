import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { writeAudit } from "../lib/audit.js";

const router = Router();

const DEFAULT_RULES = [
  {
    name: "High/critical alerts (in-app)",
    eventType: "alert_high",
    minSeverity: "high",
    channels: ["inapp"],
  },
  {
    name: "Incident created",
    eventType: "incident_created",
    minSeverity: "info",
    channels: ["inapp"],
  },
  {
    name: "SOAR action proposed",
    eventType: "soar_proposed",
    minSeverity: "info",
    channels: ["inapp", "email"],
  },
  {
    name: "Overdue tickets",
    eventType: "ticket_overdue",
    minSeverity: "medium",
    channels: ["inapp"],
  },
];

async function ensureDefaults() {
  const count = await prisma.notificationRule.count();
  if (count > 0) return;
  for (const r of DEFAULT_RULES) {
    await prisma.notificationRule.create({
      data: {
        name: r.name,
        eventType: r.eventType,
        minSeverity: r.minSeverity,
        channels: r.channels,
        enabled: true,
      },
    });
  }
}

router.get("/", requireAuth, requireRoles("ADMINISTRATOR"), async (_req, res) => {
  await ensureDefaults();
  const rules = await prisma.notificationRule.findMany({ orderBy: { createdAt: "asc" } });
  return res.json({
    rules: rules.map((r) => ({
      ...r,
      channels: r.channels,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
  });
});

const upsertSchema = z.object({
  name: z.string().min(1).max(120),
  eventType: z.string().min(1).max(60),
  minSeverity: z.string().min(1).max(20),
  channels: z.array(z.enum(["inapp", "email"])).min(1),
  enabled: z.boolean().optional(),
});

router.post("/", requireAuth, requireRoles("ADMINISTRATOR"), async (req, res) => {
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid rule" });
  const rule = await prisma.notificationRule.create({
    data: {
      name: parsed.data.name,
      eventType: parsed.data.eventType,
      minSeverity: parsed.data.minSeverity,
      channels: parsed.data.channels,
      enabled: parsed.data.enabled ?? true,
    },
  });
  await writeAudit({
    userId: req.user!.id,
    action: "notifications.rule.create",
    outcome: "success",
    meta: { ruleId: rule.id },
  });
  return res.status(201).json({ rule });
});

router.patch("/:id", requireAuth, requireRoles("ADMINISTRATOR"), async (req, res) => {
  const parsed = upsertSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid rule update" });
  const rule = await prisma.notificationRule.update({
    where: { id: req.params.id },
    data: {
      ...parsed.data,
      channels: parsed.data.channels as object | undefined,
    },
  });
  await writeAudit({
    userId: req.user!.id,
    action: "notifications.rule.update",
    outcome: "success",
    meta: { ruleId: rule.id },
  });
  return res.json({ rule });
});

export default router;
