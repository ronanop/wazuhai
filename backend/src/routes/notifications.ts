import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const unreadOnly = String(req.query.unread ?? "") === "1";
  const notifications = await prisma.notification.findMany({
    where: {
      userId: req.user!.id,
      ...(unreadOnly ? { readAt: null } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const unreadCount = await prisma.notification.count({
    where: { userId: req.user!.id, readAt: null },
  });

  return res.json({
    unreadCount,
    notifications: notifications.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      type: n.type,
      href: n.href,
      readAt: n.readAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
    })),
  });
});

router.post("/:id/read", requireAuth, async (req, res) => {
  const existing = await prisma.notification.findFirst({
    where: { id: req.params.id, userId: req.user!.id },
  });
  if (!existing) return res.status(404).json({ error: "Not found" });

  const updated = await prisma.notification.update({
    where: { id: existing.id },
    data: { readAt: new Date() },
  });

  return res.json({
    notification: {
      ...updated,
      readAt: updated.readAt?.toISOString() ?? null,
      createdAt: updated.createdAt.toISOString(),
    },
  });
});

router.post("/read-all", requireAuth, async (req, res) => {
  await prisma.notification.updateMany({
    where: { userId: req.user!.id, readAt: null },
    data: { readAt: new Date() },
  });
  return res.json({ ok: true });
});

export default router;
