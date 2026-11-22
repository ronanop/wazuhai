import { useEffect, useState } from "react";
import { api, type AuditEntry } from "../api/client";
import { ListControls, SortableTimeTh } from "../components/ListControls";
import { downloadCsv } from "../lib/csv";
import {
  DEFAULT_LIST_CONTROLS,
  listQueryParams,
  toggleSort,
  type ListControlValue,
} from "../lib/listControls";
import "../styles/soc.css";

export function AuditPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [q, setQ] = useState("");
  const [controls, setControls] = useState<ListControlValue>(DEFAULT_LIST_CONTROLS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const params = listQueryParams(controls);
    api
      .auditLogs({ q, limit: 100, from: params.from, to: params.to, sort: params.sort })
      .then((res) => setLogs(res.logs))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load audit logs"))
      .finally(() => setLoading(false));
  }, [q, controls]);

  function exportLogs() {
    downloadCsv(
      "audit-logs.csv",
      logs.map((l) => ({
        createdAt: l.createdAt,
        user: l.user?.email || "system",
        userName: l.user?.name || "",
        action: l.action,
        outcome: l.outcome,
        meta: typeof l.meta === "string" ? l.meta : JSON.stringify(l.meta ?? {}),
      })),
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow">Administration</p>
        <h1>Audit Logs</h1>
        <p className="sub">Immutable activity trail for authentication and operational changes.</p>
      </header>

      <section className="panel glass">
        <div className="toolbar" style={{ flexDirection: "column", alignItems: "stretch" }}>
          <ListControls value={controls} onChange={setControls} showAgent={false} />
          <div className="toolbar">
            <input placeholder="Search action, user, outcome…" value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="btn btn-ghost" type="button" disabled={!logs.length} onClick={exportLogs}>
              Export CSV
            </button>
          </div>
        </div>
      </section>

      <section className="panel glass">
        {loading && <p className="empty">Loading audit trail…</p>}
        {error && <p className="error-text">{error}</p>}
        {!loading && !error && (
          <table className="data-table">
            <thead>
              <tr>
                <SortableTimeTh
                  sort={controls.sort}
                  onToggle={() => setControls((c) => ({ ...c, sort: toggleSort(c.sort) }))}
                />
                <th>User</th>
                <th>Action</th>
                <th>Outcome</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} style={{ cursor: "default" }}>
                  <td>{new Date(l.createdAt).toLocaleString()}</td>
                  <td>{l.user?.email || "system"}</td>
                  <td>
                    <strong>{l.action}</strong>
                  </td>
                  <td>
                    <span className="badge">{l.outcome}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
