import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { z } from "zod";
import { UserStatus } from "@prisma/client";
import { config } from "../lib/config.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { consumeAuthToken, issueAuthToken } from "../lib/tokens.js";
import { sendMail } from "../lib/mail.js";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const passwordSchema = z.string().min(8).max(128);

function publicUser(user: {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  lastLoginAt: Date | null;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    lastLoginAt: user.lastLoginAt,
  };
}

function setSessionCookie(res: import("express").Response, token: string) {
  res.cookie(config.cookieName, token, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: "lax",
    maxAge: 8 * 60 * 60 * 1000,
    path: "/",
  });
}

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid credentials payload" });
  }

  const email = parsed.data.email.toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || user.status !== "ACTIVE") {
    await prisma.auditLog.create({
      data: {
        action: "auth.login",
        outcome: "failure",
        meta: { email, reason: "invalid_user" },
      },
    });
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!ok) {
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "auth.login",
        outcome: "failure",
        meta: { reason: "bad_password" },
      },
    });
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const token = jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn as SignOptions["expiresIn"] },
  );

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "auth.login",
      outcome: "success",
    },
  });

  setSessionCookie(res, token);
  return res.json({ user: publicUser(updated) });
});

router.post("/logout", requireAuth, async (req, res) => {
  await prisma.auditLog.create({
    data: {
      userId: req.user!.id,
      action: "auth.logout",
      outcome: "success",
    },
  });

  res.clearCookie(config.cookieName, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: "lax",
    path: "/",
  });
  return res.json({ ok: true });
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user || user.status !== "ACTIVE") {
    return res.status(401).json({ error: "Unauthorized" });
  }
  return res.json({ user: publicUser(user) });
});

router.post("/forgot-password", async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.toLowerCase().trim() : "";
  if (!email) return res.status(400).json({ error: "Email required" });
  const user = await prisma.user.findUnique({ where: { email } });
  // Always OK to avoid account enumeration
  if (user && user.status === "ACTIVE") {
    const token = await issueAuthToken({
      email,
      type: "reset",
      userId: user.id,
      ttlHours: 24,
    });
    await sendMail({
      to: email,
      subject: "Aegis password reset",
      body: `Reset token: ${token.raw}`,
    });
  }
  await prisma.auditLog.create({
    data: { action: "auth.forgot_password", outcome: "accepted", meta: { email } },
  });
  return res.json({ ok: true, message: "If the account exists, a reset token was issued." });
});

router.post("/reset-password", async (req, res) => {
  const schema = z.object({ token: z.string().min(10), password: passwordSchema });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid reset payload" });
  const row = await consumeAuthToken(parsed.data.token, "reset");
  if (!row) return res.status(400).json({ error: "Invalid or expired token" });
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const user = await prisma.user.update({
    where: { email: row.email },
    data: { passwordHash, status: UserStatus.ACTIVE },
  });
  await prisma.auditLog.create({
    data: { userId: user.id, action: "auth.reset_password", outcome: "success" },
  });
  return res.json({ ok: true });
});

router.post("/accept-invite", async (req, res) => {
  const schema = z.object({
    token: z.string().min(10),
    password: passwordSchema,
    name: z.string().min(1).max(120).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid invite payload" });
  const row = await consumeAuthToken(parsed.data.token, "invite");
  if (!row) return res.status(400).json({ error: "Invalid or expired invite" });
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const user = await prisma.user.update({
    where: { email: row.email },
    data: {
      passwordHash,
      status: UserStatus.ACTIVE,
      ...(parsed.data.name ? { name: parsed.data.name } : {}),
    },
  });
  await prisma.auditLog.create({
    data: { userId: user.id, action: "auth.accept_invite", outcome: "success" },
  });
  return res.json({ ok: true, user: publicUser(user) });
});

router.post("/change-password", requireAuth, async (req, res) => {
  const schema = z.object({
    currentPassword: z.string().min(1),
    newPassword: passwordSchema,
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid password payload" });
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  const ok = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!ok) return res.status(400).json({ error: "Current password is incorrect" });
  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  await prisma.auditLog.create({
    data: { userId: user.id, action: "auth.change_password", outcome: "success" },
  });
  return res.json({ ok: true });
});

router.patch("/profile", requireAuth, async (req, res) => {
  const schema = z.object({ name: z.string().min(1).max(120) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid profile payload" });
  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: { name: parsed.data.name },
  });
  return res.json({ user: publicUser(user) });
});

export default router;
