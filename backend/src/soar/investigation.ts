import { prisma } from "../lib/prisma.js";
import { indexerSearch } from "../wazuh/indexer.js";
import { normalizeAlert, normalizeVulnerability } from "../wazuh/normalize.js";
import { PLAYBOOK_CATALOG } from "./playbookCatalog.js";

export async function buildIncidentInvestigation(incidentId: string) {
  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      notes: {
        take: 10,
        orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true } } },
      },
      activities: { take: 20, orderBy: { createdAt: "desc" } },
      tickets: {
        take: 10,
        orderBy: { updatedAt: "desc" },
        include: { owner: { select: { name: true } } },
      },
    },
  });
  if (!incident) return null;

  const relatedAlerts: unknown[] = [];
  const relatedVulns: unknown[] = [];
  const sources: Array<{ kind: string; id: string; label: string }> = [
    { kind: "incident", id: incident.id, label: incident.title },
  ];

  try {
    const must: object[] = [];
    if (incident.agentName) {
      must.push({ term: { "agent.name": incident.agentName } });
    } else if (incident.agentId) {
      must.push({ term: { "agent.id": incident.agentId } });
    }
    if (incident.alertRuleId) {
      must.push({ term: { "rule.id": incident.alertRuleId } });
    }
    if (must.length) {
      const alertsRes = await indexerSearch("wazuh-alerts-*", {
        size: 8,
        sort: [{ timestamp: { order: "desc" } }],
        query: { bool: { must } },
      });
      for (const hit of alertsRes.hits) {
        const a = normalizeAlert({ _id: hit._id, _source: hit._source });
        relatedAlerts.push(a);
        sources.push({ kind: "alert", id: a.indexId, label: a.ruleDescription });
      }
    }
  } catch {
    // indexer may be unavailable
  }

  try {
    if (incident.agentName || incident.agentId) {
      const must: object[] = [];
      if (incident.agentName) must.push({ term: { "agent.name": incident.agentName } });
      if (incident.agentId) must.push({ term: { "agent.id": incident.agentId } });
      const vulnsRes = await indexerSearch("wazuh-states-vulnerabilities-*", {
        size: 6,
        query: { bool: { must } },
      });
      for (const hit of vulnsRes.hits) {
        const v = normalizeVulnerability({ _id: hit._id, _source: hit._source });
        relatedVulns.push(v);
        sources.push({ kind: "vulnerability", id: v.id, label: v.cve });
      }
    }
  } catch {
    // optional
  }

  const pendingActions = await prisma.responseAction.findMany({
    where: {
      incidentId,
      status: { in: ["PROPOSED", "APPROVED", "EXECUTING"] },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const suggestedPlaybooks = PLAYBOOK_CATALOG.map((p) => ({
    key: p.key,
    name: p.name,
    description: p.description,
    category: p.category,
    riskLevel: p.riskLevel,
    actionType: p.actionType,
    requiresApproval: p.requiresApproval,
  }));

  const timeline = [
    ...incident.activities.map((a) => ({
      at: a.createdAt.toISOString(),
      kind: "activity" as const,
      label: a.action,
      detail: a.detail,
    })),
    ...incident.notes.map((n) => ({
      at: n.createdAt.toISOString(),
      kind: "note" as const,
      label: `Note by ${n.user.name}`,
      detail: n.body,
    })),
    ...pendingActions.map((a) => ({
      at: a.createdAt.toISOString(),
      kind: "soar" as const,
      label: `${a.status}: ${a.playbookName}`,
      detail: a.rationale,
    })),
  ].sort((a, b) => (a.at < b.at ? 1 : -1));

  return {
    incident,
    relatedAlerts,
    relatedVulns,
    tickets: incident.tickets,
    pendingActions,
    suggestedPlaybooks,
    timeline: timeline.slice(0, 40),
    sources,
    summary: {
      severity: incident.severity,
      status: incident.status,
      agentName: incident.agentName,
      agentId: incident.agentId,
      relatedAlertCount: relatedAlerts.length,
      relatedVulnCount: relatedVulns.length,
      openTicketCount: incident.tickets.filter((t) => !["DONE", "CLOSED"].includes(t.status)).length,
      pendingActionCount: pendingActions.length,
    },
  };
}
