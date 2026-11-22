export type SeverityLabel = "info" | "low" | "medium" | "high" | "critical";

export function severityFromLevel(level: number): SeverityLabel {
  if (level >= 12) return "critical";
  if (level >= 8) return "high";
  if (level >= 4) return "medium";
  if (level >= 1) return "low";
  return "info";
}

export type AlertDto = {
  id: string;
  indexId: string;
  timestamp: string;
  ruleId: string;
  ruleDescription: string;
  level: number;
  severity: SeverityLabel;
  agentId: string;
  agentName: string;
  location: string;
  groups: string[];
  decoder: string;
  mitre?: string[];
  compliance: {
    pciDss: string[];
    hipaa: string[];
    nist: string[];
    gdpr: string[];
    tsc: string[];
  };
  raw: Record<string, unknown>;
};

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.map(String) : [];
}

export function normalizeAlert(hit: {
  _id: string;
  _source: Record<string, unknown>;
}): AlertDto {
  const src = hit._source;
  const rule = (src.rule ?? {}) as Record<string, unknown>;
  const agent = (src.agent ?? {}) as Record<string, unknown>;
  const decoder = (src.decoder ?? {}) as Record<string, unknown>;
  const level = Number(rule.level ?? 0);
  const mitreObj = (rule.mitre ?? {}) as Record<string, unknown>;
  const mitreIds = asStringArray(mitreObj.id).length
    ? asStringArray(mitreObj.id)
    : asStringArray(rule.mitre);

  return {
    id: asString(src.id, hit._id),
    indexId: hit._id,
    timestamp: asString(src.timestamp || src["@timestamp"]),
    ruleId: asString(rule.id),
    ruleDescription: asString(rule.description, "Untitled alert"),
    level,
    severity: severityFromLevel(level),
    agentId: asString(agent.id),
    agentName: asString(agent.name, "unknown"),
    location: asString(src.location),
    groups: asStringArray(rule.groups),
    decoder: asString(decoder.name),
    mitre: mitreIds,
    compliance: {
      pciDss: asStringArray(rule.pci_dss),
      hipaa: asStringArray(rule.hipaa),
      nist: asStringArray(rule.nist_800_53),
      gdpr: asStringArray(rule.gdpr),
      tsc: asStringArray(rule.tsc),
    },
    raw: src,
  };
}

export type VulnerabilityDto = {
  id: string;
  cve: string;
  severity: string;
  packageName: string;
  packageVersion: string;
  agentId: string;
  agentName: string;
  os: string;
  description: string;
  detectedAt: string;
  reference: string;
  score: number | null;
};

export function normalizeVulnerability(hit: {
  _id: string;
  _source: Record<string, unknown>;
}): VulnerabilityDto {
  const src = hit._source;
  const vuln = (src.vulnerability ?? {}) as Record<string, unknown>;
  const pkg = (src.package ?? {}) as Record<string, unknown>;
  const agent = (src.agent ?? {}) as Record<string, unknown>;
  const host = (src.host ?? {}) as Record<string, unknown>;
  const os = (host.os ?? {}) as Record<string, unknown>;
  const score = (vuln.score ?? {}) as Record<string, unknown>;

  return {
    id: hit._id,
    cve: asString(vuln.id),
    severity: asString(vuln.severity, "Unknown"),
    packageName: asString(pkg.name),
    packageVersion: asString(pkg.version),
    agentId: asString(agent.id),
    agentName: asString(agent.name),
    os: asString(os.full || os.name),
    description: asString(vuln.description),
    detectedAt: asString(vuln.detected_at),
    reference: asString(vuln.reference),
    score: typeof score.base === "number" ? score.base : score.base ? Number(score.base) : null,
  };
}
