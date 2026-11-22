import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type FimEvent } from "../api/client";
import { AskAiButton } from "../components/AskAiButton";
import { ListControls, SortableTimeTh } from "../components/ListControls";
import {
  DEFAULT_LIST_CONTROLS,
  listQueryParams,
  toggleSort,
  type ListControlValue,
} from "../lib/listControls";
import "../styles/soc.css";

export function FimPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<FimEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [controls, setControls] = useState<ListControlValue>(DEFAULT_LIST_CONTROLS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<FimEvent | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    setLoading(true);
    api
      .fim({ page: 1, pageSize: 50, q, ...listQueryParams(controls) })
      .then((res) => {
        setEvents(res.events);
        setTotal(res.total);
        setNote(res.note);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load FIM"))
      .finally(() => setLoading(false));
  }, [q, controls]);

  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow">Integrity</p>
        <h1>File Integrity</h1>
        <p className="sub">Syscheck create/modify/delete events across monitored endpoints.</p>
      </header>

      <section className="panel glass">
        <div className="toolbar" style={{ flexDirection: "column", alignItems: "stretch" }}>
          <ListControls value={controls} onChange={setControls} />
          <div className="toolbar">
            <input placeholder="Search path or rule…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
      </section>

      {note && <div className="warning-banner">{note}</div>}

      <section className="panel glass">
        {loading && <p className="empty">Loading FIM events…</p>}
        {error && <p className="error-text">{error}</p>}
        {!loading && !error && total === 0 && (
          <p className="empty">No syscheck events yet. Once FIM is enabled on agents, changes will appear here.</p>
        )}
        {!loading && !error && events.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <SortableTimeTh
                  sort={controls.sort}
                  onToggle={() => setControls((c) => ({ ...c, sort: toggleSort(c.sort) }))}
                />
                <th>Event</th>
                <th>Path</th>
                <th>Agent</th>
                <th>Rule</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.indexId} onClick={() => setSelected(e)}>
                  <td>{e.timestamp ? new Date(e.timestamp).toLocaleString() : "—"}</td>
                  <td>
                    <span className="badge">{e.event}</span>
                  </td>
                  <td>
                    <strong>{e.path || "—"}</strong>
                  </td>
                  <td>{e.agentName}</td>
                  <td>{e.ruleDescription}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {selected && (
        <>
          <div className="drawer-backdrop" onClick={() => setSelected(null)} />
          <aside className="drawer">
            <button className="btn btn-ghost" type="button" onClick={() => setSelected(null)}>
              Close
            </button>
            <h2>{selected.path || selected.ruleDescription}</h2>
            <div className="meta-grid">
              <div>
                <span>Event</span>
                <strong>{selected.event}</strong>
              </div>
              <div>
                <span>Agent</span>
                <strong>{selected.agentName}</strong>
              </div>
              <div>
                <span>Hashes</span>
                <strong style={{ wordBreak: "break-all", fontWeight: 400, fontSize: "0.82rem" }}>
                  md5: {selected.md5 || "—"}
                  {"\n"}sha256: {selected.sha256 || "—"}
                </strong>
              </div>
            </div>
            <div className="toolbar">
              <AskAiButton
                selection={{
                  type: "fim",
                  id: selected.indexId,
                  title: selected.path || selected.ruleDescription,
                  meta: { agentName: selected.agentName, event: selected.event },
                }}
              />
              <button
                className="btn btn-primary"
                type="button"
                disabled={creating}
                onClick={async () => {
                  setCreating(true);
                  try {
                    const res = await api.createIncident({
                      title: `FIM: ${selected.path || selected.ruleDescription}`,
                      description: selected.fullLog || selected.ruleDescription,
                      severity: selected.level >= 8 ? "HIGH" : "MEDIUM",
                      alertIndexId: selected.indexId,
                      alertRuleId: selected.ruleId,
                      alertRuleDescription: selected.ruleDescription,
                      agentName: selected.agentName,
                      agentId: selected.agentId,
                    });
                    navigate(`/app/incidents?id=${res.incident.id}`);
                  } finally {
                    setCreating(false);
                  }
                }}
              >
                {creating ? "Creating…" : "Create incident"}
              </button>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
