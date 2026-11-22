import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { wazuhApiGet } from "../wazuh/api.js";
import { indexerSearch } from "../wazuh/indexer.js";
import { normalizeAlert, normalizeVulnerability } from "../wazuh/normalize.js";

const router = Router();

function agentFilter(idOrName: string): Record<string, unknown> {
  return {
    bool: {
      should: [
        { term: { "agent.id": idOrName } },
        { term: { "agent.name": idOrName } },
        { match_phrase: { "agent.name": idOrName } },
      ],
      minimum_should_match: 1,
    },
  };
}

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

type ApiAgent = {
  id: string;
  name: string;
  ip?: string;
  status?: string;
  version?: string;
  lastKeepAlive?: string;
  dateAdd?: string;
  os?: { name?: string; uname?: string; platform?: string };
};

router.get("/", requireAuth, async (_req, res) => {
  try {
    try {
      const api = await wazuhApiGet<{
        data?: { affected_items?: ApiAgent[]; total_affected_items?: number };
      }>("/agents?limit=100");

      const items = api.data?.affected_items ?? [];
      return res.json({
        source: "wazuh-api",
        total: api.data?.total_affected_items ?? items.length,
        agents: items.map((a) => ({
          id: a.id,
          name: a.name,
          ip: a.ip ?? null,
          status: a.status ?? "unknown",
          version: a.version ?? null,
          lastKeepAlive: a.lastKeepAlive ?? null,
          os: a.os?.name || a.os?.uname || a.os?.platform || null,
        })),
        warning: null,
      });
    } catch (apiErr) {
      // Fallback: derive observed endpoints from alert telemetry
      const result = await indexerSearch("wazuh-alerts-*", {
        size: 0,
        query: { match_all: {} },
        aggs: {
          agents: {
            terms: { field: "agent.name", size: 50 },
            aggs: {
              agent_id: { terms: { field: "agent.id", size: 1 } },
              last_seen: { max: { field: "timestamp" } },
            },
          },
        },
      });

      const buckets =
        (
          result.aggregations.agents as {
            buckets?: Array<{
              key: string;
              doc_count: number;
              agent_id?: { buckets?: Array<{ key: string }> };
              last_seen?: { value_as_string?: string; value?: number };
            }>;
          }
        )?.buckets ?? [];

      const agents = buckets.map((b) => ({
        id: b.agent_id?.buckets?.[0]?.key ?? "—",
        name: b.key,
        ip: null as string | null,
        status: "observed",
        version: null as string | null,
        lastKeepAlive: b.last_seen?.value_as_string ?? null,
        os: null as string | null,
        alertCount: b.doc_count,
      }));

      return res.json({
        source: "wazuh-indexer-fallback",
        total: agents.length,
        agents,
        warning:
          apiErr instanceof Error
            ? `Wazuh API agents unavailable (${apiErr.message}). Showing endpoints observed in alert telemetry.`
            : "Wazuh API agents unavailable. Showing endpoints observed in alert telemetry.",
      });
    }
  } catch (err) {
    return res.status(502).json({
      error: err instanceof Error ? err.message : "Failed to fetch agents",
    });
  }
});

router.get("/:id/related", requireAuth, async (req, res) => {
  const id = String(req.params.id ?? "").trim();
  if (!id) return res.status(400).json({ error: "Agent id required" });

  const filter = agentFilter(id);

  const [alerts, vulnerabilities, fimEvents] = await Promise.all([
    indexerSearch("wazuh-alerts-*", {
      size: 8,
      sort: [{ timestamp: { order: "desc", unmapped_type: "date" } }],
      query: filter,
    })
      .then((result) =>
        result.hits.map((hit) => ({
          ...normalizeAlert({ _id: hit._id, _source: hit._source }),
          raw: {},
        })),
      )
      .catch(() => []),
    indexerSearch("wazuh-states-vulnerabilities-*", {
      size: 6,
      sort: [{ "vulnerability.detected_at": { order: "desc", unmapped_type: "date" } }],
      query: filter,
    })
      .then((result) =>
        result.hits.map((hit) => normalizeVulnerability({ _id: hit._id, _source: hit._source })),
      )
      .catch(() => []),
    indexerSearch("wazuh-alerts-*", {
      size: 6,
      sort: [{ timestamp: { order: "desc", unmapped_type: "date" } }],
      query: {
        bool: {
          must: [filter, { terms: { "rule.groups": ["syscheck"] } }],
        },
      },
    })
      .then((result) => result.hits.map((hit) => normalizeFim(hit)))
      .catch(() => []),
  ]);

  return res.json({ alerts, vulnerabilities, fimEvents });
});

export default router;
