import { useEffect, useState } from "react";
import { api, type Playbook, type ResponseAction } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { DataView } from "../components/DataView";
import { ListControls, SortableTimeTh } from "../components/ListControls";
import {
  DEFAULT_LIST_CONTROLS,
  listQueryParams,
  toggleSort,
  type ListControlValue,
} from "../lib/listControls";
import "../styles/soc.css";

export function ResponseActionsPage() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("ADMINISTRATOR");
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [actions, setActions] = useState<ResponseAction[]>([]);
  const [status, setStatus] = useState("PROPOSED");
  const [controls, setControls] = useState<ListControlValue>(DEFAULT_LIST_CONTROLS);
  const [selected, setSelected] = useState<ResponseAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [p, a] = await Promise.all([
        api.playbooks(),
        api.responseActions({ status: status || undefined, ...listQueryParams(controls) }),
      ]);
      setPlaybooks(p.playbooks);
      setActions(a.actions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load response actions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, controls]);

  async function approve(id: string) {
    setBusyId(id);
    setMessage(null);
    try {
      await api.approveResponseAction(id);
      setMessage("Action approved and executed.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approve failed");
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: string) {
    setBusyId(id);
    setMessage(null);
    try {
      await api.rejectResponseAction(id, "Rejected from Response Actions queue");
      setMessage("Action rejected.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reject failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow">Response</p>
        <h1>Response Actions</h1>
        <p className="sub">
          Human-in-the-loop SOAR queue — analysts propose playbooks; administrators approve live or dry-run
          execution.
        </p>
      </header>

      {error && <p className="error-text">{error}</p>}
      {message && (
        <div className="warning-banner" style={{ background: "rgba(31,122,76,0.1)", color: "var(--success)" }}>
          {message}
        </div>
      )}

      <section className="panel glass">
        <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.05rem" }}>Playbook catalog</h2>
        <div className="kpi-grid">
          {playbooks.map((p) => (
            <div key={p.id} className="kpi glass" style={{ textAlign: "left", alignItems: "flex-start" }}>
              <strong style={{ fontSize: "0.95rem" }}>{p.name}</strong>
              <span>
                {p.category} · {p.riskLevel}
                {p.requiresApproval ? " · approval" : " · auto"}
              </span>
              <span style={{ color: "var(--ink-soft)", fontSize: "0.8rem", lineHeight: 1.4 }}>{p.description}</span>
            </div>
          ))}
          {!playbooks.length && !loading && <p className="empty">No playbooks seeded yet.</p>}
        </div>
      </section>

      <section className="panel glass">
        <div className="toolbar" style={{ flexDirection: "column", alignItems: "stretch", marginBottom: "0.75rem" }}>
          <ListControls value={controls} onChange={setControls} />
          <div className="toolbar">
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {["PROPOSED", "APPROVED", "REJECTED", "SUCCEEDED", "FAILED", "EXECUTING"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button className="btn btn-ghost" type="button" onClick={load}>
              Refresh
            </button>
          </div>
        </div>

        {loading && <p className="empty">Loading actions…</p>}
        {!loading && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Playbook</th>
                <th>Target</th>
                <th>Status</th>
                <th>Mode</th>
                <th>Proposed by</th>
                <SortableTimeTh
                  label="Created"
                  sort={controls.sort}
                  onToggle={() => setControls((c) => ({ ...c, sort: toggleSort(c.sort) }))}
                />
                <th />
              </tr>
            </thead>
            <tbody>
              {actions.map((a) => (
                <tr key={a.id} onClick={() => setSelected(a)}>
                  <td>
                    <strong>{a.playbookName}</strong>
                    <div style={{ color: "var(--muted)", fontSize: "0.78rem" }}>{a.rationale.slice(0, 120)}</div>
                  </td>
                  <td>
                    {a.targetLabel || a.targetId || "—"}
                    {a.agentName ? (
                      <div style={{ color: "var(--muted)", fontSize: "0.78rem" }}>{a.agentName}</div>
                    ) : null}
                  </td>
                  <td>
                    <span className="badge">{a.status}</span>
                  </td>
                  <td>{a.dryRun ? "dry-run" : "live"}</td>
                  <td>{a.proposedBy?.name || "—"}</td>
                  <td>{new Date(a.createdAt).toLocaleString()}</td>
                  <td
                    onClick={(e) => e.stopPropagation()}
                  >
                    {isAdmin && a.status === "PROPOSED" && (
                      <div className="toolbar" style={{ justifyContent: "flex-end" }}>
                        <button
                          className="btn btn-primary"
                          type="button"
                          disabled={busyId === a.id}
                          onClick={() => approve(a.id)}
                        >
                          Approve
                        </button>
                        <button
                          className="btn btn-ghost"
                          type="button"
                          disabled={busyId === a.id}
                          onClick={() => reject(a.id)}
                        >
                          Reject
                        </button>
                      </div>
                    )}
                    {a.errorMessage && (
                      <div style={{ color: "var(--danger)", fontSize: "0.75rem" }}>{a.errorMessage}</div>
                    )}
                  </td>
                </tr>
              ))}
              {!actions.length && (
                <tr>
                  <td colSpan={7}>
                    <p className="empty">No actions in this filter. Propose from an incident investigation workspace.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </section>

      {selected && (
        <>
          <div className="drawer-backdrop" onClick={() => setSelected(null)} />
          <aside className="drawer" style={{ width: "min(520px, 96vw)" }}>
            <button className="btn btn-ghost" type="button" onClick={() => setSelected(null)}>
              Close
            </button>
            <h2>{selected.playbookName}</h2>
            <p style={{ color: "var(--ink-soft)", lineHeight: 1.45 }}>{selected.rationale}</p>
            <div className="meta-grid">
              <div>
                <span>Status</span>
                <strong>{selected.status}</strong>
              </div>
              <div>
                <span>Mode</span>
                <strong>{selected.dryRun ? "dry-run" : "live"}</strong>
              </div>
              <div>
                <span>Target</span>
                <strong>{selected.targetLabel || selected.targetId || "—"}</strong>
              </div>
              <div>
                <span>Agent</span>
                <strong>{selected.agentName || "—"}</strong>
              </div>
            </div>
            <div style={{ marginTop: "0.85rem" }}>
              <DataView
                data={{ params: selected.params ?? {}, result: selected.result ?? null, error: selected.errorMessage }}
                title="Action payload"
                storageKey="aegis-response-action-view"
                maxHeight="50vh"
              />
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
