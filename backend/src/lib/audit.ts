import { prisma } from "./prisma.js";

export async function writeAudit(input: {
  userId?: string | null;
  action: string;
  outcome: string;
  meta?: Record<string, unknown>;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId ?? null,
        action: input.action,
        outcome: input.outcome,
        meta: (input.meta as object | undefined) ?? undefined,
      },
    });
  } catch (err) {
    console.error("audit write failed", err);
  }
}
