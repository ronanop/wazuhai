import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  agentFilterClause,
  parseOptionalIso,
  parseSortDir,
  timestampRangeClause,
} from "../lib/listQuery.js";
import { indexerSearch } from "../wazuh/indexer.js";

const router = Router();

router.get("/summary", requireAuth, async (_req, res) => {
  try {
    const result = await indexerSearch("wazuh-alerts-*", {
      size: 50,
      sort: [{ timestamp: { order: "desc", unmapped_type: "date" } }],
      query: {
        bool: {
          must: [
            { term: { "rule.groups": "sca" } },
            { term: { "data.sca.type": "summary" } },
          ],
        },
      },
    });

    const summaries = result.hits.map((hit) => {
      const src = hit._source;
      const agent = (src.agent ?? {}) as Record<string, unknown>;
      const data = (src.data ?? {}) as Record<string, unknown>;
      const sca = (data.sca ?? {}) as Record<string, unknown>;
      return {
        indexId: hit._id,
        timestamp: String(src.timestamp || src["@timestamp"] || ""),
        agentId: String(agent.id ?? ""),
        agentName: String(agent.name ?? ""),
        policy: String(sca.policy ?? ""),
        policyId: String(sca.policy_id ?? ""),
        score: Number(sca.score ?? 0),
        passed: Number(sca.passed ?? 0),
        failed: Number(sca.failed ?? 0),
        invalid: Number(sca.invalid ?? 0),
        totalChecks: Number(sca.total_checks ?? 0),
        description: String(sca.description ?? ""),
      };
    });

    // de-dupe by agent+policy keeping latest
    const latest = new Map<string, (typeof summaries)[number]>();
    for (const s of summaries) {
      const key = `${s.agentId}:${s.policyId || s.policy}`;
      if (!latest.has(key)) latest.set(key, s);
    }

    return res.json({
      source: "wazuh-indexer",
      summaries: [...latest.values()],
    });
  } catch (err) {
    return res.status(502).json({
      error: err instanceof Error ? err.message : "Failed to fetch SCA summary",
    });
  }
});

router.get("/checks", requireAuth, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize ?? 25)));
    const from = (page - 1) * pageSize;
    const resultFilter = String(req.query.result ?? "").trim();
    const agent = String(req.query.agent ?? "").trim();
    const q = String(req.query.q ?? "").trim();
    const fromIso = parseOptionalIso(req.query.from);
    const toIso = parseOptionalIso(req.query.to);
    const sortDir = parseSortDir(req.query.sort);

    const must: Record<string, unknown>[] = [
      { term: { "rule.groups": "sca" } },
      { term: { "data.sca.type": "check" } },
    ];
    const agentClause = agentFilterClause(agent);
    if (agentClause) must.push(agentClause);
    if (resultFilter) must.push({ term: { "data.sca.check.result": resultFilter } });
    if (q) {
      must.push({
        multi_match: {
          query: q,
          fields: [
            "data.sca.check.title",
            "data.sca.check.description",
            "data.sca.policy",
            "agent.name",
          ],
        },
      });
    }
    const rangeClause = timestampRangeClause(fromIso, toIso);
    if (rangeClause) must.push(rangeClause);

    const result = await indexerSearch("wazuh-alerts-*", {
      from,
      size: pageSize,
      sort: [{ timestamp: { order: sortDir, unmapped_type: "date" } }],
      query: { bool: { must } },
      track_total_hits: true,
      aggs: {
        by_result: { terms: { field: "data.sca.check.result", size: 10 } },
      },
    });

    const checks = result.hits.map((hit) => {
      const src = hit._source;
      const agentObj = (src.agent ?? {}) as Record<string, unknown>;
      const data = (src.data ?? {}) as Record<string, unknown>;
      const sca = (data.sca ?? {}) as Record<string, unknown>;
      const check = (sca.check ?? {}) as Record<string, unknown>;
      return {
        indexId: hit._id,
        timestamp: String(src.timestamp || src["@timestamp"] || ""),
        agentId: String(agentObj.id ?? ""),
        agentName: String(agentObj.name ?? ""),
        policy: String(sca.policy ?? ""),
        checkId: String(check.id ?? ""),
        title: String(check.title ?? ""),
        description: String(check.description ?? ""),
        result: String(check.result ?? "unknown"),
        remediation: String(check.remediation ?? ""),
        rationale: String(check.rationale ?? ""),
        reason: String(check.reason ?? ""),
      };
    });

    const byResult =
      (
        result.aggregations.by_result as {
          buckets?: Array<{ key: string; doc_count: number }>;
        }
      )?.buckets?.map((b) => ({ result: b.key, count: b.doc_count })) ?? [];

    return res.json({
      page,
      pageSize,
      total: result.total,
      byResult,
      checks,
    });
  } catch (err) {
    return res.status(502).json({
      error: err instanceof Error ? err.message : "Failed to fetch SCA checks",
    });
  }
});

export default router;
