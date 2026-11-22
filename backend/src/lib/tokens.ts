import crypto from "node:crypto";
import { prisma } from "./prisma.js";

export function hashToken(raw: string) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function createRawToken() {
  return crypto.randomBytes(32).toString("hex");
}

export async function issueAuthToken(input: {
  email: string;
  type: "invite" | "reset" | "verify";
  userId?: string | null;
  createdBy?: string | null;
  ttlHours?: number;
  meta?: Record<string, unknown>;
}) {
  const raw = createRawToken();
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + (input.ttlHours ?? 48) * 60 * 60 * 1000);
  await prisma.authToken.create({
    data: {
      email: input.email.toLowerCase().trim(),
      type: input.type,
      tokenHash,
      expiresAt,
      userId: input.userId ?? null,
      createdBy: input.createdBy ?? null,
      meta: (input.meta as object | undefined) ?? undefined,
    },
  });
  return { raw, expiresAt };
}

export async function consumeAuthToken(raw: string, type: string) {
  const tokenHash = hashToken(raw);
  const row = await prisma.authToken.findFirst({
    where: { tokenHash, type, usedAt: null },
  });
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;
  await prisma.authToken.update({
    where: { id: row.id },
    data: { usedAt: new Date() },
  });
  return row;
}
