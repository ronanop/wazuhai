import { prisma } from "../lib/prisma.js";
import { indexerSearch } from "../wazuh/indexer.js";
import { normalizeAlert } from "../wazuh/normalize.js";
import { normalizeVulnerability } from "../wazuh/normalize.js";

export type ChatContext = {
  page?: string;
  selected?: {
    type?: string;
    id?: string;
    title?: string;
    meta?: Record<string, unknown>;
  };
  question: string;
};

export type EvidencePack = {
  retrievedAt: string;
  page: string;
  selected: ChatContext["selected"] | null;
  sources: Array<{ kind: string; id: string; label: string }>;
  items: Record<string, unknown>;
  empty: boolean;
};

export async function retrieveEvidence(
  ctx: ChatContext,
  maxItems: number,
): Promise<EvidencePack> {
  const page = ctx.page || "unknown";
  const selected = ctx.selected ?? null;
  const sources: EvidencePack["sources"] = [];
  const items: Record<string, unknown> = {};
  const q = ctx.question.trim();

  const limit = Math.max(3, Math.min(30, maxItems));

  // Always include light ops snapshot
  const [openIncidents, openTickets] = await Promise.all([
    prisma.incident.count({
      where: { status: { in: ["OPEN", "INVESTIGATING", "CONTAINED"] } },
    }),
    prisma.ticket.count({
      where: { status: { in: ["OPEN", "IN_PROGRESS", "BLOCKED"] } },
    }),
  ]);
  items.opsSnapshot = { openIncidents, openTickets };
  sources.push({ kind: "ops", id: "snapshot", label: "Ops snapshot" });

  // Selected record first
  if (selected?.type && selected.id) {
    if (selected.type === "incident") {
      const incident = await prisma.incident.findUnique({
        where: { id: selected.id },
        include: {
          owner: { select: { name: true, email: true } },
          notes: { take: 5, orderBy: { createdAt: "desc" } },
        },
      });
      if (incident) {
        items.selectedIncident = incident;
        sources.push({ kind: "incident", id: incident.id, label: incident.title });
      }
    }

    if (selected.type === "ticket") {
      const ticket = await prisma.ticket.findUnique({
        where: { id: selected.id },
        include: { owner: { select: { name: true, email: true } } },
      });
      if (ticket) {
        items.selectedTicket = ticket;
        sources.push({ kind: "ticket", id: ticket.id, label: ticket.title });
      }
    }

    if (selected.type === "alert" || selected.type === "alertIndex") {
      const result = await indexerSearch("wazuh-alerts-*", {
        size: 1,
        query: {
          bool: {
            should: [
              { term: { _id: selected.id } },
              { term: { id: selected.id } },
            ],
            minimum_should_match: 1,
          },
        },
      });
      const hit = result.hits[0];
      if (hit) {
        const alert = normalizeAlert({ _id: hit._id, _source: hit._source });
        items.selectedAlert = { ...alert, raw: undefined };
        sources.push({
          kind: "alert",
          id: alert.indexId,
          label: alert.ruleDescription,
        });
      }
    }

    if (selected.type === "vulnerability" || selected.type === "cve") {
      const result = await indexerSearch("wazuh-states-vulnerabilities-*", {
        size: 1,
        query: {
          bool: {
            should: [
              { term: { _id: selected.id } },
              { term: { "vulnerability.id": selected.id } },
            ],
            minimum_should_match: 1,
          },
        },
      });
      const hit = result.hits[0];
      if (hit) {
        const vuln = normalizeVulnerability({ _id: hit._id, _source: hit._source });
        items.selectedVulnerability = vuln;
        sources.push({ kind: "vulnerability", id: vuln.cve || vuln.id, label: vuln.cve });
      }
    }

    if (selected.type === "compliance_control" && selected.meta?.frameworkId) {
      items.selectedComplianceControl = {
        frameworkId: selected.meta.frameworkId,
        controlId: selected.id,
        title: selected.title,
      };
      sources.push({
        kind: "compliance",
        id: String(selected.id),
        label: `Control ${selected.id}`,
      });
    }
  }

  // Page-oriented retrieval
  if (page.includes("alert") || /alert|rule|severity/i.test(q)) {
    const result = await indexerSearch("wazuh-alerts-*", {
      size: Math.min(limit, 8),
      sort: [{ timestamp: { order: "desc", unmapped_type: "date" } }],
      query: q
        ? {
            multi_match: {
              query: q,
              fields: ["rule.description", "rule.id", "agent.name", "full_log"],
            },
          }
        : { match_all: {} },
    });
    items.recentAlerts = result.hits.map((h) => {
      const a = normalizeAlert({ _id: h._id, _source: h._source });
      sources.push({ kind: "alert", id: a.indexId, label: a.ruleDescription });
      return { ...a, raw: undefined };
    });
  }

  if (page.includes("vulnerab") || /cve|vulnerab/i.test(q)) {
    const result = await indexerSearch("wazuh-states-vulnerabilities-*", {
      size: Math.min(limit, 8),
      query: q
        ? {
            multi_match: {
              query: q,
              fields: ["vulnerability.id", "vulnerability.description", "package.name", "agent.name"],
            },
          }
        : { match_all: {} },
    });
    items.vulnerabilities = result.hits.map((h) => {
      const v = normalizeVulnerability({ _id: h._id, _source: h._source });
      sources.push({ kind: "vulnerability", id: v.cve || v.id, label: v.cve });
      return v;
    });
  }

  if (page.includes("incident") || /incident/i.test(q)) {
    const incidents = await prisma.incident.findMany({
      orderBy: { updatedAt: "desc" },
      take: Math.min(limit, 8),
      include: { owner: { select: { name: true } } },
    });
    items.incidents = incidents;
    for (const i of incidents) {
      sources.push({ kind: "incident", id: i.id, label: i.title });
    }
  }

  if (page.includes("ticket") || /ticket/i.test(q)) {
    const tickets = await prisma.ticket.findMany({
      orderBy: { updatedAt: "desc" },
      take: Math.min(limit, 8),
      include: { owner: { select: { name: true } } },
    });
    items.tickets = tickets;
    for (const t of tickets) {
      sources.push({ kind: "ticket", id: t.id, label: t.title });
    }
  }

  if (page.includes("sca") || /sca|cis|hardening/i.test(q)) {
    const result = await indexerSearch("wazuh-alerts-*", {
      size: Math.min(limit, 8),
      sort: [{ timestamp: { order: "desc", unmapped_type: "date" } }],
      query: {
        bool: {
          must: [
            { term: { "rule.groups": "sca" } },
            { term: { "data.sca.type": "check" } },
          ],
        },
      },
    });
    items.scaChecks = result.hits.map((h) => {
      const src = h._source;
      const data = (src.data ?? {}) as Record<string, unknown>;
      const sca = (data.sca ?? {}) as Record<string, unknown>;
      const check = (sca.check ?? {}) as Record<string, unknown>;
      const agent = (src.agent ?? {}) as Record<string, unknown>;
      const id = h._id;
      sources.push({ kind: "sca", id, label: String(check.title ?? "SCA check") });
      return {
        indexId: id,
        title: String(check.title ?? ""),
        result: String(check.result ?? ""),
        remediation: String(check.remediation ?? ""),
        agentName: String(agent.name ?? ""),
        policy: String(sca.policy ?? ""),
      };
    });
  }

  if (page.includes("mitre") || /mitre|technique|T\d{4}/i.test(q)) {
    const result = await indexerSearch("wazuh-alerts-*", {
      size: 0,
      query: { exists: { field: "rule.mitre.id" } },
      aggs: {
        techniques: { terms: { field: "rule.mitre.id", size: 10 } },
      },
    });
    const buckets =
      (
        result.aggregations.techniques as {
          buckets?: Array<{ key: string; doc_count: number }>;
        }
      )?.buckets ?? [];
    items.mitreObserved = buckets;
    for (const b of buckets) {
      sources.push({ kind: "mitre", id: String(b.key), label: String(b.key) });
    }
  }

  if (page.includes("compliance") || /pci|hipaa|nist|gdpr|compliance/i.test(q)) {
    const result = await indexerSearch("wazuh-alerts-*", {
      size: 0,
      query: { exists: { field: "rule.pci_dss" } },
      aggs: {
        pci: { terms: { field: "rule.pci_dss", size: 8 } },
      },
    });
    items.compliancePciTop =
      (
        result.aggregations.pci as {
          buckets?: Array<{ key: string; doc_count: number }>;
        }
      )?.buckets ?? [];
    sources.push({ kind: "compliance", id: "pci_top", label: "PCI DSS top controls" });
  }

  // Fallback: if still thin, pull recent alerts
  if (Object.keys(items).length <= 1) {
    const result = await indexerSearch("wazuh-alerts-*", {
      size: Math.min(limit, 5),
      sort: [{ timestamp: { order: "desc", unmapped_type: "date" } }],
      query: { match_all: {} },
    });
    items.fallbackRecentAlerts = result.hits.map((h) => {
      const a = normalizeAlert({ _id: h._id, _source: h._source });
      sources.push({ kind: "alert", id: a.indexId, label: a.ruleDescription });
      return { ...a, raw: undefined };
    });
  }

  // de-dupe sources
  const seen = new Set<string>();
  const uniqueSources = sources.filter((s) => {
    const k = `${s.kind}:${s.id}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return {
    retrievedAt: new Date().toISOString(),
    page,
    selected,
    sources: uniqueSources.slice(0, limit * 2),
    items,
    empty: uniqueSources.length === 0,
  };
}
