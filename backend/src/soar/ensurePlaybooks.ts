import { prisma } from "../lib/prisma.js";
import { PLAYBOOK_CATALOG } from "./playbookCatalog.js";

export async function ensurePlaybooks() {
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
}
