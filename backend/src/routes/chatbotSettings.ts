import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { writeAudit } from "../lib/audit.js";
import { DEFAULT_CHATBOT_SYSTEM_PROMPT } from "../ai/defaultPrompt.js";
import { ensureChatbotSettings, publicSettings } from "../ai/settingsService.js";

const router = Router();

const updateSchema = z.object({
  enabled: z.boolean().optional(),
  provider: z.string().min(1).max(40).optional(),
  model: z.string().min(1).max(80).optional(),
  apiBaseUrl: z.string().url().optional(),
  apiKey: z.string().optional(), // empty string clears; omit keeps
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(100).max(8000).optional(),
  systemPrompt: z.string().min(20).max(20000).optional(),
  groundingEnabled: z.boolean().optional(),
  requireCitations: z.boolean().optional(),
  refuseIfNoEvidence: z.boolean().optional(),
  maxEvidenceItems: z.number().int().min(3).max(40).optional(),
  toolsEnabled: z.boolean().optional(),
  suggestPlaybooks: z.boolean().optional(),
  activeResponseEnabled: z.boolean().optional(),
  dryRunDefault: z.boolean().optional(),
  maxActionsPerDay: z.number().int().min(1).max(500).optional(),
});

router.get("/", requireAuth, requireRoles("ADMINISTRATOR"), async (_req, res) => {
  const settings = await ensureChatbotSettings();
  return res.json({ settings: publicSettings(settings) });
});

router.get("/public", requireAuth, async (_req, res) => {
  const settings = await ensureChatbotSettings();
  return res.json({
    settings: {
      enabled: settings.enabled,
      model: settings.model,
      groundingEnabled: settings.groundingEnabled,
      requireCitations: settings.requireCitations,
      refuseIfNoEvidence: settings.refuseIfNoEvidence,
      apiKeyConfigured: Boolean(settings.apiKey?.trim()),
      toolsEnabled: settings.toolsEnabled,
      suggestPlaybooks: settings.suggestPlaybooks,
      activeResponseEnabled: settings.activeResponseEnabled,
      dryRunDefault: settings.dryRunDefault,
      maxActionsPerDay: settings.maxActionsPerDay,
    },
  });
});

router.put("/", requireAuth, requireRoles("ADMINISTRATOR"), async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid chatbot settings payload" });
  }

  await ensureChatbotSettings();
  const data = parsed.data;
  const update: Record<string, unknown> = { ...data };
  if (data.apiKey === undefined) {
    delete update.apiKey;
  }

  const settings = await prisma.chatbotSettings.update({
    where: { id: "default" },
    data: update,
  });

  await writeAudit({
    userId: req.user!.id,
    action: "chatbot.settings.update",
    outcome: "success",
    meta: {
      model: settings.model,
      groundingEnabled: settings.groundingEnabled,
      enabled: settings.enabled,
      apiKeyUpdated: data.apiKey !== undefined,
    },
  });

  return res.json({ settings: publicSettings(settings) });
});

router.post("/reset-prompt", requireAuth, requireRoles("ADMINISTRATOR"), async (req, res) => {
  await ensureChatbotSettings();
  const settings = await prisma.chatbotSettings.update({
    where: { id: "default" },
    data: { systemPrompt: DEFAULT_CHATBOT_SYSTEM_PROMPT },
  });
  await writeAudit({
    userId: req.user!.id,
    action: "chatbot.settings.reset_prompt",
    outcome: "success",
  });
  return res.json({ settings: publicSettings(settings) });
});

export default router;
