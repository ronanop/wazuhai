import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  api,
  type Alert,
  type ComplianceControl,
  type ComplianceFramework,
} from "../api/client";
import { ListControls, SortableTimeTh } from "../components/ListControls";
import {
  applyClientListControls,
  DEFAULT_LIST_CONTROLS,
  toggleSort,
  type ListControlValue,
} from "../lib/listControls";
import "../styles/soc.css";

export function CompliancePage() {
  const { frameworkId } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const controlId = params.get("control");

  const [frameworks, setFrameworks] = useState<ComplianceFramework[]>([]);
  const [note, setNote] = useState("");
  const [controls, setControls] = useState<ComplianceControl[]>([]);
  const [controlsFilter, setControlsFilter] = useState<ListControlValue>(DEFAULT_LIST_CONTROLS);
  const [frameworkMeta, setFrameworkMeta] = useState<{
    id: string;
    name: string;
    shortName: string;
    description: string;
    disclaimer: string;
  } | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [scaChecks, setScaChecks] = useState<
    Array<{
      indexId: string;
      timestamp: string;
      agentName: string;
      policy: string;
      title: string;
      result: string;
      remediation: string;
    }>
  >([]);
  const [alertTotal, setAlertTotal] = useState(0);
  const [scaTotal, setScaTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (frameworkId) return;
    setLoading(true);
    api
      .complianceFrameworks()
      .then((res) => {
        setFrameworks(res.frameworks);
        setNote(res.note);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load frameworks"))
      .finally(() => setLoading(false));
  }, [frameworkId]);

  useEffect(() => {
    if (!frameworkId) return;
    setLoading(true);
    setError(null);
    api
      .complianceControls(frameworkId)
      .then((res) => {
        setFrameworkMeta(res.framework);
        setControls(res.controls);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load controls"))
      .finally(() => setLoading(false));
  }, [frameworkId]);

  useEffect(() => {
    if (!frameworkId || !controlId) {
      setAlerts([]);
      setScaChecks([]);
      return;
    }
    api
      .complianceEvidence(frameworkId, controlId, { pageSize: 25 })
      .then((res) => {
        setAlerts(res.alerts);
        setScaChecks(res.scaChecks);
        setAlertTotal(res.alertTotal);
        setScaTotal(res.scaTotal);
        setFrameworkMeta((prev) =>
          prev
            ? prev
            : {
                id: res.framework.id,
                name: res.framework.name,
                shortName: res.framework.shortName,
                description: "",
                disclaimer: res.framework.disclaimer,
              },
        );
      })
      .catch(() => undefined);
  }, [frameworkId, controlId]);

  const visibleControls = useMemo(
    () =>
      applyClientListControls(controls, controlsFilter, {
        time: (c) => c.latestAlertAt,
        agent: (c) => c.latestAgent,
      }),
    [controls, controlsFilter],
  );

  if (!frameworkId) {
    return (
      <div className="page">
        <header className="page-header">
          <p className="eyebrow">Governance</p>
          <h1>Compliance</h1>
          <p className="sub">
            Wazuh-tagged evidence organized by framework. This is an assessment view — not a certification.
          </p>
        </header>

        {note && <div className="warning-banner">{note}</div>}
        {loading && <p className="empty">Loading frameworks from Wazuh…</p>}
        {error && <p className="error-text">{error}</p>}

        <div className="fw-grid">
          {frameworks.map((fw) => (
            <button
              key={fw.id}
              type="button"
              className="fw-card glass"
              onClick={() => navigate(`/app/compliance/${fw.id}`)}
            >
              <div className="fw-top">
                <strong>{fw.shortName}</strong>
                <span className="badge">{fw.controlCount} controls</span>
              </div>
              <p>{fw.description}</p>
              <div className="fw-stats">
                <div>
                  <strong>{fw.alertCount.toLocaleString()}</strong>
                  <span>Alerts</span>
                </div>
                <div>
                  <strong>{fw.highSeverityCount}</strong>
                  <span>High+</span>
                </div>
              </div>
              <div className="fw-top-controls">
                {fw.topControls.slice(0, 3).map((c) => (
                  <span key={c.id} className="badge">
                    {c.id} · {c.alertCount}
                  </span>
                ))}
              </div>
              <em>{fw.disclaimer}</em>
            </button>
          ))}
        </div>

        <style>{fwStyles}</style>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow">
          <Link to="/app/compliance" style={{ color: "inherit" }}>
            Compliance
          </Link>{" "}
          / {frameworkMeta?.shortName || frameworkId}
        </p>
        <h1>{frameworkMeta?.name || frameworkId}</h1>
        <p className="sub">{frameworkMeta?.description}</p>
      </header>

      {frameworkMeta?.disclaimer && <div className="warning-banner">{frameworkMeta.disclaimer}</div>}
      {loading && <p className="empty">Loading controls…</p>}
      {error && <p className="error-text">{error}</p>}

      <section className="panel glass">
        <ListControls
          value={controlsFilter}
          onChange={setControlsFilter}
          agentPlaceholder="Filter by latest agent…"
        />
      </section>

      <section className="panel glass">
        <table className="data-table">
          <thead>
            <tr>
              <th>Control</th>
              <th>Alerts</th>
              <th>High+</th>
              <th>Agents</th>
              <SortableTimeTh
                label="Latest"
                sort={controlsFilter.sort}
                onToggle={() => setControlsFilter((c) => ({ ...c, sort: toggleSort(c.sort) }))}
              />
            </tr>
          </thead>
          <tbody>
            {visibleControls.map((c) => (
              <tr
                key={c.id}
                onClick={() => {
                  const next = new URLSearchParams(params);
                  next.set("control", c.id);
                  setParams(next);
                }}
              >
                <td>
                  <strong>{c.id}</strong>
                  <div style={{ color: "var(--muted)", fontSize: "0.8rem" }}>{c.latestRule || "—"}</div>
                </td>
                <td>{c.alertCount}</td>
                <td>{c.highSeverityCount}</td>
                <td>{c.agentCount}</td>
                <td>{c.latestAlertAt ? new Date(c.latestAlertAt).toLocaleString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {controlId && (
        <>
          <div
            className="drawer-backdrop"
            onClick={() => {
              const next = new URLSearchParams(params);
              next.delete("control");
              setParams(next);
            }}
          />
          <aside className="drawer">
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => {
                const next = new URLSearchParams(params);
                next.delete("control");
                setParams(next);
              }}
            >
              Close
            </button>
            <h2>Control {controlId}</h2>
            <p className="empty" style={{ padding: 0 }}>
              {alertTotal} alert evidence · {scaTotal} SCA-related hits
            </p>

            <div className="meta-grid">
              <div>
                <span>Related alerts</span>
                <strong style={{ fontWeight: 400 }}>
                  {alerts.map((a) => (
                    <div key={a.indexId} style={{ marginBottom: "0.55rem" }}>
                      <div>{a.ruleDescription}</div>
                      <div style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
                        {a.agentName} · {a.severity} ·{" "}
                        {a.timestamp ? new Date(a.timestamp).toLocaleString() : "—"}
                      </div>
                    </div>
                  ))}
                  {!alerts.length && "No alerts for this control."}
                </strong>
              </div>
              <div>
                <span>SCA evidence</span>
                <strong style={{ fontWeight: 400 }}>
                  {scaChecks.map((c) => (
                    <div key={c.indexId} style={{ marginBottom: "0.55rem" }}>
                      <div>
                        {c.title || "SCA check"} ({c.result})
                      </div>
                      <div style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
                        {c.agentName} · {c.policy}
                      </div>
                    </div>
                  ))}
                  {!scaChecks.length && "No matching SCA checks indexed for this control id."}
                </strong>
              </div>
            </div>
          </aside>
        </>
      )}

      <style>{fwStyles}</style>
    </div>
  );
}

const fwStyles = `
  .fw-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 0.85rem;
  }
  .fw-card {
    appearance: none;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 1.15rem 1.2rem;
    text-align: left;
    cursor: pointer;
    display: grid;
    gap: 0.7rem;
    color: inherit;
  }
  .fw-card:hover {
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
  }
  .fw-top {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    align-items: center;
  }
  .fw-card p {
    margin: 0;
    color: var(--ink-soft);
    font-size: 0.9rem;
    line-height: 1.45;
  }
  .fw-stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
  }
  .fw-stats div {
    border-radius: 12px;
    padding: 0.65rem 0.75rem;
    background: rgba(255,255,255,0.55);
    border: 1px solid var(--line);
    display: grid;
    gap: 0.1rem;
  }
  .fw-stats span { color: var(--muted); font-size: 0.75rem; }
  .fw-top-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }
  .fw-card em {
    font-style: normal;
    font-size: 0.75rem;
    color: var(--muted);
  }
`;
