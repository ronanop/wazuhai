export type ThreatIntelLabel = { value: string; color?: string };

export type ThreatIndicator = {
  id: string;
  name: string;
  patternType: string;
  pattern: string;
  validFrom: string | null;
  validUntil: string | null;
  confidence: number | null;
  score: number | null;
  createdAt: string | null;
  modifiedAt: string | null;
  labels: ThreatIntelLabel[];
  raw: Record<string, unknown>;
};

export type ThreatActorLike = {
  id: string;
  entityType: string;
  name: string;
  aliases: string[];
  description: string;
  createdAt: string | null;
  modifiedAt: string | null;
  labels: ThreatIntelLabel[];
  regions: string[];
  countries: string[];
  raw: Record<string, unknown>;
};

export type ThreatFeedEvent = {
  id: string;
  eventId: string;
  eventType: string;
  entityType: string;
  name: string;
  message: string;
  timestamp: string | null;
  score: number | null;
  labels: string[];
  regions: string[];
  raw: Record<string, unknown>;
};

function labelEdges(node: Record<string, unknown>): ThreatIntelLabel[] {
  const objectLabel = node.objectLabel as unknown;
  // OpenCTI 6.x: objectLabel is [Label!]!
  if (Array.isArray(objectLabel)) {
    return objectLabel
      .map((l) => {
        const item = l as { value?: string; color?: string };
        return {
          value: String(item.value ?? ""),
          color: item.color ? String(item.color) : undefined,
        };
      })
      .filter((l) => l.value);
  }
  // Older connection shape
  const conn = objectLabel as { edges?: Array<{ node?: { value?: string; color?: string } }> } | undefined;
  return (conn?.edges ?? [])
    .map((e) => ({
      value: String(e.node?.value ?? ""),
      color: e.node?.color ? String(e.node.color) : undefined,
    }))
    .filter((l) => l.value);
}

function locationNames(node: Record<string, unknown>, field: string): string[] {
  const block = node[field] as unknown;
  if (Array.isArray(block)) {
    return block
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (item && typeof item === "object" && "name" in item) {
          return String((item as { name?: string }).name ?? "").trim();
        }
        return "";
      })
      .filter(Boolean);
  }
  const conn = block as { edges?: Array<{ node?: { name?: string } }> } | undefined;
  return (conn?.edges ?? [])
    .map((e) => String(e.node?.name ?? "").trim())
    .filter(Boolean);
}

export function normalizeIndicator(node: Record<string, unknown>): ThreatIndicator {
  return {
    id: String(node.id ?? ""),
    name: String(node.name ?? node.pattern ?? "Indicator"),
    patternType: String(node.pattern_type ?? ""),
    pattern: String(node.pattern ?? ""),
    validFrom: node.valid_from ? String(node.valid_from) : null,
    validUntil: node.valid_until ? String(node.valid_until) : null,
    confidence: typeof node.confidence === "number" ? node.confidence : null,
    score: typeof node.x_opencti_score === "number" ? node.x_opencti_score : null,
    createdAt: node.created ? String(node.created) : null,
    modifiedAt: node.modified ? String(node.modified) : null,
    labels: labelEdges(node),
    raw: node,
  };
}

export function normalizeThreatEntity(
  node: Record<string, unknown>,
  entityType: string,
): ThreatActorLike {
  const aliases = Array.isArray(node.aliases)
    ? node.aliases.map((a) => String(a))
    : Array.isArray(node.x_mitre_aliases)
      ? (node.x_mitre_aliases as unknown[]).map((a) => String(a))
      : [];
  return {
    id: String(node.id ?? ""),
    entityType,
    name: String(node.name ?? entityType),
    aliases,
    description: String(node.description ?? ""),
    createdAt: node.created ? String(node.created) : null,
    modifiedAt: node.modified ? String(node.modified) : null,
    labels: labelEdges(node),
    regions: locationNames(node, "regions"),
    countries: locationNames(node, "countries"),
    raw: node,
  };
}

export function normalizeStreamEvent(payload: {
  id?: string;
  event?: string;
  data?: Record<string, unknown>;
}): ThreatFeedEvent | null {
  const envelope = payload.data ?? {};
  const stix = (envelope.data ?? envelope) as Record<string, unknown>;
  if (!stix || typeof stix !== "object") return null;

  const entityType = String(stix.type ?? envelope.type ?? "unknown");
  const name = String(
    stix.name ?? stix.pattern ?? stix.value ?? stix.definition ?? entityType,
  );
  const labels = Array.isArray(stix.labels)
    ? stix.labels.map((l) => String(l))
    : [];
  const regions: string[] = [];
  if (Array.isArray(stix.x_opencti_locations)) {
    for (const loc of stix.x_opencti_locations as unknown[]) {
      if (typeof loc === "string") regions.push(loc);
      else if (loc && typeof loc === "object" && "name" in (loc as object)) {
        regions.push(String((loc as { name: unknown }).name));
      }
    }
  }

  const created = stix.created || stix.modified || envelope.timestamp;
  return {
    id: String(stix.id ?? payload.id ?? `${entityType}-${name}`),
    eventId: String(payload.id ?? ""),
    eventType: String(payload.event ?? envelope.type ?? "create"),
    entityType,
    name,
    message: String(envelope.message ?? `${payload.event ?? "event"} ${entityType}`),
    timestamp: created ? String(created) : new Date().toISOString(),
    score:
      typeof stix.x_opencti_score === "number"
        ? stix.x_opencti_score
        : typeof stix.confidence === "number"
          ? stix.confidence
          : null,
    labels,
    regions,
    raw: { event: payload.event, stix, origin: envelope.origin, context: envelope.context },
  };
}
