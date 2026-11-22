import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { indexerSearch } from "../wazuh/indexer.js";
import { buildAlertQuery } from "../wazuh/query.js";

const router = Router();

function normalizeFim(hit: { _id: string; _source: Record<string, unknown> }) {
  const src = hit._source;
  const rule = (src.rule ?? {}) as Record<string, unknown>;
  const agent = (src.agent ?? {}) as Record<string, unknown>;
  const syscheck = (src.syscheck ?? {}) as Record<string, unknown>;
  const data = (src.data ?? {}) as Record<string, unknown>;

  const event = String(syscheck.event || data.event || "").toLowerCase();
  const path = String(syscheck.path || data.path || data.file || "");

  return {
    id: String(src.id ?? hit._id),
    indexId: hit._id,
    timestamp: String(src.timestamp || src["@timestamp"] || ""),
    agentId: String(agent.id ?? ""),
    agentName: String(agent.name ?? "unknown"),
    path,
    event: event || "change",
    user: String(syscheck.uname_after || syscheck.uname_before || ""),
    md5: String(syscheck.md5_after || syscheck.md5_before || ""),
    sha256: String(syscheck.sha256_after || syscheck.sha256_before || ""),
    ruleId: String(rule.id ?? ""),
    ruleDescription: String(rule.description ?? "File integrity event"),
    level: Number(rule.level ?? 0),
    fullLog: String(src.full_log ?? ""),
  };
}

router.get("/", requireAuth, async (req, res) => {
  try {
    const eventType = String(req.query.event ?? "").trim().toLowerCase();
    const built = buildAlertQuery({
      page: Number(req.query.page ?? 1),
      pageSize: Number(req.query.pageSize ?? 25),
      q: String(req.query.q ?? ""),
      agent: String(req.query.agent ?? ""),
      group: ["syscheck"],
      from: String(req.query.from ?? "") || undefined,
      to: String(req.query.to ?? "") || undefined,
      sort: String(req.query.sort ?? ""),
    });

    const must: Record<string, unknown>[] = [
      ...(built.query.match_all
        ? []
        : ((built.query as { bool?: { must?: Record<string, unknown>[] } }).bool?.must ?? [])),
      { terms: { "rule.groups": ["syscheck"] } },
    ];

    if (eventType) {
      must.push({
        bool: {
          should: [
            { term: { "syscheck.event": eventType } },
            { match: { "syscheck.event": eventType } },
          ],
          minimum_should_match: 1,
        },
      });
    }

    const result = await indexerSearch("wazuh-alerts-*", {
      from: built.from,
      size: built.pageSize,
      sort: [{ timestamp: { order: built.sortDir, unmapped_type: "date" } }],
      query: { bool: { must } },
      track_total_hits: true,
    });

    return res.json({
      page: built.page,
      pageSize: built.pageSize,
      total: result.total,
      note:
        result.total === 0
          ? "No FIM/syscheck events indexed yet. Enable syscheck on agents to populate this view."
          : null,
      events: result.hits.map((hit) =>
        normalizeFim({ _id: hit._id, _source: hit._source }),
      ),
    });
  } catch (err) {
    return res.status(502).json({
      error: err instanceof Error ? err.message : "Failed to fetch FIM events",
    });
  }
});

export default router;
