import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "../auth/AuthContext";
import { api, type DashboardSummary, type Severity } from "../api/client";
import "../styles/soc.css";

type RangeKey = "24h" | "7d" | "30d" | "all";

const SEV_COLORS: Record<Severity, string> = {
  info: "#94a3b8",
  low: "#38bdf8",
  medium: "#f59e0b",
  high: "#f97316",
  critical: "#ef4444",
};

const MODULE_COLORS = ["#1c4ed8", "#0ea5e9", "#6366f1", "#14b8a6", "#64748b"];

function rangeParams(key: RangeKey): { from?: string; to?: string } {
  if (key === "all") return {};
  const to = new Date();
  const from = new Date(to);
  if (key === "24h") from.setHours(from.getHours() - 24);
  else if (key === "7d") from.setDate(from.getDate() - 7);
  else from.setDate(from.getDate() - 30);
  return { from: from.toISOString(), to: to.toISOString() };
}

function formatTick(iso: string, range: RangeKey) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  if (range === "24h") return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tip">
      {label && <strong>{label}</strong>}
      {payload.map((p) => (
        <div key={String(p.name)}>
          <span style={{ background: p.color || "var(--accent)" }} />
          {p.name}: {Number(p.value ?? 0).toLocaleString()}
        </div>
      ))}
    </div>
  );
}

export function OverviewPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [ops, setOps] = useState<{
    openIncidents: number;
    openTickets: number;
    overdueTickets: number;
    unreadNotifications: number;
  } | null>(null);
  const [range, setRange] = useState<RangeKey>("7d");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const params = useMemo(() => rangeParams(range), [range]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    Promise.all([api.dashboardSummary(params), api.opsSummary()])
      .then(([dash, opsSummary]) => {
        if (!alive) return;
        setSummary(dash);
        setOps(opsSummary);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Failed to load dashboard");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [params]);

  const severityData = useMemo(() => {
    if (!summary) return [];
    return (Object.keys(summary.severity) as Severity[])
      .map((key) => ({ name: key, value: summary.severity[key], color: SEV_COLORS[key] }))
      .filter((d) => d.value > 0);
  }, [summary]);

  const moduleData = useMemo(() => {
    const m = summary?.moduleCounts;
    if (!m) return [];
    return [
      { name: "FIM", value: m.fim },
      { name: "Malware", value: m.malware },
      { name: "SCA", value: m.sca },
      { name: "MITRE", value: m.mitreTechniques },
      { name: "Compliance", value: m.complianceFrameworks },
    ].filter((d) => d.value > 0);
  }, [summary]);

  const agentData = useMemo(
    () =>
      (summary?.agents ?? []).slice(0, 6).map((a) => ({
        name: a.name.length > 14 ? `${a.name.slice(0, 12)}…` : a.name,
        full: a.name,
        alerts: a.alertCount,
      })),
    [summary],
  );

  const timelineData = useMemo(
    () =>
      (summary?.timeline ?? []).map((t) => ({
        ...t,
        label: formatTick(t.at, range),
      })),
    [summary, range],
  );

  const opsData = useMemo(() => {
    if (!ops) return [];
    return [
      { name: "Incidents", value: ops.openIncidents, color: "#1c4ed8" },
      { name: "Tickets", value: ops.openTickets, color: "#0ea5e9" },
      { name: "Overdue", value: ops.overdueTickets, color: "#f97316" },
      { name: "Unread", value: ops.unreadNotifications, color: "#94a3b8" },
    ].filter((d) => d.value > 0);
  }, [ops]);

  const highCrit = summary ? summary.severity.high + summary.severity.critical : 0;
  const severityTotal = severityData.reduce((s, d) => s + d.value, 0) || 1;

  return (
    <div className="page dash">
      <header className="page-header">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1>Welcome back, {user?.name.split(" ")[0]}</h1>
          <p className="sub">Live posture from Wazuh — alerts, endpoints, detections, and response load.</p>
        </div>
        <div className="dash-hero-right">
          <div className="toolbar range-pills">
            {(["24h", "7d", "30d", "all"] as RangeKey[]).map((key) => (
              <button
                key={key}
                type="button"
                className={`btn ${range === key ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setRange(key)}
              >
                {key === "all" ? "All time" : key}
              </button>
            ))}
          </div>
          {summary && (
            <p className="source-pill">
              Source · {summary.source}
              {summary.range?.from ? " · filtered" : ""}
            </p>
          )}
        </div>
      </header>

      {loading && <p className="empty">Composing dashboard…</p>}
      {error && <p className="error-text">{error}</p>}

      {summary && (
        <>
          <div className="kpi-grid dash-kpis">
            <Link to="/app/alerts" className="kpi kpi-accent">
              <span>Total alerts</span>
              <strong>{summary.totals.alerts.toLocaleString()}</strong>
              <em>Indexed security events</em>
            </Link>
            <Link to="/app/alerts" className="kpi">
              <span>High + critical</span>
              <strong>{highCrit.toLocaleString()}</strong>
              <em>Needs attention</em>
            </Link>
            <Link to="/app/vulnerabilities" className="kpi">
              <span>Vulnerabilities</span>
              <strong>{summary.totals.vulnerabilities.toLocaleString()}</strong>
              <em>Package findings</em>
            </Link>
            <Link to="/app/endpoints" className="kpi">
              <span>Endpoints</span>
              <strong>{summary.totals.agentsObserved}</strong>
              <em>Observed in range</em>
            </Link>
          </div>

          <div className="dash-grid">
            <motion.section
              className="chart-panel wide"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              <div className="panel-head">
                <div>
                  <p className="eyebrow">Trend</p>
                  <h2>Alert volume</h2>
                </div>
                <Link to="/app/alerts" className="btn btn-ghost">
                  Open alerts
                </Link>
              </div>
              <div className="chart-frame tall">
                {timelineData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={timelineData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="alertsFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#1c4ed8" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#1c4ed8" stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="hcFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f97316" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#f97316" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(18,19,26,0.06)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: "#6b7080", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#6b7080", fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                      <Tooltip content={<ChartTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="alerts"
                        name="Alerts"
                        stroke="#1c4ed8"
                        strokeWidth={2.4}
                        fill="url(#alertsFill)"
                      />
                      <Area
                        type="monotone"
                        dataKey="highCritical"
                        name="High + critical"
                        stroke="#f97316"
                        strokeWidth={2}
                        fill="url(#hcFill)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="empty">No timeline points for this range.</p>
                )}
              </div>
            </motion.section>

            <motion.section
              className="chart-panel"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              <div className="panel-head">
                <div>
                  <p className="eyebrow">Severity</p>
                  <h2>Alert mix</h2>
                </div>
              </div>
              <div className="chart-frame pie-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={severityData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={58}
                      outerRadius={88}
                      paddingAngle={3}
                      stroke="rgba(255,255,255,0.9)"
                      strokeWidth={2}
                    >
                      {severityData.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pie-center">
                  <strong>{severityTotal.toLocaleString()}</strong>
                  <span>events</span>
                </div>
              </div>
              <div className="legend-row">
                {severityData.map((d) => (
                  <span key={d.name} className="legend-item">
                    <i style={{ background: d.color }} />
                    {d.name} · {d.value}
                  </span>
                ))}
              </div>
            </motion.section>

            <motion.section
              className="chart-panel"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              <div className="panel-head">
                <div>
                  <p className="eyebrow">Endpoints</p>
                  <h2>Top agents</h2>
                </div>
                <Link to="/app/endpoints" className="btn btn-ghost">
                  Inventory
                </Link>
              </div>
              <div className="chart-frame">
                {agentData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={agentData} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 4 }}>
                      <CartesianGrid stroke="rgba(18,19,26,0.06)" horizontal={false} />
                      <XAxis type="number" tick={{ fill: "#6b7080", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={88}
                        tick={{ fill: "#3a3d4a", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="alerts" name="Alerts" radius={[0, 10, 10, 0]} barSize={16}>
                        {agentData.map((_, i) => (
                          <Cell key={i} fill={i === 0 ? "#1c4ed8" : "#6b8cff"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="empty">No agent activity in range.</p>
                )}
              </div>
            </motion.section>

            <motion.section
              className="chart-panel"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              <div className="panel-head">
                <div>
                  <p className="eyebrow">Detection modules</p>
                  <h2>Coverage mix</h2>
                </div>
              </div>
              <div className="chart-frame pie-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={moduleData}
                      dataKey="value"
                      nameKey="name"
                      outerRadius={90}
                      innerRadius={42}
                      paddingAngle={2}
                      stroke="rgba(255,255,255,0.9)"
                      strokeWidth={2}
                    >
                      {moduleData.map((d, i) => (
                        <Cell key={d.name} fill={MODULE_COLORS[i % MODULE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="legend-row">
                {moduleData.map((d, i) => (
                  <Link
                    key={d.name}
                    to={
                      d.name === "FIM"
                        ? "/app/fim"
                        : d.name === "Malware"
                          ? "/app/malware"
                          : d.name === "SCA"
                            ? "/app/sca"
                            : d.name === "MITRE"
                              ? "/app/mitre"
                              : "/app/compliance"
                    }
                    className="legend-item"
                  >
                    <i style={{ background: MODULE_COLORS[i % MODULE_COLORS.length] }} />
                    {d.name} · {d.value.toLocaleString()}
                  </Link>
                ))}
              </div>
            </motion.section>

            <motion.section
              className="chart-panel"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              <div className="panel-head">
                <div>
                  <p className="eyebrow">Response</p>
                  <h2>Ops load</h2>
                </div>
              </div>
              <div className="chart-frame pie-wrap">
                {opsData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={opsData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={50}
                        outerRadius={82}
                        paddingAngle={3}
                        stroke="rgba(255,255,255,0.9)"
                        strokeWidth={2}
                      >
                        {opsData.map((d) => (
                          <Cell key={d.name} fill={d.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="empty">No open response work.</p>
                )}
              </div>
              {ops && (
                <div className="ops-links">
                  <Link to="/app/incidents">Incidents · {ops.openIncidents}</Link>
                  <Link to="/app/tickets">Tickets · {ops.openTickets}</Link>
                  <Link to="/app/tickets">Overdue · {ops.overdueTickets}</Link>
                </div>
              )}
            </motion.section>

            <motion.section
              className="chart-panel wide"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              <div className="panel-head">
                <div>
                  <p className="eyebrow">Live feed</p>
                  <h2>Latest alerts</h2>
                </div>
                <Link to="/app/alerts" className="btn btn-ghost">
                  View all
                </Link>
              </div>
              <ul className="recent-list premium">
                {summary.recentAlerts.map((a) => (
                  <li key={a.indexId}>
                    <div className="sev-dot" style={{ background: SEV_COLORS[a.severity] }} />
                    <div className="recent-body">
                      <strong>{a.ruleDescription}</strong>
                      <span>
                        {a.agentName} · {a.timestamp ? new Date(a.timestamp).toLocaleString() : "—"}
                      </span>
                    </div>
                    <span className={`sev sev-${a.severity}`}>{a.severity}</span>
                  </li>
                ))}
                {!summary.recentAlerts.length && <li className="empty">No recent alerts.</li>}
              </ul>
            </motion.section>
          </div>
        </>
      )}

      <style>{`
        .dash { gap: 0.85rem; }
        .dash-hero-right {
          display: grid;
          gap: 0.35rem;
          justify-items: end;
        }
        .source-pill {
          margin: 0;
          font-size: 0.72rem;
          color: var(--muted);
        }
        .dash-kpis .kpi {
          text-decoration: none;
          gap: 0.1rem;
        }
        .dash-kpis .kpi:hover {
          border-color: #b8c4d8;
          background: #fafbff;
        }
        .dash-kpis .kpi span {
          font-size: 0.68rem;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--muted);
          font-weight: 600;
        }
        .dash-kpis .kpi strong {
          font-size: 1.45rem;
          letter-spacing: -0.03em;
        }
        .dash-kpis .kpi em {
          font-style: normal;
          color: var(--muted);
          font-size: 0.75rem;
        }
        .kpi-accent {
          border-color: #bfdbfe;
          background: #eff6ff;
        }
        .dash-grid {
          display: grid;
          grid-template-columns: 1.35fr 1fr 1fr;
          gap: 0.75rem;
        }
        .chart-panel {
          display: grid;
          gap: 0.5rem;
          min-height: 280px;
          background: #fff;
          border: 1px solid var(--line);
          border-radius: var(--radius);
          padding: 0.8rem 0.9rem;
        }
        .chart-panel.wide { grid-column: 1 / -1; }
        .panel-head {
          display: flex;
          justify-content: space-between;
          align-items: start;
          gap: 0.65rem;
        }
        .panel-head h2 {
          margin: 0.1rem 0 0;
          font-size: 0.95rem;
          font-weight: 650;
          letter-spacing: -0.01em;
        }
        .chart-frame {
          height: 200px;
          width: 100%;
        }
        .chart-frame.tall { height: 240px; }
        .pie-wrap { position: relative; }
        .pie-center {
          position: absolute;
          inset: 0;
          display: grid;
          place-content: center;
          pointer-events: none;
          text-align: center;
        }
        .pie-center strong {
          font-size: 1.05rem;
          letter-spacing: -0.02em;
        }
        .pie-center span {
          color: var(--muted);
          font-size: 0.7rem;
        }
        .legend-row {
          display: flex;
          flex-wrap: wrap;
          gap: 0.35rem 0.65rem;
        }
        .legend-item {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.72rem;
          color: var(--ink-soft);
          text-decoration: none;
        }
        .legend-item i {
          width: 7px;
          height: 7px;
          border-radius: 2px;
          display: inline-block;
        }
        .ops-links {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
        }
        .ops-links a {
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          border: 1px solid var(--line);
          background: #f8fafc;
          font-size: 0.72rem;
          color: var(--ink-soft);
        }
        .chart-tip {
          background: #fff;
          border: 1px solid var(--line);
          border-radius: 6px;
          padding: 0.45rem 0.55rem;
          box-shadow: var(--shadow-sm);
          font-size: 0.72rem;
          color: var(--ink-soft);
        }
        .chart-tip strong {
          display: block;
          margin-bottom: 0.2rem;
          color: var(--ink);
        }
        .chart-tip div {
          display: flex;
          align-items: center;
          gap: 0.35rem;
        }
        .chart-tip span {
          width: 7px;
          height: 7px;
          border-radius: 2px;
          display: inline-block;
        }
        .recent-list.premium {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 0.35rem;
        }
        .recent-list.premium li {
          display: grid;
          grid-template-columns: 8px 1fr auto;
          gap: 0.65rem;
          align-items: center;
          padding: 0.55rem 0.65rem;
          border-radius: 6px;
          background: #f8fafc;
          border: 1px solid var(--line);
        }
        .sev-dot {
          width: 7px;
          height: 7px;
          border-radius: 2px;
        }
        .recent-body strong {
          display: block;
          margin-bottom: 0.1rem;
          font-size: 0.85rem;
          font-weight: 600;
        }
        .recent-body span {
          color: var(--muted);
          font-size: 0.72rem;
        }
        @media (max-width: 1100px) {
          .dash-grid { grid-template-columns: 1fr 1fr; }
          .chart-panel.wide { grid-column: 1 / -1; }
        }
        @media (max-width: 720px) {
          .dash-grid { grid-template-columns: 1fr; }
          .kpi-grid { grid-template-columns: 1fr 1fr; }
          .dash-hero-right { justify-items: start; width: 100%; }
        }
      `}</style>
    </div>
  );
}
