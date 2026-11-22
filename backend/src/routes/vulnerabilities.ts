import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  agentFilterClause,
  parseOptionalIso,
  parseSortDir,
  timestampRangeClause,
} from "../lib/listQuery.js";
import { indexerSearch } from "../wazuh/indexer.js";
import { normalizeVulnerability } from "../wazuh/normalize.js";

const router = Router();

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
            "vulnerability.id",
            "vulnerability.description",
            "package.name",
            "agent.name",
          ],
        },
      });
    }
    if (severity) {
      filters.push({
        term: { "vulnerability.severity": severity },
      });
    }
    const agentClause = agentFilterClause(agent);
    if (agentClause) filters.push(agentClause);
    const rangeClause = timestampRangeClause(fromIso, toIso, "vulnerability.detected_at");
    if (rangeClause) filters.push(rangeClause);

    const query =
      filters.length > 0 ? { bool: { must: filters } } : { match_all: {} };

    const result = await indexerSearch("wazuh-states-vulnerabilities-*", {
      from,
      size: pageSize,
      query,
      track_total_hits: true,
      sort: [{ "vulnerability.detected_at": { order: sortDir, unmapped_type: "date" } }],
    });

    const severityAgg = await indexerSearch("wazuh-states-vulnerabilities-*", {
      size: 0,
      query: { match_all: {} },
      aggs: {
        by_severity: {
          terms: { field: "vulnerability.severity", size: 10 },
        },
      },
    });

    const summary =
      (
        severityAgg.aggregations.by_severity as {
          buckets?: Array<{ key: string; doc_count: number }>;
        }
      )?.buckets?.map((b) => ({ severity: b.key, count: b.doc_count })) ?? [];

    return res.json({
      page,
      pageSize,
      total: result.total,
      summary,
      vulnerabilities: result.hits.map((hit) =>
        normalizeVulnerability({ _id: hit._id, _source: hit._source }),
      ),
    });
  } catch (err) {
    return res.status(502).json({
      error: err instanceof Error ? err.message : "Failed to fetch vulnerabilities",
    });
  }
});

export default router;
