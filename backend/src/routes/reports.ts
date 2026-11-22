import { Router } from "express";
import PDFDocument from "pdfkit";
import { IncidentStatus, TicketStatus } from "@prisma/client";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { indexerCount, indexerSearch } from "../wazuh/indexer.js";
import { FRAMEWORKS } from "../wazuh/complianceCatalog.js";
import { normalizeAlert, severityFromLevel } from "../wazuh/normalize.js";

const router = Router();

const REPORT_TYPES = [
  { id: "executive", name: "Executive security summary" },
  { id: "alerts", name: "Alerts summary" },
  { id: "incidents", name: "Incidents & tickets" },
  { id: "vulnerabilities", name: "Vulnerability findings" },
  { id: "compliance", name: "Compliance evidence summary" },
  { id: "endpoints", name: "Endpoint / agent observation" },
] as const;

router.get("/types", requireAuth, (_req, res) => {
  res.json({ types: REPORT_TYPES });
});

router.get("/generate/:type", requireAuth, async (req, res) => {
  try {
    const type = req.params.type;
    const format = String(req.query.format ?? "json");

    if (!REPORT_TYPES.some((t) => t.id === type)) {
      return res.status(400).json({ error: "Unknown report type" });
    }

    let report: Record<string, unknown> = {
      type,
      generatedAt: new Date().toISOString(),
      source: "aegis + wazuh",
      disclaimer: "Operational summary from available platform data. Not a certification.",
    };

    if (type === "executive" || type === "alerts") {
      const [alertCount, severityAgg, recent] = await Promise.all([
        indexerCount("wazuh-alerts-*"),
        indexerSearch("wazuh-alerts-*", {
          size: 0,
          query: { match_all: {} },
          aggs: {
            by_level: {
              range: {
                field: "rule.level",
                ranges: [
                  { key: "low", from: 1, to: 4 },
                  { key: "medium", from: 4, to: 8 },
                  { key: "high", from: 8, to: 12 },
                  { key: "critical", from: 12, to: 16 },
                ],
              },
            },
          },
        }),
        indexerSearch("wazuh-alerts-*", {
          size: 15,
          sort: [{ timestamp: { order: "desc", unmapped_type: "date" } }],
          query: { match_all: {} },
        }),
      ]);

      const severity: Record<string, number> = {};
      for (const b of (
        severityAgg.aggregations.by_level as {
          buckets?: Array<{ key: string; doc_count: number }>;
        }
      )?.buckets ?? []) {
        severity[b.key] = b.doc_count;
      }

      report = {
        ...report,
        totals: { alerts: alertCount },
        severity,
        recentAlerts: recent.hits.map((h) => {
          const a = normalizeAlert({ _id: h._id, _source: h._source });
          return {
            timestamp: a.timestamp,
            severity: severityFromLevel(a.level),
            rule: a.ruleDescription,
            agent: a.agentName,
            ruleId: a.ruleId,
          };
        }),
      };
    }

    if (type === "executive" || type === "incidents") {
      const [incidents, tickets] = await Promise.all([
        prisma.incident.findMany({
          orderBy: { updatedAt: "desc" },
          take: 50,
          include: { owner: { select: { name: true, email: true } } },
        }),
        prisma.ticket.findMany({
          orderBy: { updatedAt: "desc" },
          take: 50,
          include: { owner: { select: { name: true, email: true } } },
        }),
      ]);

      report = {
        ...report,
        incidentStats: {
          open: incidents.filter((i) =>
            [IncidentStatus.OPEN, IncidentStatus.INVESTIGATING, IncidentStatus.CONTAINED].includes(
              i.status,
            ),
          ).length,
          totalListed: incidents.length,
        },
        ticketStats: {
          open: tickets.filter((t) =>
            [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.BLOCKED].includes(t.status),
          ).length,
          overdue: tickets.filter(
            (t) =>
              t.dueAt &&
              t.dueAt.getTime() < Date.now() &&
              ![TicketStatus.DONE, TicketStatus.CLOSED].includes(t.status),
          ).length,
        },
        incidents: incidents.map((i) => ({
          title: i.title,
          severity: i.severity,
          status: i.status,
          owner: i.owner?.name ?? null,
          updatedAt: i.updatedAt.toISOString(),
        })),
        tickets: tickets.map((t) => ({
          title: t.title,
          priority: t.priority,
          status: t.status,
          dueAt: t.dueAt?.toISOString() ?? null,
          owner: t.owner?.name ?? null,
        })),
      };
    }

    if (type === "vulnerabilities") {
      const result = await indexerSearch("wazuh-states-vulnerabilities-*", {
        size: 50,
        query: { match_all: {} },
        aggs: {
          by_severity: { terms: { field: "vulnerability.severity", size: 10 } },
        },
      });
      report = {
        ...report,
        total: result.total,
        bySeverity:
          (
            result.aggregations.by_severity as {
              buckets?: Array<{ key: string; doc_count: number }>;
            }
          )?.buckets?.map((b) => ({ severity: b.key, count: b.doc_count })) ?? [],
        findings: result.hits.map((h) => {
          const src = h._source;
          const v = (src.vulnerability ?? {}) as Record<string, unknown>;
          const p = (src.package ?? {}) as Record<string, unknown>;
          const a = (src.agent ?? {}) as Record<string, unknown>;
          return {
            cve: String(v.id ?? ""),
            severity: String(v.severity ?? ""),
            package: String(p.name ?? ""),
            agent: String(a.name ?? ""),
          };
        }),
      };
    }

    if (type === "compliance") {
      const aggs: Record<string, unknown> = {};
      for (const fw of FRAMEWORKS) {
        aggs[fw.id] = {
          filter: { exists: { field: fw.alertField } },
          aggs: { controls: { terms: { field: fw.alertField, size: 20 } } },
        };
      }
      const result = await indexerSearch("wazuh-alerts-*", {
        size: 0,
        query: { match_all: {} },
        aggs,
      });
      report = {
        ...report,
        frameworks: FRAMEWORKS.map((fw) => {
          const block = result.aggregations[fw.id] as {
            doc_count?: number;
            controls?: { buckets?: Array<{ key: string; doc_count: number }> };
          };
          return {
            id: fw.id,
            name: fw.name,
            alertCount: block?.doc_count ?? 0,
            controls:
              block?.controls?.buckets?.map((b) => ({
                id: String(b.key),
                alertCount: b.doc_count,
              })) ?? [],
          };
        }),
      };
    }

    if (type === "endpoints") {
      const result = await indexerSearch("wazuh-alerts-*", {
        size: 0,
        query: { match_all: {} },
        aggs: {
          agents: {
            terms: { field: "agent.name", size: 50 },
            aggs: {
              agent_id: { terms: { field: "agent.id", size: 1 } },
              last_seen: { max: { field: "timestamp" } },
            },
          },
        },
      });
      const agents =
        (
          result.aggregations.agents as {
            buckets?: Array<{
              key: string;
              doc_count: number;
              agent_id?: { buckets?: Array<{ key: string }> };
              last_seen?: { value_as_string?: string };
            }>;
          }
        )?.buckets?.map((b) => ({
          name: b.key,
          id: b.agent_id?.buckets?.[0]?.key ?? "—",
          alertCount: b.doc_count,
          lastSeen: b.last_seen?.value_as_string ?? null,
        })) ?? [];
      report = { ...report, agents };
    }

    if (format === "csv") {
      const csv = toCsv(type, report);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="aegis-${type}-${Date.now()}.csv"`,
      );
      return res.send(csv);
    }

    if (format === "pdf") {
      const buf = await toPdf(type, report);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="aegis-${type}-${Date.now()}.pdf"`,
      );
      return res.send(buf);
    }

    return res.json({ report });
  } catch (err) {
    return res.status(502).json({
      error: err instanceof Error ? err.message : "Failed to generate report",
    });
  }
});

function escapeCsv(v: unknown) {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(type: string, report: Record<string, unknown>) {
  const lines: string[] = [];
  lines.push(`report_type,${escapeCsv(type)}`);
  lines.push(`generated_at,${escapeCsv(report.generatedAt)}`);
  lines.push("");

  if (type === "alerts" || type === "executive") {
    lines.push("section,recent_alerts");
    lines.push("timestamp,severity,agent,rule_id,rule");
    for (const row of (report.recentAlerts as Array<Record<string, unknown>>) ?? []) {
      lines.push(
        [row.timestamp, row.severity, row.agent, row.ruleId, row.rule].map(escapeCsv).join(","),
      );
    }
  }

  if (type === "vulnerabilities") {
    lines.push("cve,severity,package,agent");
    for (const row of (report.findings as Array<Record<string, unknown>>) ?? []) {
      lines.push([row.cve, row.severity, row.package, row.agent].map(escapeCsv).join(","));
    }
  }

  if (type === "compliance") {
    lines.push("framework,control,alert_count");
    for (const fw of (report.frameworks as Array<{
      name: string;
      controls: Array<{ id: string; alertCount: number }>;
    }>) ?? []) {
      for (const c of fw.controls) {
        lines.push([fw.name, c.id, c.alertCount].map(escapeCsv).join(","));
      }
    }
  }

  if (type === "endpoints") {
    lines.push("agent_id,name,alert_count,last_seen");
    for (const a of (report.agents as Array<Record<string, unknown>>) ?? []) {
      lines.push([a.id, a.name, a.alertCount, a.lastSeen].map(escapeCsv).join(","));
    }
  }

  if (type === "incidents" || type === "executive") {
    lines.push("");
    lines.push("section,incidents");
    lines.push("title,severity,status,owner,updated_at");
    for (const row of (report.incidents as Array<Record<string, unknown>>) ?? []) {
      lines.push(
        [row.title, row.severity, row.status, row.owner, row.updatedAt].map(escapeCsv).join(","),
      );
    }
  }

  return lines.join("\n");
}

function reportTitle(type: string) {
  return REPORT_TYPES.find((t) => t.id === type)?.name ?? type;
}

function pushStatLines(lines: string[], report: Record<string, unknown>, type: string) {
  lines.push(`Type: ${type}`);
  lines.push(`Generated: ${String(report.generatedAt ?? "")}`);
  lines.push(`Source: ${String(report.source ?? "")}`);
  lines.push("");

  const totals = report.totals as Record<string, unknown> | undefined;
  if (totals?.alerts != null) lines.push(`Total alerts: ${totals.alerts}`);

  const severity = report.severity as Record<string, number> | undefined;
  if (severity) {
    for (const [k, v] of Object.entries(severity)) {
      lines.push(`Severity ${k}: ${v}`);
    }
  }

  const incidentStats = report.incidentStats as Record<string, unknown> | undefined;
  if (incidentStats) {
    lines.push(`Incidents open: ${incidentStats.open ?? "—"}`);
    lines.push(`Incidents listed: ${incidentStats.totalListed ?? "—"}`);
  }

  const ticketStats = report.ticketStats as Record<string, unknown> | undefined;
  if (ticketStats) {
    lines.push(`Tickets open: ${ticketStats.open ?? "—"}`);
    lines.push(`Tickets overdue: ${ticketStats.overdue ?? "—"}`);
  }

  if (report.total != null) lines.push(`Vulnerability hits: ${report.total}`);

  const bySeverity = report.bySeverity as Array<{ severity: string; count: number }> | undefined;
  if (bySeverity?.length) {
    for (const row of bySeverity) {
      lines.push(`Vuln severity ${row.severity}: ${row.count}`);
    }
  }

  const frameworks = report.frameworks as Array<{ name: string; alertCount: number }> | undefined;
  if (frameworks?.length) {
    for (const fw of frameworks) {
      lines.push(`Compliance ${fw.name}: ${fw.alertCount} alerts`);
    }
  }

  const agents = report.agents as Array<{ name: string; alertCount: number }> | undefined;
  if (agents?.length) {
    lines.push(`Agents observed: ${agents.length}`);
    for (const a of agents.slice(0, 15)) {
      lines.push(`  ${a.name}: ${a.alertCount} alerts`);
    }
  }

  const recent = report.recentAlerts as Array<Record<string, unknown>> | undefined;
  if (recent?.length) {
    lines.push("");
    lines.push("Recent alerts:");
    for (const row of recent.slice(0, 10)) {
      lines.push(
        `  [${row.severity}] ${row.rule} · ${row.agent} · ${row.timestamp}`,
      );
    }
  }
}

function toPdf(type: string, report: Record<string, unknown>): Promise<Buffer> {
  const lines: string[] = [];
  pushStatLines(lines, report, type);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "LETTER" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).text(reportTitle(type), { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11);
    for (const line of lines) {
      doc.text(line || " ");
    }
    if (report.disclaimer) {
      doc.moveDown();
      doc.fontSize(9).fillColor("#555").text(String(report.disclaimer));
    }
    doc.end();
  });
}

export default router;
