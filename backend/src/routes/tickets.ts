import { Router } from "express";
import { z } from "zod";
import { TicketPriority, TicketStatus } from "@prisma/client";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { writeAudit } from "../lib/audit.js";
import { notifyUser } from "../lib/notify.js";

const router = Router();

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  priority: z.nativeEnum(TicketPriority).optional(),
  ownerId: z.string().optional().nullable(),
  dueAt: z.string().datetime().optional().nullable(),
  incidentId: z.string().optional().nullable(),
  linkedAlertId: z.string().optional().nullable(),
  linkedVulnId: z.string().optional().nullable(),
  linkedAgentName: z.string().optional().nullable(),
});

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  priority: z.nativeEnum(TicketPriority).optional(),
  status: z.nativeEnum(TicketStatus).optional(),
  ownerId: z.string().optional().nullable(),
  dueAt: z.string().datetime().optional().nullable(),
  incidentId: z.string().optional().nullable(),
});

const commentSchema = z.object({
  body: z.string().min(1).max(4000),
});

function serializeTicket(ticket: Record<string, unknown>) {
  const dueAt = ticket.dueAt as Date | null | undefined;
  const createdAt = ticket.createdAt as Date;
  const updatedAt = ticket.updatedAt as Date;
  return {
    ...ticket,
    dueAt: dueAt ? dueAt.toISOString() : null,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
    overdue: Boolean(
      dueAt &&
        dueAt.getTime() < Date.now() &&
        ticket.status !== TicketStatus.DONE &&
        ticket.status !== TicketStatus.CLOSED,
    ),
  };
}

router.get("/", requireAuth, async (req, res) => {
  const status = String(req.query.status ?? "");
  const priority = String(req.query.priority ?? "");
  const q = String(req.query.q ?? "").trim();
  const agent = String(req.query.agent ?? "").trim();
  const from = String(req.query.from ?? "").trim();
  const to = String(req.query.to ?? "").trim();
  const sortDir = String(req.query.sort ?? "").toLowerCase() === "asc" ? "asc" : "desc";

  const tickets = await prisma.ticket.findMany({
    where: {
      ...(status ? { status: status as TicketStatus } : {}),
      ...(priority ? { priority: priority as TicketPriority } : {}),
      ...(agent
        ? { linkedAgentName: { contains: agent, mode: "insensitive" } }
        : {}),
      ...(from || to
        ? {
            updatedAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
              { linkedAgentName: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      incident: { select: { id: true, title: true } },
      _count: { select: { comments: true } },
    },
    orderBy: [{ updatedAt: sortDir }, { dueAt: "asc" }],
  });

  return res.json({
    tickets: tickets.map((t) => ({
      ...serializeTicket(t),
      commentCount: t._count.comments,
    })),
  });
});

router.get("/:id", requireAuth, async (req, res) => {
  const ticket = await prisma.ticket.findUnique({
    where: { id: req.params.id },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      incident: { select: { id: true, title: true, status: true } },
      comments: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!ticket) return res.status(404).json({ error: "Ticket not found" });

  return res.json({
    ticket: {
      ...serializeTicket(ticket),
      comments: ticket.comments.map((c) => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
      })),
    },
  });
});

router.post("/", requireAuth, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid ticket payload" });

  const data = parsed.data;
  const ticket = await prisma.ticket.create({
    data: {
      title: data.title,
      description: data.description ?? "",
      priority: data.priority ?? TicketPriority.MEDIUM,
      ownerId: data.ownerId ?? req.user!.id,
      createdById: req.user!.id,
      dueAt: data.dueAt ? new Date(data.dueAt) : null,
      incidentId: data.incidentId ?? null,
      linkedAlertId: data.linkedAlertId ?? null,
      linkedVulnId: data.linkedVulnId ?? null,
      linkedAgentName: data.linkedAgentName ?? null,
    },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      incident: { select: { id: true, title: true } },
    },
  });

  await writeAudit({
    userId: req.user!.id,
    action: "ticket.create",
    outcome: "success",
    meta: { ticketId: ticket.id, title: ticket.title },
  });

  if (ticket.ownerId && ticket.ownerId !== req.user!.id) {
    await notifyUser({
      userId: ticket.ownerId,
      title: "Ticket assigned to you",
      body: ticket.title,
      type: "ticket",
      href: `/app/tickets?id=${ticket.id}`,
    });
  }

  return res.status(201).json({ ticket: serializeTicket(ticket) });
});

router.patch("/:id", requireAuth, async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid update payload" });

  const existing = await prisma.ticket.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Ticket not found" });

  const data = parsed.data;
  const ticket = await prisma.ticket.update({
    where: { id: existing.id },
    data: {
      title: data.title,
      description: data.description,
      priority: data.priority,
      status: data.status,
      ownerId: data.ownerId,
      incidentId: data.incidentId,
      dueAt: data.dueAt === undefined ? undefined : data.dueAt ? new Date(data.dueAt) : null,
    },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      incident: { select: { id: true, title: true } },
    },
  });

  await writeAudit({
    userId: req.user!.id,
    action: "ticket.update",
    outcome: "success",
    meta: { ticketId: ticket.id, changes: data },
  });

  if (data.ownerId && data.ownerId !== existing.ownerId && data.ownerId !== req.user!.id) {
    await notifyUser({
      userId: data.ownerId,
      title: "Ticket assigned to you",
      body: ticket.title,
      type: "ticket",
      href: `/app/tickets?id=${ticket.id}`,
    });
  }

  return res.json({ ticket: serializeTicket(ticket) });
});

router.post("/:id/comments", requireAuth, async (req, res) => {
  const parsed = commentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid comment" });

  const existing = await prisma.ticket.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Ticket not found" });

  const comment = await prisma.ticketComment.create({
    data: {
      ticketId: existing.id,
      userId: req.user!.id,
      body: parsed.data.body,
    },
    include: { user: { select: { id: true, name: true } } },
  });

  return res.status(201).json({
    comment: { ...comment, createdAt: comment.createdAt.toISOString() },
  });
});

export default router;
