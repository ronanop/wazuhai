import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { config } from "../lib/config.js";
import {
  OpenCtiError,
  listIndicators,
  listRecentFeed,
  listThreatLandscape,
  openctiAuthHeaders,
  openctiDashboard,
  openctiHealth,
  openctiStreamUrl,
  openctiSummary,
} from "../opencti/client.js";
import {
  getCatalogEntity,
  getEntityRelationships,
  listAttackPatternsForCoverage,
  listCatalogEntities,
} from "../opencti/entities.js";
import { observableValues, parseStixPattern } from "../opencti/pattern.js";
import { ENTITY_CATALOG } from "../opencti/catalog.js";
import { normalizeStreamEvent } from "../opencti/normalize.js";
import { indexerSearch } from "../wazuh/indexer.js";
import { normalizeAlert } from "../wazuh/normalize.js";
import { buildAlertQuery } from "../wazuh/query.js";
import { MITRE_TACTICS, MITRE_TECHNIQUES } from "../wazuh/mitreMatrix.js";

const router = Router();

function handleOpenCtiError(res: import("express").Response, err: unknown) {
  if (err instanceof OpenCtiError) {
    return res.status(err.status).json({ error: err.message });
  }
  return res.status(502).json({
    error: err instanceof Error ? err.message : "OpenCTI request failed",
  });
}

router.get("/health", requireAuth, async (_req, res) => {
  try {
    if (!config.opencti.token) {
      return res.status(503).json({
        ok: false,
        error: "OPENCTI_TOKEN is not configured",
        uiUrl: config.opencti.uiUrl,
        streamConfigured: false,
      });
    }
    const health = await openctiHealth();
    return res.status(health.ok ? 200 : 503).json(health);
  } catch (err) {
    return handleOpenCtiError(res, err);
  }
});

router.get("/summary", requireAuth, async (_req, res) => {
  try {
    const summary = await openctiSummary();
    return res.json({
      summary,
      uiUrl: config.opencti.uiUrl,
      streamConfigured: Boolean(config.opencti.streamId),
    });
  } catch (err) {
    return handleOpenCtiError(res, err);
  }
});

router.get("/dashboard", requireAuth, async (req, res) => {
  try {
    const windowDays = Number(req.query.windowDays ?? 90);
    const dashboard = await openctiDashboard(windowDays);
    return res.json({
      dashboard,
      uiUrl: config.opencti.uiUrl,
      streamConfigured: Boolean(config.opencti.streamId),
    });
  } catch (err) {
    return handleOpenCtiError(res, err);
  }
});

router.get("/indicators", requireAuth, async (req, res) => {
  try {
    const first = Math.min(100, Math.max(1, Number(req.query.pageSize ?? req.query.first ?? 25)));
    const search = String(req.query.q ?? "").trim();
    const sort = String(req.query.sort ?? "desc").toLowerCase() === "asc" ? "asc" : "desc";
    const after = String(req.query.after ?? "").trim() || undefined;
    const result = await listIndicators({
      first,
      after,
      search: search || undefined,
      orderMode: sort,
    });
    return res.json(result);
  } catch (err) {
    return handleOpenCtiError(res, err);
  }
});

router.get("/threats", requireAuth, async (req, res) => {
  try {
    const limit = Math.min(40, Math.max(1, Number(req.query.limit ?? 12)));
    const threats = await listThreatLandscape(limit);
    return res.json(threats);
  } catch (err) {
    return handleOpenCtiError(res, err);
  }
});

router.get("/feed", requireAuth, async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 40)));
    const indicators = await listRecentFeed(limit);
    const events = indicators.map((ind) => ({
      id: ind.id,
      eventId: ind.id,
      eventType: "create",
      entityType: "indicator",
      name: ind.name,
      message: ind.pattern || ind.name,
      timestamp: ind.createdAt || ind.modifiedAt,
      score: ind.score ?? ind.confidence,
      labels: ind.labels.map((l) => l.value),
      regions: [] as string[],
      raw: ind.raw,
    }));
    return res.json({ events, mode: "poll" });
  } catch (err) {
    return handleOpenCtiError(res, err);
  }
});

router.get("/catalog", requireAuth, (_req, res) => {
  return res.json({
    types: Object.values(ENTITY_CATALOG).map((c) => ({
      type: c.type,
      slug: c.routeSlug,
      label: c.label,
      entityType: c.entityType,
    })),
    uiUrl: config.opencti.uiUrl,
  });
});

router.get("/entities/:type", requireAuth, async (req, res) => {
  try {
    const result = await listCatalogEntities({
      type: req.params.type,
      first: Number(req.query.pageSize ?? req.query.first ?? 25),
      after: String(req.query.after ?? "").trim() || undefined,
      search: String(req.query.q ?? "").trim() || undefined,
    });
    return res.json({
      ...result,
      uiUrl: config.opencti.uiUrl,
    });
  } catch (err) {
    return handleOpenCtiError(res, err);
  }
});

router.get("/entities/:type/:id", requireAuth, async (req, res) => {
  try {
    const entity = await getCatalogEntity(req.params.type, req.params.id);
    return res.json({ entity, uiUrl: config.opencti.uiUrl });
  } catch (err) {
    return handleOpenCtiError(res, err);
  }
});

router.get("/entities/:type/:id/relationships", requireAuth, async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 60)));
    const graph = await getEntityRelationships(req.params.id, limit);
    return res.json(graph);
  } catch (err) {
    return handleOpenCtiError(res, err);
  }
});

router.get("/indicators/:id/sightings", requireAuth, async (req, res) => {
  try {
    const entity = await getCatalogEntity("indicators", req.params.id);
    const pattern = entity.pattern || "";
    const observables = parseStixPattern(pattern);
    const values = observableValues(observables);
    if (!values.length) {
      return res.json({
        indicatorId: entity.id,
        name: entity.name,
        observables: [],
        total: 0,
        alerts: [],
      });
    }

    const built = buildAlertQuery({
      page: 1,
      pageSize: Math.min(50, Math.max(1, Number(req.query.pageSize ?? 25))),
      iocValues: values,
      sort: "desc",
    });

    let total = 0;
    let alerts: ReturnType<typeof normalizeAlert>[] = [];
    try {
      const result = await indexerSearch("wazuh-alerts-*", {
        from: built.from,
        size: built.pageSize,
        sort: [{ timestamp: { order: built.sortDir, unmapped_type: "date" } }],
        query: built.query,
        track_total_hits: true,
      });
      total = result.total;
      alerts = result.hits.map((hit) =>
        normalizeAlert({ _id: hit._id, _source: hit._source }),
      );
    } catch {
      // Indexer may be down — still return parsed observables
      total = 0;
      alerts = [];
    }

    return res.json({
      indicatorId: entity.id,
      name: entity.name,
      observables,
      total,
      alerts: alerts.map((a) => ({ ...a, raw: {} })),
    });
  } catch (err) {
    return handleOpenCtiError(res, err);
  }
});

router.get("/attack-coverage", requireAuth, async (_req, res) => {
  try {
    const [openctiPatterns, wazuhAgg] = await Promise.all([
      listAttackPatternsForCoverage(400).catch(() => [] as Array<{ id: string; name: string; mitreId: string | null }>),
      indexerSearch("wazuh-alerts-*", {
        size: 0,
        query: { exists: { field: "rule.mitre.id" } },
        aggs: {
          techniques: {
            terms: { field: "rule.mitre.id", size: 200 },
          },
        },
      }).catch(() => ({
        aggregations: { techniques: { buckets: [] as Array<{ key: string; doc_count: number }> } },
        total: 0,
        hits: [],
      })),
    ]);

    const wazuhCounts = new Map<string, number>();
    const buckets =
      (
        wazuhAgg.aggregations?.techniques as {
          buckets?: Array<{ key: string; doc_count: number }>;
        }
      )?.buckets ?? [];
    for (const b of buckets) wazuhCounts.set(String(b.key).toUpperCase(), b.doc_count);

    const openctiByMitre = new Map<string, { id: string; name: string; mitreId: string }>();
    for (const p of openctiPatterns) {
      if (!p.mitreId) continue;
      const mid = p.mitreId.toUpperCase();
      if (!openctiByMitre.has(mid)) {
        openctiByMitre.set(mid, { id: p.id, name: p.name, mitreId: mid });
      }
    }

    const base = [...MITRE_TECHNIQUES];
    const seen = new Set(base.map((t) => t.id.toUpperCase()));
    for (const id of [...wazuhCounts.keys(), ...openctiByMitre.keys()]) {
      if (!seen.has(id)) {
        base.push({
          id,
          name: openctiByMitre.get(id)?.name ?? id,
          tactic: "Observed",
        });
        seen.add(id);
      }
    }

    type State = "both" | "opencti_only" | "wazuh_only" | "gap";
    const techniques = base.map((t) => {
      const id = t.id.toUpperCase();
      const alertCount = wazuhCounts.get(id) ?? 0;
      const octi = openctiByMitre.get(id);
      const inOpencti = Boolean(octi);
      const inWazuh = alertCount > 0;
      let state: State = "gap";
      if (inOpencti && inWazuh) state = "both";
      else if (inOpencti) state = "opencti_only";
      else if (inWazuh) state = "wazuh_only";
      return {
        id,
        name: octi?.name || t.name,
        tactic: t.tactic,
        alertCount,
        state,
        openctiId: octi?.id ?? null,
      };
    });

    const tactics = [...MITRE_TACTICS, "Observed"]
      .map((tactic) => {
        const items = techniques.filter((t) => t.tactic === tactic);
        return {
          tactic,
          total: items.length,
          both: items.filter((t) => t.state === "both").length,
          openctiOnly: items.filter((t) => t.state === "opencti_only").length,
          wazuhOnly: items.filter((t) => t.state === "wazuh_only").length,
          gap: items.filter((t) => t.state === "gap").length,
          techniques: items,
        };
      })
      .filter((t) => t.total > 0);

    return res.json({
      source: "opencti+wazuh",
      openctiPatterns: openctiPatterns.length,
      wazuhObserved: buckets.length,
      both: techniques.filter((t) => t.state === "both").length,
      openctiOnly: techniques.filter((t) => t.state === "opencti_only").length,
      wazuhOnly: techniques.filter((t) => t.state === "wazuh_only").length,
      gap: techniques.filter((t) => t.state === "gap").length,
      tactics,
      uiUrl: config.opencti.uiUrl,
    });
  } catch (err) {
    return handleOpenCtiError(res, err);
  }
});

router.get("/stream", requireAuth, async (req, res) => {
  if (!config.opencti.token) {
    return res.status(503).json({ error: "OPENCTI_TOKEN is not configured" });
  }

  const from = String(req.query.from ?? "").trim();
  let upstreamUrl = openctiStreamUrl();
  if (from) {
    upstreamUrl += `${upstreamUrl.includes("?") ? "&" : "?"}from=${encodeURIComponent(from)}`;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  const writeEvent = (event: string, data: unknown) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  writeEvent("status", {
    mode: "streaming",
    streamConfigured: Boolean(config.opencti.streamId),
    uiUrl: config.opencti.uiUrl,
  });

  const heartbeat = setInterval(() => {
    try {
      res.write(`: ping ${Date.now()}\n\n`);
    } catch {
      /* closed */
    }
  }, 15000);

  let closed = false;
  const abort = new AbortController();

  const cleanup = () => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    abort.abort();
  };

  req.on("close", cleanup);
  req.on("aborted", cleanup);

  try {
    const upstream = await fetch(upstreamUrl, {
      headers: openctiAuthHeaders(),
      signal: abort.signal,
    });

    if (!upstream.ok || !upstream.body) {
      writeEvent("error", {
        message: `OpenCTI stream HTTP ${upstream.status}`,
      });
      cleanup();
      res.end();
      return;
    }

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (!closed) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const chunks = buffer.split(/\n\n/);
      buffer = chunks.pop() ?? "";

      for (const chunk of chunks) {
        const lines = chunk.split(/\n/);
        let id = "";
        let event = "message";
        const dataLines: string[] = [];
        for (const line of lines) {
          if (line.startsWith("id:")) id = line.slice(3).trim();
          else if (line.startsWith("event:")) event = line.slice(6).trim();
          else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
        }
        if (!dataLines.length) continue;
        let parsed: Record<string, unknown> = {};
        try {
          parsed = JSON.parse(dataLines.join("\n")) as Record<string, unknown>;
        } catch {
          continue;
        }
        const normalized = normalizeStreamEvent({ id, event, data: parsed });
        if (!normalized) continue;
        // Prefer external CTI noise reduction: skip purely internal admin events when scope is internal
        if (String(parsed.scope ?? "") === "internal") continue;
        writeEvent("threat", normalized);
      }
    }
  } catch (err) {
    if (!closed) {
      writeEvent("error", {
        message: err instanceof Error ? err.message : "Stream failed",
      });
    }
  } finally {
    cleanup();
    if (!res.writableEnded) res.end();
  }
});

export default router;
