import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { ensureChatbotSettings } from "../ai/settingsService.js";
import { retrieveEvidence } from "../ai/retrieveEvidence.js";
import { generateGroundedAnswer } from "../ai/llm.js";
import { suggestedPromptsForPage } from "../ai/suggestedPrompts.js";

const router = Router();

const chatSchema = z.object({
  message: z.string().min(1).max(4000),
  page: z.string().max(120).optional(),
  selected: z
    .object({
      type: z.string().optional(),
      id: z.string().optional(),
      title: z.string().optional(),
      meta: z.record(z.unknown()).optional(),
    })
    .optional(),
});

router.get("/suggestions", requireAuth, async (req, res) => {
  const page = typeof req.query.page === "string" ? req.query.page : "";
  const selectedType = typeof req.query.selectedType === "string" ? req.query.selectedType : "";
  return res.json({ prompts: suggestedPromptsForPage(page, selectedType) });
});

router.get("/history", requireAuth, async (req, res) => {
  const messages = await prisma.chatMessage.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: "asc" },
    take: 80,
  });
  return res.json({
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      page: m.page,
      evidence: m.evidence,
      createdAt: m.createdAt.toISOString(),
    })),
  });
});

router.delete("/history", requireAuth, async (req, res) => {
  await prisma.chatMessage.deleteMany({ where: { userId: req.user!.id } });
  return res.json({ ok: true });
});

router.post("/", requireAuth, async (req, res) => {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid chat payload" });
  }

  const settings = await ensureChatbotSettings();
  if (!settings.enabled) {
    return res.status(503).json({ error: "Chatbot is disabled in settings" });
  }

  const { message, page, selected } = parsed.data;

  await prisma.chatMessage.create({
    data: {
      userId: req.user!.id,
      role: "user",
      content: message,
      page: page ?? null,
    },
  });

  try {
    const evidence = settings.groundingEnabled
      ? await retrieveEvidence(
          { question: message, page, selected },
          settings.maxEvidenceItems,
        )
      : {
          retrievedAt: new Date().toISOString(),
          page: page || "unknown",
          selected: selected ?? null,
          sources: [],
          items: {},
          empty: true,
        };

    if (
      settings.groundingEnabled &&
      settings.refuseIfNoEvidence &&
      evidence.empty &&
      !evidence.items.opsSnapshot
    ) {
      const content =
        "I don't have enough evidence in the current data to answer that. Try opening an alert, vulnerability, incident, or compliance control first.";
      const saved = await prisma.chatMessage.create({
        data: {
          userId: req.user!.id,
          role: "assistant",
          content,
          page: page ?? null,
          evidence: evidence as object,
        },
      });
      return res.json({
        message: {
          id: saved.id,
          role: "assistant",
          content,
          createdAt: saved.createdAt.toISOString(),
        },
        evidence,
        mode: "refused",
      });
    }

    const answer = await generateGroundedAnswer({
      settings,
      question: message,
      evidence,
      userRole: req.user!.role,
    });

    const saved = await prisma.chatMessage.create({
      data: {
        userId: req.user!.id,
        role: "assistant",
        content: answer.content,
        page: page ?? null,
        evidence: {
          sources: evidence.sources,
          mode: answer.mode,
          model: answer.model,
        } as object,
      },
    });

    return res.json({
      message: {
        id: saved.id,
        role: "assistant",
        content: answer.content,
        createdAt: saved.createdAt.toISOString(),
      },
      evidence: {
        sources: evidence.sources,
        retrievedAt: evidence.retrievedAt,
        page: evidence.page,
      },
      mode: answer.mode,
      model: answer.model,
      suggestions: suggestedPromptsForPage(page, selected?.type),
    });
  } catch (err) {
    return res.status(502).json({
      error: err instanceof Error ? err.message : "Chat failed",
    });
  }
});

export default router;
