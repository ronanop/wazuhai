import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { indexerSearch } from "../wazuh/indexer.js";
import { normalizeAlert } from "../wazuh/normalize.js";
import { buildAlertQuery } from "../wazuh/query.js";

const router = Router();

const HUNT_NOTE_KIND = "hunt_note";

const saveSchema = z.object({
  name: z.string().min(1).max(120),
  query: z.record(z.unknown()),
});

const noteSchema = z.object({
  findingKey: z.string().min(1),
  note: z.string().max(4000).optional(),
  status: z.enum(["open", "investigating", "closed"]).optional(),
});

router.get("/notes", requireAuth, async (req, res) => {
  const findingKey = String(req.query.findingKey ?? "").trim();
  const raw = String(req.query.ids ?? "").trim();
  const ids = findingKey
    ? [findingKey]
    : raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 100);

  if (ids.length === 0) {
    return res.json({ notes: [] });
  }

  const notes = await prisma.findingNote.findMany({
    where: {
      userId: req.user!.id,
      kind: HUNT_NOTE_KIND,
      findingKey: { in: ids },
    },
  });

  return res.json({
    notes: notes.map((n) => ({
      findingKey: n.findingKey,
      note: n.note,
      status: n.status,
      updatedAt: n.updatedAt,
    })),
  });
});

router.post("/notes", requireAuth, async (req, res) => {
  const parsed = noteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid note payload" });
  }

  const saved = await prisma.findingNote.upsert({
    where: {
      userId_findingKey_kind: {
        userId: req.user!.id,
        findingKey: parsed.data.findingKey,
        kind: HUNT_NOTE_KIND,
      },
    },
    create: {
      userId: req.user!.id,
      findingKey: parsed.data.findingKey,
      kind: HUNT_NOTE_KIND,
      note: parsed.data.note ?? "",
      status: parsed.data.status ?? "open",
    },
    update: {
      note: parsed.data.note ?? "",
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
    },
  });

  return res.json({
    note: {
      findingKey: saved.findingKey,
      note: saved.note,
      status: saved.status,
      updatedAt: saved.updatedAt,
    },
  });
});

router.get("/search", requireAuth, async (req, res) => {
  try {
    const built = buildAlertQuery({
      page: Number(req.query.page ?? 1),
      pageSize: Number(req.query.pageSize ?? 25),
      q: String(req.query.q ?? ""),
      severity: String(req.query.severity ?? ""),
      agent: String(req.query.agent ?? ""),
      group: String(req.query.group ?? "") || undefined,
      mitre: String(req.query.mitre ?? "") || undefined,
      from: String(req.query.from ?? "") || undefined,
      to: String(req.query.to ?? "") || undefined,
      sort: String(req.query.sort ?? ""),
    });

    const result = await indexerSearch("wazuh-alerts-*", {
      from: built.from,
      size: built.pageSize,
      sort: [{ timestamp: { order: built.sortDir, unmapped_type: "date" } }],
      query: built.query,
      track_total_hits: true,
    });

    return res.json({
      page: built.page,
      pageSize: built.pageSize,
      total: result.total,
      events: result.hits.map((hit) => {
        const alert = normalizeAlert({ _id: hit._id, _source: hit._source });
        return { ...alert, raw: hit._source };
      }),
    });
  } catch (err) {
    return res.status(502).json({
      error: err instanceof Error ? err.message : "Hunt search failed",
    });
  }
});

router.get("/saved", requireAuth, async (req, res) => {
  const items = await prisma.savedHuntQuery.findMany({
    where: { userId: req.user!.id },
    orderBy: { updatedAt: "desc" },
  });
  return res.json({ queries: items });
});

router.post("/saved", requireAuth, async (req, res) => {
  const parsed = saveSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid saved query payload" });
  }
  const created = await prisma.savedHuntQuery.create({
    data: {
      userId: req.user!.id,
      name: parsed.data.name,
      query: parsed.data.query as object,
    },
  });
  return res.status(201).json({ query: created });
});

router.delete("/saved/:id", requireAuth, async (req, res) => {
  const existing = await prisma.savedHuntQuery.findFirst({
    where: { id: req.params.id, userId: req.user!.id },
  });
  if (!existing) return res.status(404).json({ error: "Not found" });
  await prisma.savedHuntQuery.delete({ where: { id: existing.id } });
  return res.json({ ok: true });
});

export default router;
