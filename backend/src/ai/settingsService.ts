import { prisma } from "../lib/prisma.js";
import { DEFAULT_CHATBOT_SYSTEM_PROMPT } from "./defaultPrompt.js";

export async function ensureChatbotSettings() {
  return prisma.chatbotSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      systemPrompt: DEFAULT_CHATBOT_SYSTEM_PROMPT,
      apiKey: process.env.OPENAI_API_KEY ?? "",
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      apiBaseUrl: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
    },
    update: {},
  });
}

export function publicSettings(settings: Awaited<ReturnType<typeof ensureChatbotSettings>>) {
  const hasKey = Boolean(settings.apiKey && settings.apiKey.trim());
  return {
    id: settings.id,
    enabled: settings.enabled,
    provider: settings.provider,
    model: settings.model,
    apiBaseUrl: settings.apiBaseUrl,
    apiKeyConfigured: hasKey,
    apiKeyMasked: hasKey ? maskKey(settings.apiKey) : "",
    temperature: settings.temperature,
    maxTokens: settings.maxTokens,
    systemPrompt: settings.systemPrompt,
    groundingEnabled: settings.groundingEnabled,
    requireCitations: settings.requireCitations,
    refuseIfNoEvidence: settings.refuseIfNoEvidence,
    maxEvidenceItems: settings.maxEvidenceItems,
    toolsEnabled: settings.toolsEnabled,
    suggestPlaybooks: settings.suggestPlaybooks,
    activeResponseEnabled: settings.activeResponseEnabled,
    dryRunDefault: settings.dryRunDefault,
    maxActionsPerDay: settings.maxActionsPerDay,
    updatedAt: settings.updatedAt.toISOString(),
  };
}

function maskKey(key: string) {
  const t = key.trim();
  if (t.length <= 8) return "••••••••";
  return `${t.slice(0, 3)}••••${t.slice(-4)}`;
}
