import { config } from "../lib/config.js";
import {
  normalizeIndicator,
  normalizeThreatEntity,
  type ThreatActorLike,
  type ThreatIndicator,
} from "./normalize.js";

export class OpenCtiError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

function requireOpenCtiConfig() {
  if (!config.opencti.token) {
    throw new OpenCtiError("OPENCTI_TOKEN is not configured", 503);
  }
  return config.opencti;
}

export async function openctiGraphql<T = Record<string, unknown>>(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  const { url, token } = requireOpenCtiConfig();
  let res: Response;
  try {
    res = await fetch(`${url}/graphql`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query, variables }),
    });
  } catch (err) {
    throw new OpenCtiError(
      err instanceof Error ? `OpenCTI unreachable: ${err.message}` : "OpenCTI unreachable",
      503,
    );
  }

  const body = (await res.json().catch(() => ({}))) as {
    data?: T;
    errors?: Array<{ message?: string }>;
  };

  if (!res.ok) {
    throw new OpenCtiError(
      body.errors?.[0]?.message || `OpenCTI HTTP ${res.status}`,
      res.status >= 500 ? 502 : res.status,
    );
  }
  if (body.errors?.length) {
    throw new OpenCtiError(body.errors[0]?.message || "OpenCTI GraphQL error", 502);
  }
  if (!body.data) {
    throw new OpenCtiError("OpenCTI returned empty data", 502);
  }
  return body.data;
}

export async function openctiHealth(): Promise<{
  ok: boolean;
  version: string | null;
  uiUrl: string;
  streamConfigured: boolean;
}> {
  const { uiUrl, streamId } = requireOpenCtiConfig();
  try {
    const data = await openctiGraphql<{ about: { version?: string } }>(`
      query About {
        about { version }
      }
    `);
    return {
      ok: true,
      version: data.about?.version ?? null,
      uiUrl,
      streamConfigured: Boolean(streamId),
    };
  } catch (err) {
    if (err instanceof OpenCtiError && err.status === 503 && !config.opencti.token) {
      throw err;
    }
    return {
      ok: false,
      version: null,
      uiUrl,
      streamConfigured: Boolean(streamId),
    };
  }
}

// OpenCTI 6.x: objectLabel is [Label!]!, not a RelConnection
const INDICATOR_NODE = `
  id
  standard_id
  name
  pattern_type
  pattern
  valid_from
  valid_until
  confidence
  created
  modified
  x_opencti_score
  objectLabel { value color }
`;

export async function listIndicators(params: {
  first?: number;
  after?: string;
  search?: string;
  orderMode?: "asc" | "desc";
}): Promise<{ indicators: ThreatIndicator[]; total: number; endCursor: string | null }> {
  const first = Math.min(100, Math.max(1, params.first ?? 25));
  const data = await openctiGraphql<{
    indicators: {
      edges: Array<{ node: Record<string, unknown> }>;
      pageInfo: { globalCount?: number; endCursor?: string; hasNextPage?: boolean };
    };
  }>(
    `
    query Indicators($first: Int, $after: ID, $orderMode: OrderingMode, $search: String) {
      indicators(
        first: $first
        after: $after
        orderBy: created
        orderMode: $orderMode
        search: $search
      ) {
        edges { node { ${INDICATOR_NODE} } }
        pageInfo { globalCount endCursor hasNextPage }
      }
    }
  `,
    {
      first,
      after: params.after || null,
      orderMode: params.orderMode === "asc" ? "asc" : "desc",
      search: params.search?.trim() || null,
    },
  );

  return {
    indicators: data.indicators.edges.map((e) => normalizeIndicator(e.node)),
    total: Number(data.indicators.pageInfo.globalCount ?? data.indicators.edges.length),
    endCursor: data.indicators.pageInfo.endCursor ?? null,
  };
}

async function listEntities(
  field: "malwares" | "intrusionSets" | "reports" | "campaigns",
  entityType: string,
  first = 20,
): Promise<ThreatActorLike[]> {
  const data = await openctiGraphql<Record<string, { edges: Array<{ node: Record<string, unknown> }> }>>(
    `
    query ThreatList($first: Int) {
      ${field}(first: $first, orderBy: created, orderMode: desc) {
        edges {
          node {
            id
            name
            description
            created
            modified
            ... on Malware { aliases }
            ... on IntrusionSet { aliases }
            ... on Campaign { aliases }
            objectLabel { value color }
          }
        }
      }
    }
  `,
    { first },
  ).catch(async () => {
    // Minimal fallback if fragments / ordering differ
    const fallback = await openctiGraphql<
      Record<string, { edges: Array<{ node: Record<string, unknown> }> }>
    >(
      `
      query ThreatListFallback($first: Int) {
        ${field}(first: $first, orderBy: created, orderMode: desc) {
          edges {
            node {
              id
              name
              description
              created
              modified
              objectLabel { value color }
            }
          }
        }
      }
    `,
      { first },
    );
    return fallback;
  });

  return (data[field]?.edges ?? []).map((e) => normalizeThreatEntity(e.node, entityType));
}

export async function listThreatLandscape(limit = 12): Promise<{
  malwares: ThreatActorLike[];
  intrusionSets: ThreatActorLike[];
  campaigns: ThreatActorLike[];
  reports: ThreatActorLike[];
}> {
  const [malwares, intrusionSets, campaigns, reports] = await Promise.all([
    listEntities("malwares", "Malware", limit),
    listEntities("intrusionSets", "Intrusion-Set", limit),
    listEntities("campaigns", "Campaign", limit).catch(() => [] as ThreatActorLike[]),
    listEntities("reports", "Report", limit).catch(() => [] as ThreatActorLike[]),
  ]);
  return { malwares, intrusionSets, campaigns, reports };
}

export async function openctiSummary(): Promise<{
  indicators: number;
  malwares: number;
  intrusionSets: number;
  reports: number;
  campaigns: number;
  last24hIndicators: number;
}> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const filters = {
    mode: "and",
    filters: [
      {
        key: "created_at",
        values: [since],
        operator: "gt",
        mode: "or",
      },
    ],
    filterGroups: [],
  };

  const data = await openctiGraphql<{
    indicators: { pageInfo: { globalCount?: number } };
    malwares: { pageInfo: { globalCount?: number } };
    intrusionSets: { pageInfo: { globalCount?: number } };
    reports: { pageInfo: { globalCount?: number } };
    campaigns?: { pageInfo: { globalCount?: number } };
    recentIndicators: { pageInfo: { globalCount?: number } };
  }>(
    `
    query Summary($filters: FilterGroup) {
      indicators(first: 1) { pageInfo { globalCount } }
      malwares(first: 1) { pageInfo { globalCount } }
      intrusionSets(first: 1) { pageInfo { globalCount } }
      reports(first: 1) { pageInfo { globalCount } }
      campaigns(first: 1) { pageInfo { globalCount } }
      recentIndicators: indicators(first: 1, filters: $filters) { pageInfo { globalCount } }
    }
  `,
    { filters },
  ).catch(async () => {
    const basic = await openctiGraphql<{
      indicators: { pageInfo: { globalCount?: number } };
      malwares: { pageInfo: { globalCount?: number } };
      intrusionSets: { pageInfo: { globalCount?: number } };
      reports: { pageInfo: { globalCount?: number } };
    }>(`
      query SummaryBasic {
        indicators(first: 1) { pageInfo { globalCount } }
        malwares(first: 1) { pageInfo { globalCount } }
        intrusionSets(first: 1) { pageInfo { globalCount } }
        reports(first: 1) { pageInfo { globalCount } }
      }
    `);
    return {
      ...basic,
      campaigns: { pageInfo: { globalCount: 0 } },
      recentIndicators: { pageInfo: { globalCount: 0 } },
    };
  });

  return {
    indicators: Number(data.indicators?.pageInfo?.globalCount ?? 0),
    malwares: Number(data.malwares?.pageInfo?.globalCount ?? 0),
    intrusionSets: Number(data.intrusionSets?.pageInfo?.globalCount ?? 0),
    reports: Number(data.reports?.pageInfo?.globalCount ?? 0),
    campaigns: Number(data.campaigns?.pageInfo?.globalCount ?? 0),
    last24hIndicators: Number(data.recentIndicators?.pageInfo?.globalCount ?? 0),
  };
}

export async function listRecentFeed(limit = 40): Promise<ThreatIndicator[]> {
  const res = await listIndicators({ first: limit, orderMode: "desc" });
  return res.indicators;
}

export type DashboardNamedCount = {
  id: string;
  name: string;
  entityType: string;
  count: number;
};

export type OpenCtiDashboard = {
  windowDays: number;
  summary: {
    intrusionSets: number;
    malwares: number;
    reports: number;
    indicators: number;
    campaigns: number;
    relationships: number;
    last24h: {
      intrusionSets: number;
      malwares: number;
      reports: number;
      indicators: number;
    };
  };
  distribution: Array<{ label: string; value: number }>;
  activeThreats: DashboardNamedCount[];
  activeMalware: DashboardNamedCount[];
  targetedVictims: DashboardNamedCount[];
  countries: DashboardNamedCount[];
  vulnerabilities: DashboardNamedCount[];
  relationshipTimeline: Array<{ date: string; label: string; count: number }>;
  recentReports: ThreatActorLike[];
  activeLabels: Array<{ value: string; color?: string; count: number }>;
};

type RelNode = {
  id?: string;
  name?: string;
  entity_type?: string;
  value?: string;
  color?: string;
};

function bumpNamed(
  map: Map<string, DashboardNamedCount>,
  node: RelNode | null | undefined,
  allowTypes?: string[],
) {
  if (!node?.name || !node.id) return;
  if (allowTypes && node.entity_type && !allowTypes.includes(node.entity_type)) return;
  const cur = map.get(node.id) ?? {
    id: node.id,
    name: node.name,
    entityType: node.entity_type || "Unknown",
    count: 0,
  };
  cur.count += 1;
  map.set(node.id, cur);
}

function topNamed(map: Map<string, DashboardNamedCount>, limit: number): DashboardNamedCount[] {
  return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, limit);
}

function createdSinceFilter(iso: string) {
  return {
    mode: "and",
    filters: [{ key: "created", values: [iso], operator: "gt", mode: "or" }],
    filterGroups: [],
  };
}

function monthBuckets(days: number): Array<{ date: string; label: string; count: number }> {
  const buckets: Array<{ date: string; label: string; count: number }> = [];
  const now = new Date();
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  while (cursor <= end) {
    const key = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`;
    buckets.push({
      date: key,
      label: cursor.toLocaleString("en", { month: "short", year: "numeric", timeZone: "UTC" }),
      count: 0,
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return buckets;
}

export async function openctiDashboard(windowDays = 90): Promise<OpenCtiDashboard> {
  const days = Math.min(365, Math.max(30, windowDays));
  const sinceWindow = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const REL_FROM = `
    ... on IntrusionSet { id name entity_type }
    ... on ThreatActorGroup { id name entity_type }
    ... on Campaign { id name entity_type }
    ... on Malware { id name entity_type }
    ... on Organization { id name entity_type }
    ... on Sector { id name entity_type }
    ... on Country { id name entity_type }
    ... on Identity { id name entity_type }
  `;
  const REL_TO = `
    ... on Malware { id name entity_type }
    ... on Tool { id name entity_type }
    ... on AttackPattern { id name entity_type }
    ... on Country { id name entity_type }
    ... on Region { id name entity_type }
    ... on Organization { id name entity_type }
    ... on Sector { id name entity_type }
    ... on Vulnerability { id name entity_type }
    ... on Identity { id name entity_type }
  `;

  const [
    summaryBlock,
    distributionBlock,
    usesBlock,
    geoBlock,
    timelineBlock,
    malwareBlock,
    reportsBlock,
    vulnsBlock,
  ] = await Promise.all([
    openctiGraphql<{
      indicators: { pageInfo: { globalCount?: number } };
      malwares: { pageInfo: { globalCount?: number } };
      intrusionSets: { pageInfo: { globalCount?: number } };
      reports: { pageInfo: { globalCount?: number } };
      campaigns: { pageInfo: { globalCount?: number } };
      relationships: { pageInfo: { globalCount?: number } };
      recentIndicators: { pageInfo: { globalCount?: number } };
      recentMalwares: { pageInfo: { globalCount?: number } };
      recentIntrusionSets: { pageInfo: { globalCount?: number } };
      recentReports: { pageInfo: { globalCount?: number } };
    }>(
      `
      query DashboardSummary($f24: FilterGroup) {
        indicators(first: 1) { pageInfo { globalCount } }
        malwares(first: 1) { pageInfo { globalCount } }
        intrusionSets(first: 1) { pageInfo { globalCount } }
        reports(first: 1) { pageInfo { globalCount } }
        campaigns(first: 1) { pageInfo { globalCount } }
        relationships: stixCoreRelationships(first: 1) { pageInfo { globalCount } }
        recentIndicators: indicators(first: 1, filters: $f24) { pageInfo { globalCount } }
        recentMalwares: malwares(first: 1, filters: $f24) { pageInfo { globalCount } }
        recentIntrusionSets: intrusionSets(first: 1, filters: $f24) { pageInfo { globalCount } }
        recentReports: reports(first: 1, filters: $f24) { pageInfo { globalCount } }
      }
    `,
      { f24: createdSinceFilter(since24h) },
    ).catch(async () => {
      const basic = await openctiSummary();
      return {
        indicators: { pageInfo: { globalCount: basic.indicators } },
        malwares: { pageInfo: { globalCount: basic.malwares } },
        intrusionSets: { pageInfo: { globalCount: basic.intrusionSets } },
        reports: { pageInfo: { globalCount: basic.reports } },
        campaigns: { pageInfo: { globalCount: basic.campaigns } },
        relationships: { pageInfo: { globalCount: 0 } },
        recentIndicators: { pageInfo: { globalCount: basic.last24hIndicators } },
        recentMalwares: { pageInfo: { globalCount: 0 } },
        recentIntrusionSets: { pageInfo: { globalCount: 0 } },
        recentReports: { pageInfo: { globalCount: 0 } },
      };
    }),

    openctiGraphql<{
      stixCoreObjectsDistribution: Array<{ label?: string; value?: number }>;
    }>(`
      query Dist {
        stixCoreObjectsDistribution(field: "entity_type", operation: count, limit: 20) {
          label
          value
        }
      }
    `).catch(() => ({ stixCoreObjectsDistribution: [] })),

    openctiGraphql<{
      stixCoreRelationships: {
        edges: Array<{
          node: { id: string; created?: string; from?: RelNode; to?: RelNode };
        }>;
      };
    }>(
      `
      query Uses($first: Int) {
        stixCoreRelationships(
          first: $first
          orderBy: created
          orderMode: desc
          relationship_type: ["uses"]
        ) {
          edges {
            node {
              id
              created
              from { ${REL_FROM} }
              to { ${REL_TO} }
            }
          }
        }
      }
    `,
      { first: 250 },
    ).catch(() => ({ stixCoreRelationships: { edges: [] } })),

    openctiGraphql<{
      stixCoreRelationships: {
        edges: Array<{
          node: {
            id: string;
            relationship_type?: string;
            from?: RelNode;
            to?: RelNode;
          };
        }>;
      };
    }>(
      `
      query Geo($first: Int) {
        stixCoreRelationships(
          first: $first
          orderBy: created
          orderMode: desc
          relationship_type: ["targets", "located-at", "originates-from"]
        ) {
          edges {
            node {
              id
              relationship_type
              from { ${REL_FROM} }
              to { ${REL_TO} }
            }
          }
        }
      }
    `,
      { first: 250 },
    ).catch(() => ({ stixCoreRelationships: { edges: [] } })),

    openctiGraphql<{
      stixCoreRelationships: {
        edges: Array<{ node: { id: string; created?: string } }>;
      };
    }>(
      `
      query Timeline($first: Int, $filters: FilterGroup) {
        stixCoreRelationships(
          first: $first
          orderBy: created
          orderMode: desc
          filters: $filters
        ) {
          edges { node { id created } }
        }
      }
    `,
      { first: 300, filters: createdSinceFilter(sinceWindow) },
    ).catch(() => ({ stixCoreRelationships: { edges: [] } })),

    openctiGraphql<{
      malwares: { edges: Array<{ node: Record<string, unknown> }> };
    }>(
      `
      query RecentMalware($first: Int) {
        malwares(first: $first, orderBy: created, orderMode: desc) {
          edges {
            node {
              id
              name
              created
              objectLabel { value color }
            }
          }
        }
      }
    `,
      { first: 40 },
    ).catch(() => ({ malwares: { edges: [] } })),

    listEntities("reports", "Report", 8).catch(() => [] as ThreatActorLike[]),

    openctiGraphql<{
      vulnerabilities: { edges: Array<{ node: { id: string; name?: string } }> };
    }>(
      `
      query Vulns($first: Int) {
        vulnerabilities(first: $first, orderBy: created, orderMode: desc) {
          edges { node { id name } }
        }
      }
    `,
      { first: 8 },
    ).catch(() => ({ vulnerabilities: { edges: [] } })),
  ]);

  const threatMap = new Map<string, DashboardNamedCount>();
  const malwareMap = new Map<string, DashboardNamedCount>();
  const labelMap = new Map<string, { value: string; color?: string; count: number }>();

  for (const edge of usesBlock.stixCoreRelationships?.edges ?? []) {
    bumpNamed(threatMap, edge.node.from, ["Intrusion-Set", "Threat-Actor-Group", "Campaign"]);
    bumpNamed(malwareMap, edge.node.to, ["Malware", "Tool"]);
  }

  // Collect labels from recent malware; if "uses" counts are flat, shape radar by recency
  const malwareMax = Math.max(0, ...[...malwareMap.values()].map((m) => m.count));
  (malwareBlock.malwares?.edges ?? []).forEach((e, idx) => {
    const node = e.node;
    const id = String(node.id ?? "");
    const name = String(node.name ?? "");
    if (!id || !name) return;

    const labels = Array.isArray(node.objectLabel) ? node.objectLabel : [];
    for (const lab of labels as Array<{ value?: string; color?: string }>) {
      if (!lab?.value) continue;
      const cur = labelMap.get(lab.value) ?? { value: lab.value, color: lab.color, count: 0 };
      cur.count += 1;
      if (lab.color) cur.color = lab.color;
      labelMap.set(lab.value, cur);
    }

    if (malwareMax <= 1) {
      const existing = malwareMap.get(id);
      const recencyScore = Math.max(2, 14 - idx);
      malwareMap.set(id, {
        id,
        name,
        entityType: "Malware",
        count: (existing?.count ?? 0) + recencyScore,
      });
    } else if (!malwareMap.has(id) && malwareMap.size < 8) {
      malwareMap.set(id, { id, name, entityType: "Malware", count: 1 });
    }
  });

  const victimMap = new Map<string, DashboardNamedCount>();
  const countryMap = new Map<string, DashboardNamedCount>();

  for (const edge of geoBlock.stixCoreRelationships?.edges ?? []) {
    const rel = edge.node.relationship_type || "";
    const from = edge.node.from;
    const to = edge.node.to;

    if (rel === "targets") {
      bumpNamed(victimMap, to, ["Organization", "Sector", "Identity", "Individual"]);
      bumpNamed(countryMap, to, ["Country"]);
      // also count threat side as active
      bumpNamed(threatMap, from, ["Intrusion-Set", "Threat-Actor-Group", "Campaign", "Malware"]);
    }
    if (rel === "originates-from") {
      bumpNamed(countryMap, to, ["Country"]);
    }
    // Country → Region located-at is catalog noise; only count Country when a threat actor/malware is involved
    if (rel === "located-at") {
      const threatSide =
        from && ["Intrusion-Set", "Threat-Actor-Group", "Campaign", "Malware"].includes(from.entity_type || "")
          ? from
          : to && ["Intrusion-Set", "Threat-Actor-Group", "Campaign", "Malware"].includes(to.entity_type || "")
            ? to
            : null;
      const countrySide =
        to?.entity_type === "Country" ? to : from?.entity_type === "Country" ? from : null;
      if (threatSide && countrySide) {
        bumpNamed(countryMap, countrySide, ["Country"]);
      }
    }
  }

  const timeline = monthBuckets(days);
  const byKey = new Map(timeline.map((b) => [b.date, b]));
  for (const edge of timelineBlock.stixCoreRelationships?.edges ?? []) {
    const created = edge.node.created;
    if (!created) continue;
    const d = new Date(created);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const bucket = byKey.get(key);
    if (bucket) bucket.count += 1;
  }

  const vulnerabilities = (vulnsBlock.vulnerabilities?.edges ?? [])
    .map((e) => ({
      id: e.node.id,
      name: e.node.name || e.node.id,
      entityType: "Vulnerability",
      count: 1,
    }))
    .slice(0, 8);

  return {
    windowDays: days,
    summary: {
      intrusionSets: Number(summaryBlock.intrusionSets?.pageInfo?.globalCount ?? 0),
      malwares: Number(summaryBlock.malwares?.pageInfo?.globalCount ?? 0),
      reports: Number(summaryBlock.reports?.pageInfo?.globalCount ?? 0),
      indicators: Number(summaryBlock.indicators?.pageInfo?.globalCount ?? 0),
      campaigns: Number(summaryBlock.campaigns?.pageInfo?.globalCount ?? 0),
      relationships: Number(summaryBlock.relationships?.pageInfo?.globalCount ?? 0),
      last24h: {
        intrusionSets: Number(summaryBlock.recentIntrusionSets?.pageInfo?.globalCount ?? 0),
        malwares: Number(summaryBlock.recentMalwares?.pageInfo?.globalCount ?? 0),
        reports: Number(summaryBlock.recentReports?.pageInfo?.globalCount ?? 0),
        indicators: Number(summaryBlock.recentIndicators?.pageInfo?.globalCount ?? 0),
      },
    },
    distribution: (distributionBlock.stixCoreObjectsDistribution ?? [])
      .filter((d) => d.label)
      .map((d) => ({ label: String(d.label), value: Number(d.value ?? 0) })),
    activeThreats: topNamed(threatMap, 10),
    activeMalware: (() => {
      const malwareOnly = new Map(
        [...malwareMap.entries()].filter(([, v]) => v.entityType === "Malware"),
      );
      return topNamed(malwareOnly.size >= 4 ? malwareOnly : malwareMap, 8);
    })(),
    targetedVictims: topNamed(victimMap, 10),
    countries: topNamed(countryMap, 12),
    vulnerabilities,
    relationshipTimeline: timeline,
    recentReports: Array.isArray(reportsBlock) ? reportsBlock : [],
    activeLabels: [...labelMap.values()].sort((a, b) => b.count - a.count).slice(0, 16),
  };
}

export function openctiStreamUrl(): string {
  const { url, streamId } = requireOpenCtiConfig();
  return streamId ? `${url}/stream/${encodeURIComponent(streamId)}` : `${url}/stream`;
}

export function openctiAuthHeaders(): Record<string, string> {
  const { token } = requireOpenCtiConfig();
  return {
    Authorization: `Bearer ${token}`,
    Accept: "text/event-stream",
  };
}
