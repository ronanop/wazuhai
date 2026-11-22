import bcrypt from "bcryptjs";
import { PrismaClient, Role } from "@prisma/client";
import { DEFAULT_CHATBOT_SYSTEM_PROMPT } from "../src/ai/defaultPrompt.js";
import { PLAYBOOK_CATALOG } from "../src/soar/playbookCatalog.js";

const prisma = new PrismaClient();

async function main() {
  const users = [
    {
      email: "admin@aegis.local",
      name: "Platform Admin",
      password: "Admin@12345",
      role: Role.ADMINISTRATOR,
    },
    {
      email: "analyst@aegis.local",
      name: "SOC Analyst",
      password: "Analyst@12345",
      role: Role.SOC_ANALYST,
    },
  ];

  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 12);
    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        passwordHash,
        role: u.role,
        status: "ACTIVE",
      },
      create: {
        email: u.email,
        name: u.name,
        passwordHash,
        role: u.role,
        status: "ACTIVE",
      },
    });
  }

  await prisma.chatbotSettings.upsert({
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

  for (const p of PLAYBOOK_CATALOG) {
    await prisma.playbook.upsert({
      where: { key: p.key },
      create: {
        key: p.key,
        name: p.name,
        description: p.description,
        category: p.category,
        actionType: p.actionType,
        command: p.command,
        riskLevel: p.riskLevel,
        requiresApproval: p.requiresApproval,
        enabled: true,
      },
      update: {
        name: p.name,
        description: p.description,
        category: p.category,
        actionType: p.actionType,
        command: p.command,
        riskLevel: p.riskLevel,
        requiresApproval: p.requiresApproval,
      },
    });
  }

  console.log("Seeded users:");
  console.log("  admin@aegis.local / Admin@12345 (ADMINISTRATOR)");
  console.log("  analyst@aegis.local / Analyst@12345 (SOC_ANALYST)");
  console.log("  Chatbot settings ready (Application Settings → Chatbot)");
  console.log(`  Playbooks seeded: ${PLAYBOOK_CATALOG.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
