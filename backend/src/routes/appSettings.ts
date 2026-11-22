import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { writeAudit } from "../lib/audit.js";
import { sendMail } from "../lib/mail.js";

const router = Router();

async function ensure() {
  return prisma.appSettings.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
  });
}

function publicAppSettings(s: Awaited<ReturnType<typeof ensure>>) {
  return {
    id: s.id,
    timezone: s.timezone,
    dateFormat: s.dateFormat,
    defaultLanding: s.defaultLanding,
    sessionHours: s.sessionHours,
    smtpEnabled: s.smtpEnabled,
    smtpHost: s.smtpHost,
    smtpPort: s.smtpPort,
    smtpUser: s.smtpUser,
    smtpFrom: s.smtpFrom,
    smtpConfigured: Boolean(s.smtpHost && s.smtpPass),
    updatedAt: s.updatedAt.toISOString(),
  };
}

router.get("/", requireAuth, requireRoles("ADMINISTRATOR"), async (_req, res) => {
  const settings = await ensure();
  return res.json({ settings: publicAppSettings(settings) });
});

router.get("/public", requireAuth, async (_req, res) => {
  const settings = await ensure();
  return res.json({
    settings: {
      timezone: settings.timezone,
      dateFormat: settings.dateFormat,
      defaultLanding: settings.defaultLanding,
      sessionHours: settings.sessionHours,
    },
  });
});

const updateSchema = z.object({
  timezone: z.string().min(1).max(80).optional(),
  dateFormat: z.string().min(1).max(40).optional(),
  defaultLanding: z.string().min(1).max(80).optional(),
  sessionHours: z.number().int().min(1).max(168).optional(),
  smtpEnabled: z.boolean().optional(),
  smtpHost: z.string().max(200).optional(),
  smtpPort: z.number().int().min(1).max(65535).optional(),
  smtpUser: z.string().max(200).optional(),
  smtpPass: z.string().max(400).optional(),
  smtpFrom: z.string().max(200).optional(),
});

router.put("/", requireAuth, requireRoles("ADMINISTRATOR"), async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid settings" });
  await ensure();
  const data = { ...parsed.data };
  if (data.smtpPass === undefined) delete data.smtpPass;
  const settings = await prisma.appSettings.update({
    where: { id: "default" },
    data,
  });
  await writeAudit({
    userId: req.user!.id,
    action: "app.settings.update",
    outcome: "success",
    meta: { keys: Object.keys(parsed.data) },
  });
  return res.json({ settings: publicAppSettings(settings) });
});

router.post("/test-email", requireAuth, requireRoles("ADMINISTRATOR"), async (req, res) => {
  const to = typeof req.body?.to === "string" ? req.body.to : req.user!.email;
  const result = await sendMail({
    to,
    subject: "Aegis test email",
    body: "This is a test message from Application Settings → Notifications/Email.",
  });
  await writeAudit({
    userId: req.user!.id,
    action: "app.settings.test_email",
    outcome: result.delivered ? "success" : "stubbed",
    meta: result,
  });
  return res.json({ result });
});

export default router;
