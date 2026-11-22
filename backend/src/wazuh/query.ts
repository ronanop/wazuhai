import {
  agentFilterClause,
  parseOptionalIso,
  parseSortDir,
  timestampRangeClause,
  type SortDir,
} from "../lib/listQuery.js";
import { severityFromLevel } from "./normalize.js";

export type AlertSearchParams = {
  page?: number;
  pageSize?: number;
  q?: string;
  severity?: string;
  agent?: string;
  group?: string | string[];
  groupsAny?: string[];
  mitre?: string;
  /** Free-text / exact IOC values to OR-match across common Wazuh fields */
  iocValues?: string[];
  from?: string;
  to?: string;
  sort?: string;
};

const IOC_FIELDS = [
  "data.srcip",
  "data.dstip",
  "data.src_ip",
  "data.dst_ip",
  "data.source.ip",
  "data.destination.ip",
  "data.url",
  "data.dns.question.name",
  "data.win.eventdata.queryName",
  "data.sha256",
  "data.md5",
  "data.sha1",
  "data.hash.sha256",
  "data.hash.md5",
  "full_log",
];

const severityRanges: Record<string, { gte?: number; lte?: number }> = {
  info: { gte: 0, lte: 0 },
  low: { gte: 1, lte: 3 },
  medium: { gte: 4, lte: 7 },
  high: { gte: 8, lte: 11 },
  critical: { gte: 12, lte: 15 },
};

export function buildAlertQuery(params: AlertSearchParams) {
  const page = Math.max(1, Number(params.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(params.pageSize ?? 25)));
  const from = (page - 1) * pageSize;
  const filters: Record<string, unknown>[] = [];

  const q = String(params.q ?? "").trim();
  if (q) {
    filters.push({
      multi_match: {
        query: q,
        fields: [
          "rule.description",
          "rule.id",
          "agent.name",
          "full_log",
          "data.title",
          "data.file",
          "data.sca.check.title",
          "syscheck.path",
        ],
        type: "best_fields",
      },
    });
  }

  const agentClause = agentFilterClause(String(params.agent ?? ""));
  if (agentClause) filters.push(agentClause);

  if (params.severity && severityRanges[params.severity]) {
    filters.push({ range: { "rule.level": severityRanges[params.severity] } });
  }

  if (params.group) {
    const groups = Array.isArray(params.group) ? params.group : [params.group];
    filters.push({ terms: { "rule.groups": groups } });
  }

  if (params.groupsAny?.length) {
    filters.push({ terms: { "rule.groups": params.groupsAny } });
  }

  if (params.mitre) {
    filters.push({ term: { "rule.mitre.id": params.mitre } });
  }

  const iocs = (params.iocValues ?? []).map((v) => String(v).trim()).filter(Boolean);
  if (iocs.length) {
    const should: Record<string, unknown>[] = [];
    for (const value of iocs.slice(0, 20)) {
      for (const field of IOC_FIELDS) {
        should.push({ term: { [field]: value } });
        should.push({ match_phrase: { [field]: value } });
      }
      should.push({
        multi_match: {
          query: value,
          fields: IOC_FIELDS,
          type: "phrase",
        },
      });
    }
    filters.push({ bool: { should, minimum_should_match: 1 } });
  }

  const fromIso = parseOptionalIso(params.from);
  const toIso = parseOptionalIso(params.to);
  const rangeClause = timestampRangeClause(fromIso, toIso);
  if (rangeClause) filters.push(rangeClause);

  const sortDir: SortDir = parseSortDir(params.sort);

  return {
    page,
    pageSize,
    from,
    sortDir,
    query: filters.length > 0 ? { bool: { must: filters } } : { match_all: {} },
  };
}

export { severityFromLevel };
