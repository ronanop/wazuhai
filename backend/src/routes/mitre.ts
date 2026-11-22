import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { indexerSearch } from "../wazuh/indexer.js";
import { normalizeAlert } from "../wazuh/normalize.js";
import { MITRE_TACTICS, MITRE_TECHNIQUES } from "../wazuh/mitreMatrix.js";

const router = Router();

router.get("/coverage", requireAuth, async (_req, res) => {
  try {
    const result = await indexerSearch("wazuh-alerts-*", {
      size: 0,
      query: { exists: { field: "rule.mitre.id" } },
      aggs: {
        techniques: {
          terms: { field: "rule.mitre.id", size: 100 },
        },
      },
    });

    const counts = new Map<string, number>();
    const buckets =
      (
        result.aggregations.techniques as {
          buckets?: Array<{ key: string; doc_count: number }>;
        }
      )?.buckets ?? [];
    for (const b of buckets) counts.set(String(b.key), b.doc_count);

    const base = [...MITRE_TECHNIQUES];
    for (const [id] of counts) {
      if (!base.some((t) => t.id === id)) {
        base.push({ id, name: id, tactic: "Observed" });
      }
    }

    const techniques = base.map((t) => ({
      ...t,
      alertCount: counts.get(t.id) ?? 0,
      covered: (counts.get(t.id) ?? 0) > 0,
    }));

    const tactics = [...MITRE_TACTICS, "Observed"].map((tactic) => {
      const items = techniques.filter((t) => t.tactic === tactic);
      return {
        tactic,
        total: items.length,
        covered: items.filter((t) => t.covered).length,
        techniques: items,
      };
    }).filter((t) => t.total > 0);

    return res.json({
      source: "wazuh-indexer",
      observedTechniques: buckets.length,
      coveredInMatrix: techniques.filter((t) => t.covered).length,
      matrixSize: techniques.length,
      tactics,
    });
  } catch (err) {
    return res.status(502).json({
      error: err instanceof Error ? err.message : "Failed to build MITRE coverage",
    });
  }
});

router.get("/technique/:id", requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const meta = MITRE_TECHNIQUES.find((t) => t.id === id);
    const result = await indexerSearch("wazuh-alerts-*", {
      size: 25,
      sort: [{ timestamp: { order: "desc", unmapped_type: "date" } }],
      query: { term: { "rule.mitre.id": id } },
      track_total_hits: true,
    });

    return res.json({
      technique: meta ?? { id, name: id, tactic: "Unknown" },
      total: result.total,
      alerts: result.hits.map((hit) => {
        const alert = normalizeAlert({ _id: hit._id, _source: hit._source });
        return { ...alert, raw: {} };
      }),
    });
  } catch (err) {
    return res.status(502).json({
      error: err instanceof Error ? err.message : "Failed to fetch technique alerts",
    });
  }
});

export default router;
