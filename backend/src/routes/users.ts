import { Router } from "express";
import bcrypt from "bcryptjs";
import { Role, UserStatus } from "@prisma/client";
import { z } from "zod";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { writeAudit } from "../lib/audit.js";
import { issueAuthToken } from "../lib/tokens.js";
import { sendMail } from "../lib/mail.js";

const router = Router();

router.get("/", requireAuth, requireRoles("ADMINISTRATOR"), async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });
  return res.json({
    users: users.map((u) => ({
      ...u,
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(),
    })),
  });
});

const inviteSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120),
  role: z.nativeEnum(Role).default(Role.SOC_ANALYST),
});

router.post("/invite", requireAuth, requireRoles("ADMINISTRATOR"), async (req, res) => {
  const parsed = inviteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid invite payload" });

  const email = parsed.data.email.toLowerCase().trim();
  if (parsed.data.role === Role.ADMINISTRATOR && req.user!.role !== "ADMINISTRATOR") {
    return res.status(403).json({ error: "Cannot invite administrators" });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.status === "ACTIVE") {
    return res.status(409).json({ error: "User already active" });
  }

  const tempHash = await bcrypt.hash(cryptoRandom(), 12);
  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          name: parsed.data.name,
          role: parsed.data.role,
          status: UserStatus.INVITED,
          passwordHash: tempHash,
        },
      })
    : await prisma.user.create({
        data: {
          email,
          name: parsed.data.name,
          role: parsed.data.role,
          status: UserStatus.INVITED,
          passwordHash: tempHash,
        },
      });

  const token = await issueAuthToken({
    email,
    type: "invite",
    userId: user.id,
    createdBy: req.user!.id,
    ttlHours: 72,
    meta: { role: user.role },
  });

  await sendMail({
    to: email,
    subject: "Aegis invitation",
    body: `You are invited to Aegis.\nAccept invite token: ${token.raw}\n(Or open /accept-invite?token=...)`,
  });

  await writeAudit({
    userId: req.user!.id,
    action: "users.invite",
    outcome: "success",
    meta: { email, role: user.role },
  });

  return res.status(201).json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    },
    inviteToken: token.raw,
    expiresAt: token.expiresAt.toISOString(),
  });
});

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  role: z.nativeEnum(Role).optional(),
  status: z.nativeEnum(UserStatus).optional(),
});

router.patch("/:id", requireAuth, requireRoles("ADMINISTRATOR"), async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid update" });
  if (req.params.id === req.user!.id && parsed.data.status === UserStatus.DISABLED) {
    return res.status(400).json({ error: "Cannot deactivate yourself" });
  }
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: parsed.data,
  });
  await writeAudit({
    userId: req.user!.id,
    action: "users.update",
    outcome: "success",
    meta: { targetUserId: user.id, changes: parsed.data },
  });
  return res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    },
  });
});

router.post("/:id/reset-password", requireAuth, requireRoles("ADMINISTRATOR"), async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return res.status(404).json({ error: "User not found" });
  const token = await issueAuthToken({
    email: user.email,
    type: "reset",
    userId: user.id,
    createdBy: req.user!.id,
    ttlHours: 24,
  });
  await sendMail({
    to: user.email,
    subject: "Aegis password reset",
    body: `Password reset token: ${token.raw}`,
  });
  await writeAudit({
    userId: req.user!.id,
    action: "users.reset_password",
    outcome: "success",
    meta: { targetUserId: user.id },
  });
  return res.json({
    ok: true,
    resetToken: token.raw,
    expiresAt: token.expiresAt.toISOString(),
  });
});

function cryptoRandom() {
  return `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default router;
