import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  api,
  type Incident,
  type IncidentDetail,
  type IncidentInvestigation,
} from "../api/client";
import { AskAiButton } from "../components/AskAiButton";
import { ListControls, SortableTimeTh } from "../components/ListControls";
import {
  DEFAULT_LIST_CONTROLS,
  listQueryParams,
  toggleSort,
  type ListControlValue,
} from "../lib/listControls";
import "../styles/soc.css";

const STATUSES = ["OPEN", "INVESTIGATING", "CONTAINED", "RESOLVED", "CLOSED"];
const SEVERITIES = ["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"];

export function IncidentsPage() {
  const [params] = useSearchParams();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selected, setSelected] = useState<IncidentDetail | null>(null);
  const [investigation, setInvestigation] = useState<IncidentInvestigation | null>(null);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [controls, setControls] = useState<ListControlValue>(DEFAULT_LIST_CONTROLS);
  const [note, setNote] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [proposing, setProposing] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const focusId = params.get("id");

  async function loadList() {
    setLoading(true);
    try {
      const res = await api.incidents({ status, q, ...listQueryParams(controls) });
      setIncidents(res.incidents);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load incidents");
    } finally {
      setLoading(false);
    }
  }

  async function openIncident(id: string) {
    const [inc, inv] = await Promise.all([
      api.incident(id),
      api.incidentInvestigation(id).catch(() => null),
    ]);
    setSelected(inc.incident);
    setInvestigation(inv?.investigation ?? null);
    setActionMsg(null);
  }

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, q, controls]);

  useEffect(() => {
    if (focusId) openIncident(focusId).catch(() => undefined);
  }, [focusId]);

  const openCount = useMemo(
    () => incidents.filter((i) => !["RESOLVED", "CLOSED"].includes(i.status)).length,
    [incidents],
  );

  async function createBlank() {
    if (!title.trim()) return;
    setCreating(true);
    try {
      const res = await api.createIncident({ title: title.trim(), severity: "MEDIUM" });
      setTitle("");
      await loadList();
      await openIncident(res.incident.id);
    } finally {
      setCreating(false);
    }
  }

  async function updateStatus(next: string) {
    if (!selected) return;
    await api.updateIncident(selected.id, { status: next });
    await loadList();
    await openIncident(selected.id);
  }

  async function addNote() {
    if (!selected || !note.trim()) return;
    await api.addIncidentNote(selected.id, note.trim());
    setNote("");
    await openIncident(selected.id);
    await loadList();
  }

  async function proposePlaybook(key: string, name: string) {
    if (!selected) return;
    setProposing(key);
    setActionMsg(null);
    try {
      const res = await api.proposeResponseAction({
        playbookKey: key,
        rationale: `Proposed from investigation workspace for incident "${selected.title}"`,
        targetType: "incident",
        targetId: selected.id,
        targetLabel: selected.title,
        incidentId: selected.id,
        agentId: selected.agentId || undefined,
        agentName: selected.agentName || undefined,
      });
      setActionMsg(
        res.autoExecuted
          ? `${name} executed (${res.action.status}${res.action.dryRun ? ", dry-run" : ""}).`
          : `${name} proposed — awaiting administrator approval.`,
      );
      await openIncident(selected.id);
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : "Propose failed");
    } finally {
      setProposing(null);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow">Response</p>
        <h1>Incidents</h1>
        <p className="sub">Investigate and track security incidents — AI workspace + playbook proposals.</p>
      </header>

      <div className="kpi-grid">
        <div className="kpi glass">
          <strong>{openCount}</strong>
          <span>Open in view</span>
        </div>
        <div className="kpi glass">
          <strong>{incidents.length}</strong>
          <span>Listed</span>
        </div>
      </div>

      <section className="panel glass">
        <div className="toolbar" style={{ flexDirection: "column", alignItems: "stretch" }}>
          <ListControls value={controls} onChange={setControls} />
          <div className="toolbar">
            <input placeholder="Search incidents…" value={q} onChange={(e) => setQ(e.target.value)} />
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <input placeholder="New incident title…" value={title} onChange={(e) => setTitle(e.target.value)} />
            <button className="btn btn-primary" type="button" disabled={creating} onClick={createBlank}>
              Create
            </button>
          </div>
        </div>
      </section>

      <section className="panel glass">
        {loading && <p className="empty">Loading incidents…</p>}
        {error && <p className="error-text">{error}</p>}
        {!loading && !error && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Owner</th>
                <SortableTimeTh
                  label="Updated"
                  sort={controls.sort}
                  onToggle={() => setControls((c) => ({ ...c, sort: toggleSort(c.sort) }))}
                />
              </tr>
            </thead>
            <tbody>
              {incidents.map((i) => (
                <tr key={i.id} onClick={() => openIncident(i.id)}>
                  <td>
                    <strong>{i.title}</strong>
                    <div style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
                      {i.agentName || i.alertRuleDescription || "—"}
                    </div>
                  </td>
                  <td>
                    <span className={`sev sev-${i.severity.toLowerCase()}`}>{i.severity}</span>
                  </td>
                  <td>
                    <span className="badge">{i.status}</span>
                  </td>
                  <td>{i.owner?.name || "—"}</td>
                  <td>{new Date(i.updatedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {selected && (
        <>
          <div className="drawer-backdrop" onClick={() => setSelected(null)} />
          <aside className="drawer" style={{ width: "min(480px, 96vw)" }}>
            <button className="btn btn-ghost" type="button" onClick={() => setSelected(null)}>
              Close
            </button>
            <h2>{selected.title}</h2>
            <div className="toolbar" style={{ margin: "0.35rem 0 0.75rem" }}>
              <span className={`sev sev-${selected.severity.toLowerCase()}`}>{selected.severity}</span>
              <AskAiButton
                selection={{ type: "incident", id: selected.id, title: selected.title }}
                label="Ask AI"
              />
            </div>
            <p style={{ color: "var(--ink-soft)", lineHeight: 1.5 }}>{selected.description || "No description."}</p>

            <div className="field">
              <label>Status</label>
              <select value={selected.status} onChange={(e) => updateStatus(e.target.value)}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="meta-grid">
              <div>
                <span>Linked alert</span>
                <strong>{selected.alertRuleDescription || selected.alertRuleId || "—"}</strong>
              </div>
              <div>
                <span>Agent</span>
                <strong>
                  {selected.agentName || "—"} {selected.agentId ? `(${selected.agentId})` : ""}
                </strong>
              </div>
            </div>

            {investigation && (
              <section style={{ marginTop: "1rem" }}>
                <h3 style={{ fontSize: "0.95rem", margin: "0 0 0.55rem" }}>Investigation workspace</h3>
                <div className="kpi-grid">
                  <div className="kpi glass">
                    <strong>{investigation.summary.relatedAlertCount}</strong>
                    <span>Related alerts</span>
                  </div>
                  <div className="kpi glass">
                    <strong>{investigation.summary.relatedVulnCount}</strong>
                    <span>Vulns</span>
                  </div>
                  <div className="kpi glass">
                    <strong>{investigation.summary.pendingActionCount}</strong>
                    <span>Pending SOAR</span>
                  </div>
                </div>

                {investigation.relatedAlerts.length > 0 && (
                  <div className="meta-grid" style={{ marginTop: "0.75rem" }}>
                    <div>
                      <span>Correlated alerts</span>
                      <strong style={{ fontWeight: 400 }}>
                        {investigation.relatedAlerts.slice(0, 5).map((a) => (
                          <div key={a.indexId} style={{ marginBottom: "0.35rem", fontSize: "0.85rem" }}>
                            {a.ruleDescription} · {a.severity}
                          </div>
                        ))}
                      </strong>
                    </div>
                  </div>
                )}

                <div style={{ marginTop: "0.85rem" }}>
                  <span style={{ color: "var(--muted)", fontSize: "0.78rem" }}>Suggest playbook</span>
                  <div className="toolbar" style={{ flexWrap: "wrap", marginTop: "0.4rem" }}>
                    {investigation.suggestedPlaybooks.slice(0, 5).map((p) => (
                      <button
                        key={p.key}
                        className="btn btn-ghost"
                        type="button"
                        disabled={proposing === p.key}
                        onClick={() => proposePlaybook(p.key, p.name)}
                        title={p.description}
                      >
                        {proposing === p.key ? "…" : p.name}
                      </button>
                    ))}
                  </div>
                  {actionMsg && <p className="empty" style={{ paddingTop: "0.45rem" }}>{actionMsg}</p>}
                </div>

                <div style={{ marginTop: "0.85rem" }}>
                  <span style={{ color: "var(--muted)", fontSize: "0.78rem" }}>Timeline</span>
                  <strong style={{ fontWeight: 400, display: "block", marginTop: "0.35rem" }}>
                    {investigation.timeline.slice(0, 8).map((t, idx) => (
                      <div key={`${t.at}-${idx}`} style={{ marginBottom: "0.4rem", fontSize: "0.82rem" }}>
                        <span className="badge">{t.kind}</span> {t.label}
                        <div style={{ color: "var(--muted)" }}>{t.detail}</div>
                      </div>
                    ))}
                  </strong>
                </div>
              </section>
            )}

            <div className="field">
              <label>Add note</label>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Investigation note…" />
            </div>
            <button className="btn btn-primary" type="button" onClick={addNote}>
              Save note
            </button>

            <div className="meta-grid">
              <div>
                <span>Notes</span>
                <strong style={{ fontWeight: 400 }}>
                  {(selected.notes || []).map((n) => (
                    <div key={n.id} style={{ marginBottom: "0.55rem" }}>
                      <div>{n.body}</div>
                      <div style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
                        {n.user.name} · {new Date(n.createdAt).toLocaleString()}
                      </div>
                    </div>
                  ))}
                  {!selected.notes?.length && "—"}
                </strong>
              </div>
              <div>
                <span>Tickets</span>
                <strong style={{ fontWeight: 400 }}>
                  {(investigation?.tickets || selected.tickets || []).map((t) => (
                    <div key={t.id} style={{ marginBottom: "0.35rem", fontSize: "0.85rem" }}>
                      {t.title} · {t.status}
                    </div>
                  ))}
                  {!(investigation?.tickets?.length || selected.tickets?.length) && "—"}
                </strong>
              </div>
            </div>

            <div className="field">
              <label>Severity reference</label>
              <div className="toolbar">
                {SEVERITIES.map((s) => (
                  <span key={s} className={`sev sev-${s.toLowerCase()}`}>
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
