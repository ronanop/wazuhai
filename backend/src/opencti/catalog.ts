export type EntityCatalogType =
  | "intrusion-sets"
  | "malwares"
  | "indicators"
  | "attack-patterns"
  | "campaigns"
  | "tools"
  | "vulnerabilities"
  | "reports";

export type EntityCatalogDef = {
  type: EntityCatalogType;
  graphqlField: string;
  entityType: string;
  label: string;
  routeSlug: string;
};

export const ENTITY_CATALOG: Record<EntityCatalogType, EntityCatalogDef> = {
  "intrusion-sets": {
    type: "intrusion-sets",
    graphqlField: "intrusionSets",
    entityType: "Intrusion-Set",
    label: "Intrusion sets",
    routeSlug: "intrusion-sets",
  },
  malwares: {
    type: "malwares",
    graphqlField: "malwares",
    entityType: "Malware",
    label: "Malware",
    routeSlug: "malware",
  },
  indicators: {
    type: "indicators",
    graphqlField: "indicators",
    entityType: "Indicator",
    label: "Indicators",
    routeSlug: "indicators",
  },
  "attack-patterns": {
    type: "attack-patterns",
    graphqlField: "attackPatterns",
    entityType: "Attack-Pattern",
    label: "Attack patterns",
    routeSlug: "attack-patterns",
  },
  campaigns: {
    type: "campaigns",
    graphqlField: "campaigns",
    entityType: "Campaign",
    label: "Campaigns",
    routeSlug: "campaigns",
  },
  tools: {
    type: "tools",
    graphqlField: "tools",
    entityType: "Tool",
    label: "Tools",
    routeSlug: "tools",
  },
  vulnerabilities: {
    type: "vulnerabilities",
    graphqlField: "vulnerabilities",
    entityType: "Vulnerability",
    label: "Vulnerabilities",
    routeSlug: "vulnerabilities",
  },
  reports: {
    type: "reports",
    graphqlField: "reports",
    entityType: "Report",
    label: "Reports",
    routeSlug: "reports",
  },
};

/** URL slug (malware) → catalog type (malwares) */
export const SLUG_TO_TYPE: Record<string, EntityCatalogType> = {
  "intrusion-sets": "intrusion-sets",
  malware: "malwares",
  malwares: "malwares",
  indicators: "indicators",
  "attack-patterns": "attack-patterns",
  campaigns: "campaigns",
  tools: "tools",
  vulnerabilities: "vulnerabilities",
  reports: "reports",
};

export function resolveEntityType(input: string): EntityCatalogDef | null {
  const key = SLUG_TO_TYPE[input] ?? (input in ENTITY_CATALOG ? (input as EntityCatalogType) : null);
  if (!key) return null;
  return ENTITY_CATALOG[key];
}

export function entityTypeToSlug(entityType: string): string {
  const normalized = entityType.toLowerCase().replace(/_/g, "-");
  for (const def of Object.values(ENTITY_CATALOG)) {
    if (def.entityType.toLowerCase() === normalized || def.entityType.toLowerCase().replace(/-/g, "") === normalized.replace(/-/g, "")) {
      return def.routeSlug;
    }
  }
  // Common STIX aliases
  if (normalized === "intrusion-set") return "intrusion-sets";
  if (normalized === "attack-pattern") return "attack-patterns";
  if (normalized === "malware") return "malware";
  if (normalized === "indicator") return "indicators";
  if (normalized === "campaign") return "campaigns";
  if (normalized === "tool") return "tools";
  if (normalized === "vulnerability") return "vulnerabilities";
  if (normalized === "report") return "reports";
  return normalized;
}
