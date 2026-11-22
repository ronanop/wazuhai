import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const key = process.env.OPENAI_API_KEY || "";
const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
const apiBaseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";

const settings = await prisma.chatbotSettings.update({
  where: { id: "default" },
  data: {
    apiKey: key,
    model,
    apiBaseUrl,
    enabled: true,
  },
});

console.log(
  JSON.stringify({
    enabled: settings.enabled,
    model: settings.model,
    apiBaseUrl: settings.apiBaseUrl,
    keyLen: (settings.apiKey || "").length,
    keyPrefix: (settings.apiKey || "").slice(0, 8),
  }),
);

await prisma.$disconnect();
