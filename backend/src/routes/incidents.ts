import { Router } from "express";
import { z } from "zod";
import {
  IncidentSeverity,
  IncidentStatus,
} from "@prisma/client";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { writeAudit } from "../lib/audit.js";
import { notifyUser } from "../lib/notify.js";

const router = Router();

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  severity: z.nativeEnum(IncidentSeverity).optional(),
  ownerId: z.string().optional().nullable(),
  alertIndexId: z.string().optional().nullable(),
  alertRuleId: z.string().optional().nullable(),
  alertRuleDescription: z.string().optional().nullable(),
  agentName: z.string().optional().nullable(),
  agentId: z.string().optional().nullable(),
});

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  severity: z.nativeEnum(IncidentSeverity).optional(),
  status: z.nativeEnum(IncidentStatus).optional(),
  ownerId: z.string().optional().nullable(),
});

const noteSchema = z.object({
  body: z.string().min(1).max(4000),
});

function serializeIncident(incident: {
  id: string;
  title: string;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  ownerId: string | null;
  createdById: string;
  alertIndexId: string | null;
  alertRuleId: string | null;
  alertRuleDescription: string | null;
  agentName: string | null;
  agentId: string | null;
  createdAt: Date;
  updatedAt: Date;
  closedAt: Date | null;
  owner?: { id: string; name: string; email: string } | null;
  createdBy?: { id: string; name: string; email: string };
  notes?: Array<{
    id: string;
    body: string;
    createdAt: Date;
    user: { id: string; name: string };
  }>;
  activities?: Array<{
    id: string;
    action: string;
    detail: string;
    createdAt: Date;
    user: { id: string; name: string } | null;
  }>;
  tickets?: Array<{ id: string; title: string; status: string; priority: string }>;
}) {
  return {
    ...incident,
    createdAt: incident.createdAt.toISOString(),
    updatedAt: incident.updatedAt.toISOString(),
    closedAt: incident.closedAt?.toISOString() ?? null,
    notes: incident.notes?.map((n) => ({
      ...n,
      createdAt: n.createdAt.toISOString(),
    })),
    activities: incident.activities?.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
    })),
  };
}

router.get("/", requireAuth, async (req, res) => {
  const status = String(req.query.status ?? "");
  const severity = String(req.query.severity ?? "");
  const q = String(req.query.q ?? "").trim();
  const agent = String(req.query.agent ?? "").trim();
  const from = String(req.query.from ?? "").trim();
  const to = String(req.query.to ?? "").trim();
  const sortDir = String(req.query.sort ?? "").toLowerCase() === "asc" ? "asc" : "desc";

  const and: Record<string, unknown>[] = [];
  if (agent) {
    and.push({
      OR: [
        { agentName: { contains: agent, mode: "insensitive" } },
        { agentId: { contains: agent, mode: "insensitive" } },
      ],
    });
  }
  if (q) {
    and.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { agentName: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  const incidents = await prisma.incident.findMany({
    where: {
      ...(status ? { status: status as IncidentStatus } : {}),
      ...(severity ? { severity: severity as IncidentSeverity } : {}),
      ...(from || to
        ? {
            updatedAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
      ...(and.length ? { AND: and } : {}),
    },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      _count: { select: { notes: true, tickets: true } },
    },
    orderBy: { updatedAt: sortDir },
  });

  return res.json({
    incidents: incidents.map((i) => ({
      ...serializeIncident(i),
      noteCount: i._count.notes,
      ticketCount: i._count.tickets,
    })),
  });
});

router.get("/:id", requireAuth, async (req, res) => {
  const incident = await prisma.incident.findUnique({
    where: { id: req.params.id },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      notes: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      },
      activities: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      tickets: {
        select: { id: true, title: true, status: true, priority: true },
        orderBy: { updatedAt: "desc" },
      },
    },
  });
  if (!incident) return res.status(404).json({ error: "Incident not found" });
  return res.json({ incident: serializeIncident(incident) });
});

router.post("/", requireAuth, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid incident payload" });
  }

  const data = parsed.data;
  const incident = await prisma.incident.create({
    data: {
      title: data.title,
      description: data.description ?? "",
      severity: data.severity ?? IncidentSeverity.MEDIUM,
      ownerId: data.ownerId ?? req.user!.id,
      createdById: req.user!.id,
      alertIndexId: data.alertIndexId ?? null,
      alertRuleId: data.alertRuleId ?? null,
      alertRuleDescription: data.alertRuleDescription ?? null,
      agentName: data.agentName ?? null,
      agentId: data.agentId ?? null,
      activities: {
        create: {
          userId: req.user!.id,
          action: "created",
          detail: data.alertIndexId ? "Created from alert" : "Incident opened",
        },
      },
    },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });

  await writeAudit({
    userId: req.user!.id,
    action: "incident.create",
    outcome: "success",
    meta: { incidentId: incident.id, title: incident.title },
  });

  if (incident.ownerId && incident.ownerId !== req.user!.id) {
    await notifyUser({
      userId: incident.ownerId,
      title: "Incident assigned to you",
      body: incident.title,
      type: "incident",
      href: `/app/incidents?id=${incident.id}`,
    });
  }

  return res.status(201).json({ incident: serializeIncident(incident) });
});

router.patch("/:id", requireAuth, async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid update payload" });
  }

  const existing = await prisma.incident.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Incident not found" });

  const data = parsed.data;
  const closed =
    data.status === IncidentStatus.CLOSED || data.status === IncidentStatus.RESOLVED;

  const incident = await prisma.incident.update({
    where: { id: existing.id },
    data: {
      ...data,
      closedAt: closed ? new Date() : data.status ? null : undefined,
      activities: {
        create: {
          userId: req.user!.id,
          action: "updated",
          detail: Object.keys(data).join(", "),
        },
      },
    },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });

  await writeAudit({
    userId: req.user!.id,
    action: "incident.update",
    outcome: "success",
    meta: { incidentId: incident.id, changes: data },
  });

  if (data.ownerId && data.ownerId !== existing.ownerId && data.ownerId !== req.user!.id) {
    await notifyUser({
      userId: data.ownerId,
      title: "Incident assigned to you",
      body: incident.title,
      type: "incident",
      href: `/app/incidents?id=${incident.id}`,
    });
  }

  return res.json({ incident: serializeIncident(incident) });
});

router.get("/:id/investigation", requireAuth, async (req, res) => {
  const { buildIncidentInvestigation } = await import("../soar/investigation.js");
  const investigation = await buildIncidentInvestigation(req.params.id);
  if (!investigation) return res.status(404).json({ error: "Incident not found" });
  return res.json({ investigation });
});

router.post("/:id/notes", requireAuth, async (req, res) => {
  const parsed = noteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid note" });

  const existing = await prisma.incident.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Incident not found" });

  const note = await prisma.incidentNote.create({
    data: {
      incidentId: existing.id,
      userId: req.user!.id,
      body: parsed.data.body,
    },
    include: { user: { select: { id: true, name: true } } },
  });

  await prisma.incidentActivity.create({
    data: {
      incidentId: existing.id,
      userId: req.user!.id,
      action: "note_added",
      detail: "Investigation note added",
    },
  });

  return res.status(201).json({
    note: { ...note, createdAt: note.createdAt.toISOString() },
  });
});

export default router;
