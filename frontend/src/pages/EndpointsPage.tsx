import { useEffect, useMemo, useState } from "react";
import { api, type Agent, type AgentRelated } from "../api/client";
import { AskAiButton } from "../components/AskAiButton";
import { ListControls, SortableTimeTh } from "../components/ListControls";
import {
  applyClientListControls,
  DEFAULT_LIST_CONTROLS,
  toggleSort,
  type ListControlValue,
} from "../lib/listControls";
import "../styles/soc.css";

export function EndpointsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [warning, setWarning] = useState<string | null>(null);
  const [source, setSource] = useState("");
  const [controls, setControls] = useState<ListControlValue>(DEFAULT_LIST_CONTROLS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Agent | null>(null);
  const [related, setRelated] = useState<AgentRelated | null>(null);
  const [relatedLoading, setRelatedLoading] = useState(false);

  const visibleAgents = useMemo(
    () =>
      applyClientListControls(agents, controls, {
        time: (a) => a.lastKeepAlive,
        agent: (a) => `${a.name} ${a.id}`,
      }),
    [agents, controls],
  );

  useEffect(() => {
    api
      .agents()
      .then((res) => {
        setAgents(res.agents);
        setWarning(res.warning);
        setSource(res.source);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load endpoints"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selected) {
      setRelated(null);
      return;
    }
    let alive = true;
    setRelatedLoading(true);
    const key = selected.id && selected.id !== "—" ? selected.id : selected.name;
    api
      .agentRelated(key)
      .then((res) => {
        if (alive) setRelated(res);
      })
      .catch(() => {
        if (alive) setRelated({ alerts: [], vulnerabilities: [], fimEvents: [] });
      })
      .finally(() => {
        if (alive) setRelatedLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [selected]);

  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow">Inventory</p>
        <h1>Endpoints</h1>
        <p className="sub">Monitored assets from Wazuh — agent status when API is healthy, telemetry fallback otherwise.</p>
      </header>

      {warning && <div className="warning-banner">{warning}</div>}

      <section className="panel glass">
        <ListControls
          value={controls}
          onChange={setControls}
          agentPlaceholder="Filter by endpoint name or ID…"
        />
      </section>

      <section className="panel glass">
        {loading && <p className="empty">Loading endpoints…</p>}
        {error && <p className="error-text">{error}</p>}
        {!loading && !error && (
          <>
            <p className="empty" style={{ paddingTop: 0 }}>
              Source: {source} · {visibleAgents.length} of {agents.length} endpoint
              {agents.length === 1 ? "" : "s"}
            </p>
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Status</th>
                  <th>IP / OS</th>
                  <SortableTimeTh
                    label="Last seen"
                    sort={controls.sort}
                    onToggle={() => setControls((c) => ({ ...c, sort: toggleSort(c.sort) }))}
                  />
                </tr>
              </thead>
              <tbody>
                {visibleAgents.map((a) => (
                  <tr key={`${a.id}-${a.name}`} onClick={() => setSelected(a)}>
                    <td>{a.id}</td>
                    <td>
                      <strong>{a.name}</strong>
                      {typeof a.alertCount === "number" && (
                        <div style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
                          {a.alertCount} alerts observed
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="badge">{a.status}</span>
                    </td>
                    <td>
                      {a.ip || "—"}
                      <div style={{ color: "var(--muted)", fontSize: "0.8rem" }}>{a.os || a.version || "—"}</div>
                    </td>
                    <td>
                      {a.lastKeepAlive
                        ? Number.isFinite(Date.parse(a.lastKeepAlive))
                          ? new Date(a.lastKeepAlive).toLocaleString()
                          : a.lastKeepAlive
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>

      {selected && (
        <>
          <div className="drawer-backdrop" onClick={() => setSelected(null)} />
          <aside className="drawer">
            <button className="btn btn-ghost" type="button" onClick={() => setSelected(null)}>
              Close
            </button>
            <h2>{selected.name}</h2>
            <span className="badge">{selected.status}</span>
            <div className="meta-grid">
              <div>
                <span>Agent ID</span>
                <strong>{selected.id}</strong>
              </div>
              <div>
                <span>IP</span>
                <strong>{selected.ip || "—"}</strong>
              </div>
              <div>
                <span>OS / version</span>
                <strong>{selected.os || selected.version || "—"}</strong>
              </div>
              <div>
                <span>Last seen</span>
                <strong>
                  {selected.lastKeepAlive
                    ? Number.isFinite(Date.parse(selected.lastKeepAlive))
                      ? new Date(selected.lastKeepAlive).toLocaleString()
                      : selected.lastKeepAlive
                    : "—"}
                </strong>
              </div>
            </div>

            <div className="toolbar" style={{ marginBottom: "0.75rem" }}>
              <AskAiButton
                selection={{
                  type: "endpoint",
                  id: selected.id,
                  title: selected.name,
                  meta: { status: selected.status, ip: selected.ip, os: selected.os },
                }}
              />
            </div>

            {relatedLoading && <p className="empty">Loading related activity…</p>}
            {related && !relatedLoading && (
              <>
                <p className="eyebrow">Recent alerts</p>
                <ul className="related-list">
                  {related.alerts.length === 0 && <li className="empty">No recent alerts</li>}
                  {related.alerts.map((a) => (
                    <li key={a.indexId}>
                      <strong>{a.ruleDescription}</strong>
                      <span>
                        {a.severity} · {a.timestamp ? new Date(a.timestamp).toLocaleString() : "—"}
                      </span>
                    </li>
                  ))}
                </ul>

                <p className="eyebrow">Vulnerabilities</p>
                <ul className="related-list">
                  {related.vulnerabilities.length === 0 && <li className="empty">No recent vulns</li>}
                  {related.vulnerabilities.map((v) => (
                    <li key={v.id}>
                      <strong>{v.cve}</strong>
                      <span>
                        {v.severity} · {v.packageName}
                      </span>
                    </li>
                  ))}
                </ul>

                <p className="eyebrow">FIM events</p>
                <ul className="related-list">
                  {related.fimEvents.length === 0 && <li className="empty">No recent FIM events</li>}
                  {related.fimEvents.map((e) => (
                    <li key={e.indexId}>
                      <strong>{e.path || e.ruleDescription}</strong>
                      <span>
                        {e.event} · {e.timestamp ? new Date(e.timestamp).toLocaleString() : "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </aside>
        </>
      )}

      <style>{`
        .related-list {
          list-style: none;
          margin: 0 0 1rem;
          padding: 0;
          display: grid;
          gap: 0.45rem;
        }
        .related-list li {
          padding: 0.55rem 0.65rem;
          border-radius: 12px;
          background: rgba(255,255,255,0.55);
          border: 1px solid var(--line);
        }
        .related-list strong {
          display: block;
          font-size: 0.9rem;
          margin-bottom: 0.15rem;
        }
        .related-list span {
          color: var(--muted);
          font-size: 0.78rem;
        }
      `}</style>
    </div>
  );
}
