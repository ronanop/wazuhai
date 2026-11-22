import { Router } from "express";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";

const router = Router();

router.get("/", requireAuth, requireRoles("ADMINISTRATOR"), async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const action = String(req.query.action ?? "").trim();
  const from = String(req.query.from ?? "").trim();
  const to = String(req.query.to ?? "").trim();
  const sortDir = String(req.query.sort ?? "").toLowerCase() === "asc" ? "asc" : "desc";
  const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 50)));

  const logs = await prisma.auditLog.findMany({
    where: {
      ...(action ? { action: { contains: action, mode: "insensitive" } } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
      ...(q
        ? {
            OR: [
              { action: { contains: q, mode: "insensitive" } },
              { outcome: { contains: q, mode: "insensitive" } },
              { user: { email: { contains: q, mode: "insensitive" } } },
              { user: { name: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: sortDir },
    take: limit,
  });

  return res.json({
    logs: logs.map((l) => ({
      id: l.id,
      action: l.action,
      outcome: l.outcome,
      meta: l.meta,
      createdAt: l.createdAt.toISOString(),
      user: l.user,
    })),
  });
});

export default router;
