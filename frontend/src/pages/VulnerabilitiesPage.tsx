import { useEffect, useState } from "react";
import { api, type Vulnerability } from "../api/client";
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

export function VulnerabilitiesPage() {
  const [items, setItems] = useState<Vulnerability[]>([]);
  const [summary, setSummary] = useState<Array<{ severity: string; count: number }>>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [severity, setSeverity] = useState("");
  const [controls, setControls] = useState<ListControlValue>(DEFAULT_LIST_CONTROLS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Vulnerability | null>(null);
  const pageSize = 25;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .vulnerabilities({ page, pageSize, q, severity, ...listQueryParams(controls) })
      .then((res) => {
        if (!alive) return;
        setItems(res.vulnerabilities);
        setTotal(res.total);
        setSummary(res.summary);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Failed to load vulnerabilities");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [page, q, severity, controls]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow">Exposure</p>
        <h1>Vulnerabilities</h1>
        <p className="sub">Package and CVE findings from Wazuh vulnerability detection on monitored endpoints.</p>
      </header>

      <div className="kpi-grid">
        {summary.length === 0 && !loading ? (
          <div className="kpi glass">
            <strong>{total}</strong>
            <span>Total findings</span>
          </div>
        ) : (
          summary.map((s) => (
            <div className="kpi glass" key={s.severity}>
              <strong>{s.count}</strong>
              <span>{s.severity}</span>
            </div>
          ))
        )}
      </div>

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
              placeholder="Search CVE, package, agent…"
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
              {["Critical", "High", "Medium", "Low", "Unknown"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button
              className="btn btn-ghost"
              type="button"
              disabled={!items.length}
              onClick={() =>
                downloadCsv(
                  `vulnerabilities-page-${page}.csv`,
                  items.map((v) => ({
                    cve: v.cve,
                    severity: v.severity,
                    packageName: v.packageName,
                    packageVersion: v.packageVersion,
                    agentName: v.agentName,
                    os: v.os,
                    score: v.score,
                    detectedAt: v.detectedAt,
                    reference: v.reference,
                    description: v.description,
                  })),
                )
              }
            >
              Export CSV
            </button>
          </div>
        </div>
      </section>

      <section className="panel glass">
        {loading && <p className="empty">Loading vulnerabilities…</p>}
        {error && <p className="error-text">{error}</p>}
        {!loading && !error && (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>CVE</th>
                  <th>Severity</th>
                  <th>Package</th>
                  <th>Agent</th>
                  <SortableTimeTh
                    label="Detected"
                    sort={controls.sort}
                    onToggle={() => {
                      setPage(1);
                      setControls((c) => ({ ...c, sort: toggleSort(c.sort) }));
                    }}
                  />
                </tr>
              </thead>
              <tbody>
                {items.map((v) => (
                  <tr key={v.id} onClick={() => setSelected(v)}>
                    <td>
                      <strong>{v.cve}</strong>
                    </td>
                    <td>
                      <span className={`sev sev-${v.severity.toLowerCase()}`}>{v.severity}</span>
                    </td>
                    <td>
                      {v.packageName}
                      <div style={{ color: "var(--muted)", fontSize: "0.8rem" }}>{v.packageVersion}</div>
                    </td>
                    <td>{v.agentName}</td>
                    <td>{v.detectedAt ? new Date(v.detectedAt).toLocaleString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="pager">
              <span>
                {total} findings · page {page} / {totalPages}
              </span>
              <div className="toolbar">
                <button className="btn btn-ghost" type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
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
            <h2>{selected.cve}</h2>
            <span className={`sev sev-${selected.severity.toLowerCase()}`}>{selected.severity}</span>
            <p style={{ color: "var(--ink-soft)", lineHeight: 1.55 }}>{selected.description}</p>
            <div className="meta-grid">
              <div>
                <span>Package</span>
                <strong>
                  {selected.packageName} {selected.packageVersion}
                </strong>
              </div>
              <div>
                <span>Agent / OS</span>
                <strong>
                  {selected.agentName} · {selected.os || "—"}
                </strong>
              </div>
              <div>
                <span>Score</span>
                <strong>{selected.score ?? "—"}</strong>
              </div>
              <div>
                <span>Remediation</span>
                <strong style={{ fontWeight: 400 }}>
                  {selected.reference ? (
                    <a href={selected.reference} target="_blank" rel="noopener noreferrer">
                      {selected.reference}
                    </a>
                  ) : (
                    "—"
                  )}
                </strong>
              </div>
            </div>
            <div className="toolbar">
              <AskAiButton
                selection={{
                  type: "vulnerability",
                  id: selected.id,
                  title: selected.cve,
                  meta: { agentName: selected.agentName, packageName: selected.packageName },
                }}
              />
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
