export type SortDir = "asc" | "desc";

export function parseSortDir(raw: unknown, fallback: SortDir = "desc"): SortDir {
  const v = String(raw ?? "").trim().toLowerCase();
  if (v === "asc" || v === "oldest" || v === "oldest_first") return "asc";
  if (v === "desc" || v === "newest" || v === "newest_first") return "desc";
  return fallback;
}

export function parseOptionalIso(raw: unknown): string | undefined {
  const v = String(raw ?? "").trim();
  if (!v) return undefined;
  const t = Date.parse(v);
  return Number.isNaN(t) ? undefined : new Date(t).toISOString();
}

/** Escape Lucene/OpenSearch wildcard special characters. */
export function escapeWildcard(value: string): string {
  return value.replace(/[\\*?]/g, "\\$&");
}

/** Agent name/id match that tolerates partial names. */
export function agentFilterClause(agent: string): Record<string, unknown> | null {
  const q = agent.trim();
  if (!q) return null;
  const wild = `*${escapeWildcard(q)}*`;
  return {
    bool: {
      should: [
        { wildcard: { "agent.name": { value: wild, case_insensitive: true } } },
        { term: { "agent.id": q } },
        { wildcard: { "agent.id": { value: wild, case_insensitive: true } } },
      ],
      minimum_should_match: 1,
    },
  };
}

export function timestampRangeClause(
  from?: string,
  to?: string,
  field = "timestamp",
): Record<string, unknown> | null {
  if (!from && !to) return null;
  const range: Record<string, string> = {};
  if (from) range.gte = from;
  if (to) range.lte = to;
  return { range: { [field]: range } };
}
