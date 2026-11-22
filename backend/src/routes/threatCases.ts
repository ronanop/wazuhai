import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";

const router = Router();

const createSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(5000).optional(),
  severity: z.enum(["info", "low", "medium", "high", "critical"]).optional(),
  status: z.enum(["open", "investigating", "closed"]).optional(),
  incidentId: z.string().min(1).optional().nullable(),
});

const patchSchema = createSchema.partial().extend({
  title: z.string().min(1).max(300).optional(),
});

const entitySchema = z.object({
  openctiId: z.string().min(1),
  entityType: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().optional(),
});

function serializeCase(
  row: Awaited<ReturnType<typeof loadCase>> extends infer T ? NonNullable<T> : never,
) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    severity: row.severity,
    incidentId: row.incidentId,
    incident: row.incident
      ? { id: row.incident.id, title: row.incident.title, status: row.incident.status }
      : null,
    createdBy: { id: row.createdBy.id, name: row.createdBy.name, email: row.createdBy.email },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    entities: row.entities.map((e) => ({
      id: e.id,
      openctiId: e.openctiId,
      entityType: e.entityType,
      name: e.name,
      slug: e.slug,
      createdAt: e.createdAt.toISOString(),
    })),
    notes: row.notes.map((n) => ({
      id: n.id,
      body: n.body,
      createdAt: n.createdAt.toISOString(),
      user: { id: n.user.id, name: n.user.name },
    })),
  };
}

async function loadCase(id: string) {
  return prisma.threatIntelCase.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      incident: { select: { id: true, title: true, status: true } },
      entities: { orderBy: { createdAt: "desc" } },
      notes: {
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, name: true } } },
      },
    },
  });
}

router.get("/", requireAuth, async (req, res) => {
  try {
    const status = String(req.query.status ?? "").trim();
    const q = String(req.query.q ?? "").trim();
    const rows = await prisma.threatIntelCase.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { description: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        incident: { select: { id: true, title: true, status: true } },
        entities: { orderBy: { createdAt: "desc" } },
        notes: {
          orderBy: { createdAt: "desc" },
          take: 5,
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });
    return res.json({ cases: rows.map((r) => serializeCase(r)) });
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to list cases",
    });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const userId = req.user!.id;
    if (parsed.data.incidentId) {
      const inc = await prisma.incident.findUnique({ where: { id: parsed.data.incidentId } });
      if (!inc) return res.status(400).json({ error: "Incident not found" });
    }
    const created = await prisma.threatIntelCase.create({
      data: {
        title: parsed.data.title,
        description: parsed.data.description ?? "",
        severity: parsed.data.severity ?? "medium",
        status: parsed.data.status ?? "open",
        incidentId: parsed.data.incidentId ?? null,
        createdById: userId,
      },
    });
    const full = await loadCase(created.id);
    return res.status(201).json({ case: serializeCase(full!) });
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to create case",
    });
  }
});

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const row = await loadCase(req.params.id);
    if (!row) return res.status(404).json({ error: "Case not found" });
    return res.json({ case: serializeCase(row) });
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to load case",
    });
  }
});

router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const existing = await prisma.threatIntelCase.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Case not found" });

    if (parsed.data.incidentId) {
      const inc = await prisma.incident.findUnique({ where: { id: parsed.data.incidentId } });
      if (!inc) return res.status(400).json({ error: "Incident not found" });
    }

    await prisma.threatIntelCase.update({
      where: { id: req.params.id },
      data: {
        ...(parsed.data.title != null ? { title: parsed.data.title } : {}),
        ...(parsed.data.description != null ? { description: parsed.data.description } : {}),
        ...(parsed.data.severity != null ? { severity: parsed.data.severity } : {}),
        ...(parsed.data.status != null ? { status: parsed.data.status } : {}),
        ...(parsed.data.incidentId !== undefined ? { incidentId: parsed.data.incidentId } : {}),
      },
    });
    const full = await loadCase(req.params.id);
    return res.json({ case: serializeCase(full!) });
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to update case",
    });
  }
});

router.post("/:id/entities", requireAuth, async (req, res) => {
  try {
    const parsed = entitySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const existing = await prisma.threatIntelCase.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Case not found" });

    await prisma.threatIntelCaseEntity.upsert({
      where: {
        caseId_openctiId: { caseId: req.params.id, openctiId: parsed.data.openctiId },
      },
      create: {
        caseId: req.params.id,
        openctiId: parsed.data.openctiId,
        entityType: parsed.data.entityType,
        name: parsed.data.name,
        slug: parsed.data.slug ?? "",
      },
      update: {
        entityType: parsed.data.entityType,
        name: parsed.data.name,
        slug: parsed.data.slug ?? "",
      },
    });
    const full = await loadCase(req.params.id);
    return res.json({ case: serializeCase(full!) });
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to attach entity",
    });
  }
});

router.delete("/:id/entities/:entityId", requireAuth, async (req, res) => {
  try {
    await prisma.threatIntelCaseEntity.deleteMany({
      where: { id: req.params.entityId, caseId: req.params.id },
    });
    const full = await loadCase(req.params.id);
    if (!full) return res.status(404).json({ error: "Case not found" });
    return res.json({ case: serializeCase(full) });
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to detach entity",
    });
  }
});

router.post("/:id/notes", requireAuth, async (req, res) => {
  try {
    const body = String(req.body?.body ?? "").trim();
    if (!body) return res.status(400).json({ error: "Note body required" });
    const existing = await prisma.threatIntelCase.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Case not found" });
    await prisma.threatIntelCaseNote.create({
      data: {
        caseId: req.params.id,
        userId: req.user!.id,
        body,
      },
    });
    const full = await loadCase(req.params.id);
    return res.status(201).json({ case: serializeCase(full!) });
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to add note",
    });
  }
});

router.post("/:id/create-incident", requireAuth, async (req, res) => {
  try {
    const row = await loadCase(req.params.id);
    if (!row) return res.status(404).json({ error: "Case not found" });
    if (row.incidentId) {
      return res.json({ case: serializeCase(row), created: false });
    }

    const severityMap: Record<string, "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"> = {
      info: "INFO",
      low: "LOW",
      medium: "MEDIUM",
      high: "HIGH",
      critical: "CRITICAL",
    };

    const incident = await prisma.incident.create({
      data: {
        title: row.title,
        description:
          row.description ||
          `Created from Threat Intel case. Linked entities: ${row.entities.map((e) => e.name).join(", ") || "none"}`,
        severity: severityMap[row.severity] ?? "MEDIUM",
        status: "OPEN",
        createdById: req.user!.id,
        ownerId: req.user!.id,
      },
    });

    await prisma.threatIntelCase.update({
      where: { id: row.id },
      data: { incidentId: incident.id },
    });
    const full = await loadCase(row.id);
    return res.status(201).json({ case: serializeCase(full!), incidentId: incident.id, created: true });
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to create incident",
    });
  }
});

export default router;
