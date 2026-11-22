import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  api,
  type OpenCtiDashboard,
  type OpenCtiHealth,
  type ThreatFeedEvent,
} from "../api/client";
import { ThreatGlobe } from "../components/ThreatGlobe";
import "../styles/soc.css";

type StreamState = "connecting" | "streaming" | "polling" | "offline";

const FEED_CAP = 40;
const WINDOW_DAYS = 90;

const THREAT_BAR_COLORS = ["#ea580c", "#f97316", "#fb923c", "#fdba74", "#fed7aa", "#ffedd5"];
const MALWARE_RADAR_COLOR = "#7c3aed";

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
    <div className="ti-tooltip">
      {label && <strong>{label}</strong>}
      {payload.map((p) => (
        <div key={String(p.name)}>
          <span style={{ color: p.color || "var(--accent)" }}>{p.name}</span>:{" "}
          {Number(p.value ?? 0).toLocaleString()}
        </div>
      ))}
    </div>
  );
}

function EmptyWidget({ message }: { message: string }) {
  return <p className="ti-empty">{message}</p>;
}

export function ThreatIntelPage() {
  const [health, setHealth] = useState<OpenCtiHealth | null>(null);
  const [dashboard, setDashboard] = useState<OpenCtiDashboard | null>(null);
  const [uiUrl, setUiUrl] = useState("http://localhost:8080");
  const [feed, setFeed] = useState<ThreatFeedEvent[]>([]);
  const [streamState, setStreamState] = useState<StreamState>("connecting");
  const [lastEventAt, setLastEventAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const threatBars = useMemo(() => {
    const rows = dashboard?.activeThreats ?? [];
    return rows.map((t) => ({
      name: t.name.length > 22 ? `${t.name.slice(0, 20)}…` : t.name,
      fullName: t.name,
      count: t.count,
      entityType: t.entityType,
    }));
  }, [dashboard]);

  const malwareRadar = useMemo(() => {
    const rows = dashboard?.activeMalware ?? [];
    return rows.map((m) => ({
      name: m.name.length > 14 ? `${m.name.slice(0, 12)}…` : m.name,
      fullName: m.name,
      activity: m.count,
    }));
  }, [dashboard]);

  const victimBars = useMemo(() => {
    return (dashboard?.targetedVictims ?? []).map((v) => ({
      name: v.name.length > 20 ? `${v.name.slice(0, 18)}…` : v.name,
      count: v.count,
    }));
  }, [dashboard]);

  const vulnBars = useMemo(() => {
    return (dashboard?.vulnerabilities ?? []).map((v) => ({
      name: v.name.length > 18 ? `${v.name.slice(0, 16)}…` : v.name,
      count: v.count,
    }));
  }, [dashboard]);

  async function loadDashboard(alive = true) {
    setLoading(true);
    setError(null);
    const errors: string[] = [];

    const [h, dash] = await Promise.all([
      api.openctiHealth().catch((err) => {
        errors.push(err instanceof Error ? err.message : "Health failed");
        return null;
      }),
      api.openctiDashboard({ windowDays: WINDOW_DAYS }).catch((err) => {
        errors.push(err instanceof Error ? err.message : "Dashboard failed");
        return null;
      }),
    ]);

    if (!alive) return;

    if (h) {
      setHealth(h);
      if (h.uiUrl) setUiUrl(h.uiUrl);
    }
    if (dash) {
      setDashboard(dash.dashboard);
      if (dash.uiUrl) setUiUrl(dash.uiUrl);
    }

    if (errors.length && !dash) {
      setError(errors[0]);
      setStreamState("offline");
    }
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await loadDashboard(!cancelled);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (error && !health?.ok) return;

    setStreamState("connecting");
    const url = api.openctiStreamUrl();
    const es = new EventSource(url, { withCredentials: true });

    es.addEventListener("status", () => setStreamState("streaming"));

    es.addEventListener("threat", (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data) as ThreatFeedEvent;
        setFeed((prev) => {
          const next = [data, ...prev.filter((p) => p.id !== data.id)];
          return next.slice(0, FEED_CAP);
        });
        setLastEventAt(data.timestamp || new Date().toISOString());
        setStreamState("streaming");
      } catch {
        /* ignore */
      }
    });

    es.onerror = () => setStreamState("polling");

    const poll = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      api
        .openctiFeed({ limit: 20 })
        .then((res) => {
          setFeed((prev) => {
            const map = new Map<string, ThreatFeedEvent>();
            for (const e of [...res.events, ...prev]) map.set(e.id, e);
            return [...map.values()]
              .sort((a, b) => Date.parse(b.timestamp || "") - Date.parse(a.timestamp || ""))
              .slice(0, FEED_CAP);
          });
          if (res.events[0]?.timestamp) setLastEventAt(res.events[0].timestamp);
          setStreamState((s) => (s === "streaming" ? s : "polling"));
        })
        .catch(() => undefined);
    }, 45000);

    return () => {
      es.close();
      window.clearInterval(poll);
    };
  }, [error, health?.ok]);

  const pulseLabel =
    streamState === "streaming"
      ? "Live stream"
      : streamState === "polling"
        ? "Polling fallback"
        : streamState === "connecting"
          ? "Connecting…"
          : "Offline";

  const s = dashboard?.summary;
  const windowLabel = `Last ${dashboard?.windowDays ?? WINDOW_DAYS} days`;

  const kpis: Array<{
    key: string;
    label: string;
    value: number;
    delta: number;
    icon: string;
  }> = [
    {
      key: "intrusion",
      label: "Intrusion sets",
      value: s?.intrusionSets ?? 0,
      delta: s?.last24h.intrusionSets ?? 0,
      icon: "◆",
    },
    {
      key: "malware",
      label: "Malware",
      value: s?.malwares ?? 0,
      delta: s?.last24h.malwares ?? 0,
      icon: "☣",
    },
    {
      key: "reports",
      label: "Reports",
      value: s?.reports ?? 0,
      delta: s?.last24h.reports ?? 0,
      icon: "◫",
    },
    {
      key: "indicators",
      label: "Indicators",
      value: s?.indicators ?? 0,
      delta: s?.last24h.indicators ?? 0,
      icon: "◎",
    },
  ];

  return (
    <div className="page threat-intel-page">
      <header className="page-header ti-header">
        <div>
          <p className="eyebrow">Intelligence</p>
          <h1>Threat Intel</h1>
          <p className="sub">
            Premium OpenCTI landscape for Aegis — intrusion sets, malware, relationships, and live STIX
            activity.
          </p>
        </div>
        <div className="ti-header-actions">
          <div className={`threat-pulse ${streamState}`}>
            <span className="threat-pulse-dot" />
            <strong>{pulseLabel}</strong>
          </div>
          <div className="ti-meta">
            <span>
              OpenCTI{" "}
              {health?.ok ? (
                <em className="threat-ok">connected{health.version ? ` · v${health.version}` : ""}</em>
              ) : (
                <em className="threat-bad">unreachable</em>
              )}
            </span>
            <span>
              Last event <strong>{lastEventAt ? new Date(lastEventAt).toLocaleString() : "—"}</strong>
            </span>
          </div>
          <div className="toolbar">
            <a className="btn btn-ghost" href={uiUrl} target="_blank" rel="noreferrer">
              Open OpenCTI
            </a>
            <button className="btn btn-ghost" type="button" onClick={() => void loadDashboard()}>
              Refresh
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="warning-banner">
          {error}{" "}
          <button className="btn btn-ghost" type="button" onClick={() => void loadDashboard()}>
            Retry
          </button>
        </div>
      )}

      <div className="ti-kpi-row">
        {kpis.map((k, i) => (
          <motion.div
            key={k.key}
            className="ti-kpi"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <div className="ti-kpi-top">
              <span className="ti-kpi-icon" aria-hidden>
                {k.icon}
              </span>
              <span className="ti-kpi-label">{k.label}</span>
            </div>
            <strong className="ti-kpi-value">
              {loading && !dashboard ? "…" : k.value.toLocaleString()}
            </strong>
            <span className={`ti-kpi-delta ${k.delta > 0 ? "up" : ""}`}>
              {k.delta > 0 ? `+${k.delta.toLocaleString()} in 24h` : "No change in 24h"}
            </span>
          </motion.div>
        ))}
      </div>

      <div className="ti-grid">
        <motion.section className="ti-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="ti-card-head">
            <h2>Most active threats</h2>
            <span className="ti-window">{windowLabel}</span>
          </div>
          {threatBars.length > 0 ? (
            <div className="ti-chart" style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={threatBars} layout="vertical" margin={{ left: 4, right: 12, top: 4, bottom: 4 }}>
                  <CartesianGrid stroke="rgba(18,19,26,0.06)" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={118}
                    tick={{ fill: "#5b6170", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="count" name="Relationships" radius={[0, 5, 5, 0]} barSize={14}>
                    {threatBars.map((_, idx) => (
                      <Cell key={idx} fill={THREAT_BAR_COLORS[idx % THREAT_BAR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyWidget message="No active threat relationships in this window." />
          )}
        </motion.section>

        <motion.section className="ti-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="ti-card-head">
            <h2>Most targeted victims</h2>
            <span className="ti-window">{windowLabel}</span>
          </div>
          {victimBars.length > 0 ? (
            <div className="ti-chart" style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={victimBars} layout="vertical" margin={{ left: 4, right: 12 }}>
                  <CartesianGrid stroke="rgba(18,19,26,0.06)" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={118}
                    tick={{ fill: "#5b6170", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="count" name="Targets" fill="#0ea5e9" radius={[0, 5, 5, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyWidget message="No entities of this type has been found." />
          )}
        </motion.section>

        <motion.section className="ti-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="ti-card-head">
            <h2>Relationships created</h2>
            <span className="ti-window">{windowLabel}</span>
          </div>
          {(dashboard?.relationshipTimeline.some((t) => t.count > 0) ?? false) ? (
            <div className="ti-chart" style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={dashboard?.relationshipTimeline ?? []}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="tiRelFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(18,19,26,0.06)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "#6b7080", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis tick={{ fill: "#6b7080", fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    name="Relationships"
                    stroke="#2563eb"
                    strokeWidth={2.2}
                    fill="url(#tiRelFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyWidget message="Relationship timeline is empty for this window." />
          )}
        </motion.section>

        <motion.section className="ti-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="ti-card-head">
            <h2>Most active malware</h2>
            <span className="ti-window">{windowLabel}</span>
          </div>
          {malwareRadar.length > 0 ? (
            <div className="ti-chart" style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={malwareRadar} cx="50%" cy="52%" outerRadius="72%">
                  <PolarGrid stroke="rgba(18,19,26,0.1)" />
                  <PolarAngleAxis dataKey="name" tick={{ fill: "#5b6170", fontSize: 10 }} />
                  <PolarRadiusAxis tick={false} axisLine={false} />
                  <Radar
                    name="Activity"
                    dataKey="activity"
                    stroke={MALWARE_RADAR_COLOR}
                    fill={MALWARE_RADAR_COLOR}
                    fillOpacity={0.28}
                    strokeWidth={2}
                  />
                  <Tooltip content={<ChartTooltip />} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyWidget message="No malware activity signals yet." />
          )}
        </motion.section>

        <motion.section className="ti-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="ti-card-head">
            <h2>Most active vulnerabilities</h2>
            <span className="ti-window">{windowLabel}</span>
          </div>
          {vulnBars.length > 0 ? (
            <div className="ti-chart" style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={vulnBars} layout="vertical" margin={{ left: 4, right: 12 }}>
                  <CartesianGrid stroke="rgba(18,19,26,0.06)" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={118}
                    tick={{ fill: "#5b6170", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="count" name="Seen" fill="#db2777" radius={[0, 5, 5, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyWidget message="No entities of this type has been found." />
          )}
        </motion.section>

        <motion.section className="ti-card ti-span-3 ti-globe-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="ti-card-head">
            <h2>Targeted countries</h2>
            <span className="ti-window">{windowLabel} · interactive globe</span>
          </div>
          <ThreatGlobe countries={dashboard?.countries ?? []} height={440} />
        </motion.section>

        <motion.section className="ti-card ti-span-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="ti-card-head">
            <h2>Latest reports</h2>
            <span className="ti-window">Recent</span>
          </div>
          {(dashboard?.recentReports.length ?? 0) > 0 ? (
            <ul className="ti-report-list">
              {dashboard!.recentReports.map((r) => (
                <li key={r.id}>
                  <strong>{r.name}</strong>
                  <span>{r.createdAt ? new Date(r.createdAt).toLocaleString() : "—"}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyWidget message="No reports ingested yet. Connectors or analysts can publish them in OpenCTI." />
          )}
        </motion.section>

        <motion.section className="ti-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="ti-card-head">
            <h2>Most active labels</h2>
            <span className="ti-window">{windowLabel}</span>
          </div>
          {(dashboard?.activeLabels.length ?? 0) > 0 ? (
            <div className="ti-label-cloud">
              {dashboard!.activeLabels.map((l) => (
                <span
                  key={l.value}
                  className="ti-label-chip"
                  style={{
                    borderColor: l.color || "var(--line)",
                    background: l.color ? `${l.color}22` : "var(--accent-soft)",
                  }}
                >
                  {l.value}
                  <em>{l.count}</em>
                </span>
              ))}
            </div>
          ) : (
            <EmptyWidget message="No labels attached to recent threat objects." />
          )}
        </motion.section>
      </div>

      <section className="ti-card ti-live">
        <div className="ti-card-head">
          <h2>Live activity</h2>
          <span className="badge">{feed.length} events</span>
        </div>
        <div className="ti-live-rail">
          {feed.slice(0, 12).map((e) => (
            <article key={`${e.eventId || e.id}-${e.timestamp}`} className="ti-live-item">
              <span className="badge">{e.entityType}</span>
              <strong>{e.name}</strong>
              <span className="ti-live-time">
                {e.timestamp ? new Date(e.timestamp).toLocaleString() : "—"}
              </span>
            </article>
          ))}
          {!loading && feed.length === 0 && (
            <p className="ti-empty">Waiting for stream or poll events from OpenCTI…</p>
          )}
        </div>
      </section>

      <style>{`
        .ti-header {
          align-items: flex-start;
        }
        .ti-header-actions {
          display: grid;
          gap: 0.45rem;
          justify-items: end;
          text-align: right;
        }
        .ti-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 0.65rem 1rem;
          justify-content: flex-end;
          color: var(--muted);
          font-size: 0.78rem;
        }
        .ti-meta em { font-style: normal; font-weight: 650; }
        .threat-ok { color: var(--success); }
        .threat-bad { color: var(--danger); }
        .threat-pulse {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          font-size: 0.88rem;
        }
        .threat-pulse-dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: var(--muted);
        }
        .threat-pulse.streaming .threat-pulse-dot {
          background: var(--success);
          box-shadow: 0 0 0 0 rgba(31, 122, 76, 0.45);
          animation: threatPulse 1.6s ease-out infinite;
        }
        .threat-pulse.polling .threat-pulse-dot { background: #f59e0b; }
        .threat-pulse.connecting .threat-pulse-dot { background: var(--accent); }
        .threat-pulse.offline .threat-pulse-dot { background: var(--danger); }
        @keyframes threatPulse {
          0% { box-shadow: 0 0 0 0 rgba(31, 122, 76, 0.45); }
          70% { box-shadow: 0 0 0 10px rgba(31, 122, 76, 0); }
          100% { box-shadow: 0 0 0 0 rgba(31, 122, 76, 0); }
        }

        .ti-kpi-row {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.75rem;
        }
        .ti-kpi {
          background: var(--surface-solid);
          border: 1px solid var(--line);
          border-radius: var(--radius);
          padding: 0.9rem 1rem;
          display: grid;
          gap: 0.35rem;
          min-height: 104px;
        }
        .ti-kpi-top {
          display: flex;
          align-items: center;
          gap: 0.45rem;
        }
        .ti-kpi-icon {
          width: 1.55rem;
          height: 1.55rem;
          display: grid;
          place-items: center;
          border-radius: 0.4rem;
          background: var(--accent-soft);
          color: var(--accent);
          font-size: 0.8rem;
        }
        .ti-kpi-label {
          color: var(--muted);
          font-size: 0.78rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .ti-kpi-value {
          font-size: 1.75rem;
          letter-spacing: -0.03em;
          line-height: 1;
          color: var(--ink);
        }
        .ti-kpi-delta {
          font-size: 0.75rem;
          color: var(--muted);
        }
        .ti-kpi-delta.up { color: #c2410c; font-weight: 600; }

        .ti-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.75rem;
        }
        .ti-card {
          background: var(--surface-solid);
          border: 1px solid var(--line);
          border-radius: var(--radius);
          padding: 0.85rem 0.95rem 0.95rem;
          min-height: 320px;
          display: flex;
          flex-direction: column;
        }
        .ti-card.ti-span-2 { grid-column: span 2; }
        .ti-card.ti-span-3 { grid-column: 1 / -1; }
        .ti-card.ti-globe-card { min-height: 0; }
        .ti-card.ti-live {
          min-height: 0;
          margin-top: 0;
        }
        .ti-card-head {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 0.5rem;
          margin-bottom: 0.55rem;
        }
        .ti-card-head h2 {
          margin: 0;
          font-size: 0.78rem;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--ink-soft);
        }
        .ti-window {
          color: var(--muted);
          font-size: 0.68rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .ti-chart { width: 100%; flex: 1; min-height: 220px; }
        .ti-empty {
          margin: auto;
          color: var(--muted);
          font-size: 0.86rem;
          text-align: center;
          padding: 1.5rem 1rem;
          line-height: 1.45;
        }
        .ti-tooltip {
          background: #fff;
          border: 1px solid var(--line);
          border-radius: 8px;
          padding: 0.45rem 0.6rem;
          font-size: 0.78rem;
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
        }
        .ti-tooltip strong { display: block; margin-bottom: 0.2rem; }

        .ti-globe {
          display: grid;
          gap: 0.55rem;
        }
        .ti-globe-stage {
          position: relative;
          width: 100%;
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid var(--line);
          background:
            radial-gradient(ellipse at 30% 20%, rgba(147, 197, 253, 0.35), transparent 55%),
            radial-gradient(ellipse at 70% 80%, rgba(37, 99, 235, 0.12), transparent 50%),
            linear-gradient(180deg, #eef3fb 0%, #e2eaf6 100%);
        }
        .ti-globe-stage canvas {
          display: block;
          margin: 0 auto;
        }
        .ti-globe-toolbar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.4rem;
        }
        .ti-globe-hint {
          margin-left: auto;
          color: var(--muted);
          font-size: 0.72rem;
        }
        .ti-globe-footer {
          min-height: 1.5rem;
        }
        .ti-globe-status {
          margin: 0;
          color: var(--muted);
          font-size: 0.82rem;
        }
        .ti-globe-selection {
          display: flex;
          flex-wrap: wrap;
          gap: 0.45rem 0.85rem;
          align-items: baseline;
          font-size: 0.84rem;
        }
        .ti-globe-selection span { color: var(--muted); }
        .ti-country-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 0.35rem;
        }
        .ti-globe-chip {
          cursor: pointer;
          border: 0;
          font: inherit;
        }
        .ti-globe-chip:hover {
          outline: 2px solid var(--accent-soft);
        }
        .ti-globe-tip {
          font-family: var(--font);
          font-size: 12px;
          line-height: 1.35;
          padding: 2px 0;
        }
        .ti-globe-tip strong { display: block; }
        .ti-globe-tip span { opacity: 0.8; }

        .ti-report-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 0.45rem;
        }
        .ti-report-list li {
          display: flex;
          justify-content: space-between;
          gap: 0.75rem;
          padding: 0.55rem 0.65rem;
          border: 1px solid var(--line);
          border-radius: var(--radius-sm);
          background: #fafbfc;
        }
        .ti-report-list strong { font-size: 0.88rem; }
        .ti-report-list span { color: var(--muted); font-size: 0.75rem; white-space: nowrap; }

        .ti-label-cloud {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
          align-content: flex-start;
        }
        .ti-label-chip {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          border: 1px solid var(--line);
          border-radius: 999px;
          padding: 0.28rem 0.55rem;
          font-size: 0.78rem;
          font-weight: 600;
        }
        .ti-label-chip em {
          font-style: normal;
          color: var(--muted);
          font-weight: 700;
        }

        .ti-live-rail {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 0.45rem;
        }
        .ti-live-item {
          border: 1px solid var(--line);
          border-radius: var(--radius-sm);
          padding: 0.55rem 0.65rem;
          display: grid;
          gap: 0.25rem;
          background: #fff;
        }
        .ti-live-item strong {
          font-size: 0.84rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .ti-live-time { color: var(--muted); font-size: 0.7rem; }

        @media (max-width: 1100px) {
          .ti-kpi-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .ti-grid { grid-template-columns: 1fr 1fr; }
          .ti-card.ti-span-2, .ti-card.ti-span-3 { grid-column: 1 / -1; }
          .ti-globe-hint { margin-left: 0; width: 100%; }
        }
        @media (max-width: 720px) {
          .ti-kpi-row, .ti-grid { grid-template-columns: 1fr; }
          .ti-card.ti-span-2, .ti-card.ti-span-3 { grid-column: span 1; }
          .ti-header-actions { justify-items: start; text-align: left; }
          .ti-meta { justify-content: flex-start; }
        }
      `}</style>
    </div>
  );
}
