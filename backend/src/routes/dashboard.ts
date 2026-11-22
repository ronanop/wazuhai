import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { indexerCount, indexerSearch } from "../wazuh/indexer.js";
import { normalizeAlert, severityFromLevel } from "../wazuh/normalize.js";

const router = Router();

function alertRangeQuery(from?: string, to?: string): Record<string, unknown> {
  if (!from && !to) return { match_all: {} };
  const range: Record<string, string> = {};
  if (from) range.gte = from;
  if (to) range.lte = to;
  return { range: { timestamp: range } };
}

function withMust(
  base: Record<string, unknown>,
  extra: Record<string, unknown>[],
): Record<string, unknown> {
  if (base.match_all && extra.length === 0) return { match_all: {} };
  const must: Record<string, unknown>[] = [];
  if (!base.match_all) must.push(base);
  must.push(...extra);
  return { bool: { must } };
}

router.get("/summary", requireAuth, async (req, res) => {
  try {
    const from = String(req.query.from ?? "").trim() || undefined;
    const to = String(req.query.to ?? "").trim() || undefined;
    const rangeQuery = alertRangeQuery(from, to);

    const spanMs =
      from && to
        ? Math.max(1, new Date(to).getTime() - new Date(from).getTime())
        : 7 * 24 * 60 * 60 * 1000;
    const calendarInterval =
      spanMs <= 36 * 60 * 60 * 1000 ? "hour" : spanMs <= 14 * 24 * 60 * 60 * 1000 ? "day" : "week";

    const [
      alertCount,
      vulnCount,
      recent,
      severityAgg,
      agentAgg,
      timelineAgg,
      fimCount,
      malwareCount,
      scaCount,
      mitreAgg,
    ] = await Promise.all([
      indexerCount("wazuh-alerts-*", rangeQuery),
      indexerCount("wazuh-states-vulnerabilities-*"),
      indexerSearch("wazuh-alerts-*", {
        size: 8,
        sort: [{ timestamp: { order: "desc", unmapped_type: "date" } }],
        query: rangeQuery,
      }),
      indexerSearch("wazuh-alerts-*", {
        size: 0,
        query: rangeQuery,
        aggs: {
          by_level: {
            range: {
              field: "rule.level",
              ranges: [
                { key: "info", from: 0, to: 1 },
                { key: "low", from: 1, to: 4 },
                { key: "medium", from: 4, to: 8 },
                { key: "high", from: 8, to: 12 },
                { key: "critical", from: 12, to: 16 },
              ],
            },
          },
        },
      }),
      indexerSearch("wazuh-alerts-*", {
        size: 0,
        query: rangeQuery,
        aggs: {
          agents: {
            terms: { field: "agent.name", size: 8 },
          },
        },
      }),
      indexerSearch("wazuh-alerts-*", {
        size: 0,
        query: rangeQuery,
        aggs: {
          over_time: {
            date_histogram: {
              field: "timestamp",
              interval: calendarInterval === "hour" ? "1h" : calendarInterval === "week" ? "1w" : "1d",
              min_doc_count: 1,
            },
            aggs: {
              high_crit: {
                filter: { range: { "rule.level": { gte: 8 } } },
              },
            },
          },
        },
      }).catch((err) => {
        console.warn("dashboard timeline agg failed", err instanceof Error ? err.message : err);
        return { aggregations: {} as Record<string, unknown> };
      }),
      indexerCount(
        "wazuh-alerts-*",
        withMust(rangeQuery, [{ terms: { "rule.groups": ["syscheck"] } }]),
      ),
      indexerCount(
        "wazuh-alerts-*",
        withMust(rangeQuery, [
          { terms: { "rule.groups": ["malware", "virustotal", "yara", "rootcheck"] } },
        ]),
      ),
      indexerCount(
        "wazuh-alerts-*",
        withMust(rangeQuery, [{ terms: { "rule.groups": ["sca"] } }]),
      ).catch(() => 0),
      indexerSearch("wazuh-alerts-*", {
        size: 0,
        query: rangeQuery,
        aggs: {
          mitre_ids: {
            cardinality: { field: "rule.mitre.id" },
          },
        },
      }).catch(() => ({ aggregations: {} as Record<string, unknown> })),
    ]);

    const buckets =
      (
        severityAgg.aggregations.by_level as {
          buckets?: Array<{ key: string; doc_count: number }>;
        }
      )?.buckets ?? [];

    const severity = {
      info: 0,
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };
    for (const b of buckets) {
      if (b.key in severity) {
        severity[b.key as keyof typeof severity] = b.doc_count;
      }
    }

    const agents =
      (
        agentAgg.aggregations.agents as {
          buckets?: Array<{ key: string; doc_count: number }>;
        }
      )?.buckets?.map((b) => ({ name: b.key, alertCount: b.doc_count })) ?? [];

    const recentAlerts = recent.hits.map((hit) => {
      const alert = normalizeAlert({ _id: hit._id, _source: hit._source });
      alert.severity = severityFromLevel(alert.level);
      return { ...alert, raw: {} };
    });

    const mitreTechniques = Number(
      (mitreAgg.aggregations.mitre_ids as { value?: number } | undefined)?.value ?? 0,
    );

    const overTimeRaw = timelineAgg.aggregations?.over_time as
      | {
          buckets?: Array<{
            key_as_string?: string;
            key?: number;
            doc_count: number;
            high_crit?: { doc_count?: number };
          }>;
        }
      | undefined;
    const timeline =
      overTimeRaw?.buckets?.map((b) => ({
        at: b.key_as_string || (typeof b.key === "number" ? new Date(b.key).toISOString() : ""),
        alerts: b.doc_count,
        highCritical: b.high_crit?.doc_count ?? 0,
      })) ?? [];

    return res.json({
      source: "wazuh-indexer",
      range: { from: from ?? null, to: to ?? null },
      totals: {
        alerts: alertCount,
        vulnerabilities: vulnCount,
        agentsObserved: agents.length,
      },
      severity,
      agents,
      timeline,
      recentAlerts,
      moduleCounts: {
        fim: fimCount,
        malware: malwareCount,
        sca: scaCount,
        mitreTechniques,
        complianceFrameworks: 6,
      },
    });
  } catch (err) {
    return res.status(502).json({
      error: err instanceof Error ? err.message : "Failed to build dashboard summary",
    });
  }
});

export default router;
