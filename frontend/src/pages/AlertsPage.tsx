import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type Alert, type AlertTriage, type Severity } from "../api/client";
import { AskAiButton } from "../components/AskAiButton";
import { ListControls, SortableTimeTh } from "../components/ListControls";
import { downloadCsv } from "../lib/csv";
import {
  DEFAULT_LIST_CONTROLS,
  listQueryParams,
  toggleSort,
  type ListControlValue,
} from "../lib/listControls";
import "../styles/soc.css";

function toIncidentSeverity(s: Severity) {
  return s.toUpperCase();
}

export function AlertsPage() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [severity, setSeverity] = useState("");
  const [controls, setControls] = useState<ListControlValue>(DEFAULT_LIST_CONTROLS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Alert | null>(null);
  const [creating, setCreating] = useState(false);
  const [triageMap, setTriageMap] = useState<Record<string, AlertTriage>>({});
  const [triageBusy, setTriageBusy] = useState(false);
  const [assigneeInput, setAssigneeInput] = useState("");
  const pageSize = 25;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    api
      .alerts({ page, pageSize, q, severity, ...listQueryParams(controls) })
      .then(async (res) => {
        if (!alive) return;
        setAlerts(res.alerts);
        setTotal(res.total);
        const ids = res.alerts.map((a) => a.indexId);
        if (ids.length) {
          try {
            const triageRes = await api.alertTriageGet(ids);
            if (!alive) return;
            const next: Record<string, AlertTriage> = {};
            for (const t of triageRes.triage) next[t.indexId] = t;
            setTriageMap(next);
          } catch {
            if (alive) setTriageMap({});
          }
        } else {
          setTriageMap({});
        }
      })
      .catch((err) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Failed to load alerts");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [page, q, severity, controls]);

  useEffect(() => {
    if (selected) {
      setAssigneeInput(triageMap[selected.indexId]?.assignee || "");
    }
  }, [selected, triageMap]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const selectedTriage = selected ? triageMap[selected.indexId] : undefined;

  async function setTriage(status: AlertTriage["status"], assignee?: string) {
    if (!selected) return;
    setTriageBusy(true);
    try {
      const res = await api.alertTriageSet({
        indexId: selected.indexId,
        status,
        assignee: assignee ?? assigneeInput,
      });
      setTriageMap((prev) => ({ ...prev, [res.triage.indexId]: res.triage }));
    } finally {
      setTriageBusy(false);
    }
  }

  function exportPage() {
    downloadCsv(
      `alerts-page-${page}.csv`,
      alerts.map((a) => ({
        timestamp: a.timestamp,
        severity: a.severity,
        level: a.level,
        ruleId: a.ruleId,
        ruleDescription: a.ruleDescription,
        agentName: a.agentName,
        agentId: a.agentId,
        location: a.location,
        groups: a.groups.join("|"),
        mitre: (a.mitre ?? []).join("|"),
        indexId: a.indexId,
      })),
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow">Detection</p>
        <h1>Security Alerts</h1>
        <p className="sub">Live telemetry from your Wazuh indexer — searchable, filterable, investigate-ready.</p>
      </header>

      <section className="panel glass">
        <div className="toolbar" style={{ flexDirection: "column", alignItems: "stretch" }}>
          <ListControls
            value={controls}
            onChange={(next) => {
              setPage(1);
              setControls(next);
            }}
          />
          <div className="toolbar">
            <input
              placeholder="Search rules, agents, messages…"
              value={q}
              onChange={(e) => {
                setPage(1);
                setQ(e.target.value);
              }}
            />
            <select
              value={severity}
              onChange={(e) => {
                setPage(1);
                setSeverity(e.target.value);
              }}
            >
              <option value="">All severities</option>
              {(["critical", "high", "medium", "low", "info"] as Severity[]).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button className="btn btn-ghost" type="button" disabled={!alerts.length} onClick={exportPage}>
              Export CSV
            </button>
          </div>
        </div>
      </section>

      <section className="panel glass">
        {loading && <p className="empty">Loading alerts from Wazuh…</p>}
        {error && <p className="error-text">{error}</p>}
        {!loading && !error && alerts.length === 0 && (
          <p className="empty">No alerts matched these filters.</p>
        )}
        {!loading && !error && alerts.length > 0 && (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <SortableTimeTh
                    sort={controls.sort}
                    onToggle={() => {
                      setPage(1);
                      setControls((c) => ({ ...c, sort: toggleSort(c.sort) }));
                    }}
                  />
                  <th>Severity</th>
                  <th>Rule</th>
                  <th>Agent</th>
                  <th>Location</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((a) => (
                  <tr key={a.indexId} onClick={() => setSelected(a)}>
                    <td>{a.timestamp ? new Date(a.timestamp).toLocaleString() : "—"}</td>
                    <td>
                      <span className={`sev sev-${a.severity}`}>
                        {a.severity} · {a.level}
                      </span>
                    </td>
                    <td>
                      <strong>{a.ruleDescription}</strong>
                      <div style={{ color: "var(--muted)", fontSize: "0.8rem" }}>#{a.ruleId}</div>
                    </td>
                    <td>{a.agentName}</td>
                    <td>{a.location || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="pager">
              <span>
                {total.toLocaleString()} alerts · page {page} / {totalPages}
              </span>
              <div className="toolbar">
                <button
                  className="btn btn-ghost"
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </button>
                <button
                  className="btn btn-ghost"
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
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
            <h2>{selected.ruleDescription}</h2>
            <div className="toolbar" style={{ marginBottom: "0.75rem" }}>
              <span className={`sev sev-${selected.severity}`}>
                {selected.severity} · level {selected.level}
              </span>
              <span className="badge">{selectedTriage?.status || "open"}</span>
              <AskAiButton
                selection={{
                  type: "alert",
                  id: selected.indexId,
                  title: selected.ruleDescription,
                  meta: { agentName: selected.agentName, agentId: selected.agentId },
                }}
              />
            </div>
            <div className="meta-grid">
              <div>
                <span>Timestamp</span>
                <strong>{selected.timestamp ? new Date(selected.timestamp).toLocaleString() : "—"}</strong>
              </div>
              <div>
                <span>Rule ID</span>
                <strong>{selected.ruleId}</strong>
              </div>
              <div>
                <span>Agent</span>
                <strong>
                  {selected.agentName} ({selected.agentId || "—"})
                </strong>
              </div>
              <div>
                <span>Location</span>
                <strong>{selected.location || "—"}</strong>
              </div>
              <div>
                <span>Groups</span>
                <strong>{selected.groups.join(", ") || "—"}</strong>
              </div>
              <div>
                <span>MITRE</span>
                <strong>{(selected.mitre ?? []).join(", ") || "—"}</strong>
              </div>
              <div>
                <span>Assignee</span>
                <strong>{selectedTriage?.assignee || "—"}</strong>
              </div>
              <div>
                <span>Compliance</span>
                <strong>
                  {[
                    ...selected.compliance.pciDss.map((x) => `PCI ${x}`),
                    ...selected.compliance.hipaa.map((x) => `HIPAA ${x}`),
                    ...selected.compliance.nist.map((x) => `NIST ${x}`),
                  ].join(" · ") || "—"}
                </strong>
              </div>
            </div>
            <div className="field">
              <label htmlFor="assignee">Assignee</label>
              <input
                id="assignee"
                value={assigneeInput}
                onChange={(e) => setAssigneeInput(e.target.value)}
                placeholder="Analyst name"
              />
            </div>
            <div className="toolbar">
              <button
                className="btn btn-ghost"
                type="button"
                disabled={triageBusy}
                onClick={() => setTriage("acknowledged")}
              >
                Acknowledge
              </button>
              <button
                className="btn btn-ghost"
                type="button"
                disabled={triageBusy}
                onClick={() => {
                  const name =
                    assigneeInput.trim() ||
                    window.prompt("Assign to (name)?", selectedTriage?.assignee || "") ||
                    "";
                  if (!name.trim()) return;
                  setAssigneeInput(name.trim());
                  void setTriage("assigned", name.trim());
                }}
              >
                Assign
              </button>
              <button
                className="btn btn-ghost"
                type="button"
                disabled={triageBusy}
                onClick={() => setTriage("investigating")}
              >
                Investigating
              </button>
              <button
                className="btn btn-primary"
                type="button"
                disabled={creating}
                onClick={async () => {
                  setCreating(true);
                  try {
                    const res = await api.createIncident({
                      title: selected.ruleDescription,
                      description: `Created from alert ${selected.id}`,
                      severity: toIncidentSeverity(selected.severity),
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
