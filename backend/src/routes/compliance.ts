import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { indexerSearch } from "../wazuh/indexer.js";
import { normalizeAlert } from "../wazuh/normalize.js";
import { FRAMEWORKS, getFramework } from "../wazuh/complianceCatalog.js";

const router = Router();

function bucketsOf(aggs: Record<string, unknown>, key: string) {
  return (
    (aggs[key] as { buckets?: Array<{ key: string; doc_count: number }> })?.buckets ?? []
  );
}

router.get("/frameworks", requireAuth, async (_req, res) => {
  try {
    const aggs: Record<string, unknown> = {};
    for (const fw of FRAMEWORKS) {
      aggs[fw.id] = {
        filter: { exists: { field: fw.alertField } },
        aggs: {
          controls: { terms: { field: fw.alertField, size: 50 } },
          high: {
            filter: { range: { "rule.level": { gte: 8 } } },
          },
        },
      };
    }

    const result = await indexerSearch("wazuh-alerts-*", {
      size: 0,
      query: { match_all: {} },
      aggs,
    });

    const frameworks = FRAMEWORKS.map((fw) => {
      const block = result.aggregations[fw.id] as {
        doc_count?: number;
        controls?: { buckets?: Array<{ key: string; doc_count: number }> };
        high?: { doc_count?: number };
      };
      const controls = block?.controls?.buckets ?? [];
      return {
        id: fw.id,
        name: fw.name,
        shortName: fw.shortName,
        description: fw.description,
        disclaimer: fw.disclaimer,
        alertCount: block?.doc_count ?? 0,
        controlCount: controls.length,
        highSeverityCount: block?.high?.doc_count ?? 0,
        topControls: controls.slice(0, 5).map((b) => ({
          id: String(b.key),
          alertCount: b.doc_count,
        })),
      };
    });

    return res.json({
      source: "wazuh-indexer",
      note: "Evidence-based assessment from Wazuh rule tags. Not certification.",
      frameworks,
    });
  } catch (err) {
    return res.status(502).json({
      error: err instanceof Error ? err.message : "Failed to load compliance frameworks",
    });
  }
});

router.get("/frameworks/:id/controls", requireAuth, async (req, res) => {
  try {
    const fw = getFramework(req.params.id);
    if (!fw) return res.status(404).json({ error: "Unknown framework" });

    const result = await indexerSearch("wazuh-alerts-*", {
      size: 0,
      query: { exists: { field: fw.alertField } },
      aggs: {
        controls: {
          terms: { field: fw.alertField, size: 100 },
          aggs: {
            high: { filter: { range: { "rule.level": { gte: 8 } } } },
            agents: { cardinality: { field: "agent.name" } },
            latest: {
              top_hits: {
                size: 1,
                sort: [{ timestamp: { order: "desc", unmapped_type: "date" } }],
                _source: ["timestamp", "rule.description", "agent.name"],
              },
            },
          },
        },
      },
    });

    const controls = bucketsOf(result.aggregations, "controls").map((b) => {
      const sub = b as unknown as {
        key: string;
        doc_count: number;
        high?: { doc_count?: number };
        agents?: { value?: number };
        latest?: {
          hits?: {
            hits?: Array<{ _source?: Record<string, unknown> }>;
          };
        };
      };
      const latestSrc = sub.latest?.hits?.hits?.[0]?._source ?? {};
      const rule = (latestSrc.rule ?? {}) as Record<string, unknown>;
      const agent = (latestSrc.agent ?? {}) as Record<string, unknown>;
      return {
        id: String(sub.key),
        alertCount: sub.doc_count,
        highSeverityCount: sub.high?.doc_count ?? 0,
        agentCount: sub.agents?.value ?? 0,
        latestAlertAt: String(latestSrc.timestamp ?? ""),
        latestRule: String(rule.description ?? ""),
        latestAgent: String(agent.name ?? ""),
      };
    });

    return res.json({
      framework: {
        id: fw.id,
        name: fw.name,
        shortName: fw.shortName,
        description: fw.description,
        disclaimer: fw.disclaimer,
      },
      controls,
    });
  } catch (err) {
    return res.status(502).json({
      error: err instanceof Error ? err.message : "Failed to load controls",
    });
  }
});

router.get("/frameworks/:id/controls/:controlId/evidence", requireAuth, async (req, res) => {
  try {
    const fw = getFramework(req.params.id);
    if (!fw) return res.status(404).json({ error: "Unknown framework" });
    const controlId = decodeURIComponent(req.params.controlId);
    const page = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize ?? 20)));
    const from = (page - 1) * pageSize;

    const [alertsResult, scaResult] = await Promise.all([
      indexerSearch("wazuh-alerts-*", {
        from,
        size: pageSize,
        sort: [{ timestamp: { order: "desc", unmapped_type: "date" } }],
        query: { term: { [fw.alertField]: controlId } },
        track_total_hits: true,
      }),
      fw.scaField
        ? indexerSearch("wazuh-alerts-*", {
            size: 15,
            sort: [{ timestamp: { order: "desc", unmapped_type: "date" } }],
            query: {
              bool: {
                must: [
                  { term: { "rule.groups": "sca" } },
                  { term: { "data.sca.type": "check" } },
                  {
                    bool: {
                      should: [
                        { term: { [fw.scaField]: controlId } },
                        { wildcard: { [fw.scaField]: `*${controlId}*` } },
                        { match_phrase: { [fw.scaField]: controlId } },
                      ],
                      minimum_should_match: 1,
                    },
                  },
                ],
              },
            },
            track_total_hits: true,
          })
        : Promise.resolve({ total: 0, hits: [], aggregations: {} }),
    ]);

    const alerts = alertsResult.hits.map((hit) => {
      const a = normalizeAlert({ _id: hit._id, _source: hit._source });
      return { ...a, raw: {} };
    });

    const scaChecks = scaResult.hits.map((hit) => {
      const src = hit._source;
      const agent = (src.agent ?? {}) as Record<string, unknown>;
      const data = (src.data ?? {}) as Record<string, unknown>;
      const sca = (data.sca ?? {}) as Record<string, unknown>;
      const check = (sca.check ?? {}) as Record<string, unknown>;
      return {
        indexId: hit._id,
        timestamp: String(src.timestamp || src["@timestamp"] || ""),
        agentName: String(agent.name ?? ""),
        policy: String(sca.policy ?? ""),
        title: String(check.title ?? ""),
        result: String(check.result ?? ""),
        remediation: String(check.remediation ?? ""),
      };
    });

    return res.json({
      framework: {
        id: fw.id,
        name: fw.name,
        shortName: fw.shortName,
        disclaimer: fw.disclaimer,
      },
      controlId,
      page,
      pageSize,
      alertTotal: alertsResult.total,
      alerts,
      scaTotal: scaResult.total,
      scaChecks,
    });
  } catch (err) {
    return res.status(502).json({
      error: err instanceof Error ? err.message : "Failed to load evidence",
    });
  }
});

export default router;
