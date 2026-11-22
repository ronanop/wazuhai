import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import {
  agentFilterClause,
  parseOptionalIso,
  parseSortDir,
  timestampRangeClause,
} from "../lib/listQuery.js";
import { prisma } from "../lib/prisma.js";
import { indexerSearch } from "../wazuh/indexer.js";
import { normalizeAlert } from "../wazuh/normalize.js";

const router = Router();

const TRIAGE_KIND = "alert_triage";
const triageStatuses = ["open", "acknowledged", "assigned", "investigating"] as const;

const triageSetSchema = z.object({
  indexId: z.string().min(1),
  status: z.enum(triageStatuses),
  assignee: z.string().max(200).optional(),
});

router.get("/triage", requireAuth, async (req, res) => {
  const raw = String(req.query.ids ?? "").trim();
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 100);

  if (ids.length === 0) {
    return res.json({ triage: [] });
  }

  const notes = await prisma.findingNote.findMany({
    where: {
      userId: req.user!.id,
      kind: TRIAGE_KIND,
      findingKey: { in: ids },
    },
  });

  return res.json({
    triage: notes.map((n) => ({
      indexId: n.findingKey,
      status: n.status,
      assignee: n.note,
      updatedAt: n.updatedAt,
    })),
  });
});

router.post("/triage", requireAuth, async (req, res) => {
  const parsed = triageSetSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid triage payload" });
  }

  const { indexId, status, assignee } = parsed.data;
  const saved = await prisma.findingNote.upsert({
    where: {
      userId_findingKey_kind: {
        userId: req.user!.id,
        findingKey: indexId,
        kind: TRIAGE_KIND,
      },
    },
    create: {
      userId: req.user!.id,
      findingKey: indexId,
      kind: TRIAGE_KIND,
      status,
      note: assignee ?? "",
    },
    update: {
      status,
      ...(assignee !== undefined ? { note: assignee } : {}),
    },
  });

  return res.json({
    triage: {
      indexId: saved.findingKey,
      status: saved.status,
      assignee: saved.note,
      updatedAt: saved.updatedAt,
    },
  });
});

router.get("/", requireAuth, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize ?? 25)));
    const from = (page - 1) * pageSize;
    const q = String(req.query.q ?? "").trim();
    const severity = String(req.query.severity ?? "").trim();
    const agent = String(req.query.agent ?? "").trim();
    const fromIso = parseOptionalIso(req.query.from);
    const toIso = parseOptionalIso(req.query.to);
    const sortDir = parseSortDir(req.query.sort);

    const filters: Record<string, unknown>[] = [];

    if (q) {
      filters.push({
        multi_match: {
          query: q,
          fields: [
            "rule.description",
            "rule.id",
            "agent.name",
            "data.win.system.message",
            "full_log",
          ],
          type: "best_fields",
        },
      });
    }

    const agentClause = agentFilterClause(agent);
    if (agentClause) filters.push(agentClause);

    if (severity) {
      const ranges: Record<string, { gte?: number; lte?: number }> = {
        info: { gte: 0, lte: 0 },
        low: { gte: 1, lte: 3 },
        medium: { gte: 4, lte: 7 },
        high: { gte: 8, lte: 11 },
        critical: { gte: 12, lte: 15 },
      };
      const range = ranges[severity];
      if (range) {
        filters.push({ range: { "rule.level": range } });
      }
    }

    const rangeClause = timestampRangeClause(fromIso, toIso);
    if (rangeClause) filters.push(rangeClause);

    const query =
      filters.length > 0
        ? { bool: { must: filters } }
        : { match_all: {} };

    const result = await indexerSearch("wazuh-alerts-*", {
      from,
      size: pageSize,
      sort: [{ timestamp: { order: sortDir, unmapped_type: "date" } }],
      query,
      track_total_hits: true,
    });

    const alerts = result.hits.map((hit) => {
      const alert = normalizeAlert({
        _id: hit._id,
        _source: hit._source,
      });
      return { ...alert, raw: {} };
    });

    return res.json({
      page,
      pageSize,
      total: result.total,
      alerts,
    });
  } catch (err) {
    return res.status(502).json({
      error: err instanceof Error ? err.message : "Failed to fetch alerts",
    });
  }
});

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const result = await indexerSearch("wazuh-alerts-*", {
      size: 1,
      query: {
        bool: {
          should: [{ term: { _id: id } }, { term: { id } }],
          minimum_should_match: 1,
        },
      },
    });

    const hit = result.hits[0];
    if (!hit) return res.status(404).json({ error: "Alert not found" });

    return res.json({
      alert: normalizeAlert({ _id: hit._id, _source: hit._source }),
    });
  } catch (err) {
    return res.status(502).json({
      error: err instanceof Error ? err.message : "Failed to fetch alert",
    });
  }
});

export default router;
