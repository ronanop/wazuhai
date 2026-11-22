import { useEffect, useState } from "react";
import { api, type ScaCheck, type ScaSummary } from "../api/client";
import { ListControls, SortableTimeTh } from "../components/ListControls";
import { downloadCsv } from "../lib/csv";
import {
  DEFAULT_LIST_CONTROLS,
  listQueryParams,
  toggleSort,
  type ListControlValue,
} from "../lib/listControls";
import "../styles/soc.css";

export function ScaPage() {
  const [summaries, setSummaries] = useState<ScaSummary[]>([]);
  const [checks, setChecks] = useState<ScaCheck[]>([]);
  const [byResult, setByResult] = useState<Array<{ result: string; count: number }>>([]);
  const [total, setTotal] = useState(0);
  const [result, setResult] = useState("failed");
  const [q, setQ] = useState("");
  const [controls, setControls] = useState<ListControlValue>(DEFAULT_LIST_CONTROLS);
  const [selected, setSelected] = useState<ScaCheck | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.scaSummary(),
      api.scaChecks({ page: 1, pageSize: 40, result, q, ...listQueryParams(controls) }),
    ])
      .then(([sum, chk]) => {
        setSummaries(sum.summaries);
        setChecks(chk.checks);
        setByResult(chk.byResult);
        setTotal(chk.total);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load SCA"))
      .finally(() => setLoading(false));
  }, [result, q, controls]);

  function exportCsv() {
    if (checks.length > 0) {
      downloadCsv(
        controls.agent ? `sca-checks-${controls.agent}.csv` : "sca-checks.csv",
        checks.map((c) => ({
          result: c.result,
          checkId: c.checkId,
          title: c.title,
          policy: c.policy,
          agentName: c.agentName,
          remediation: c.remediation,
          reason: c.reason,
          timestamp: c.timestamp,
        })),
      );
      return;
    }
    downloadCsv(
      "sca-summary.csv",
      summaries.map((s) => ({
        agentName: s.agentName,
        policy: s.policy,
        score: s.score,
        passed: s.passed,
        failed: s.failed,
        invalid: s.invalid,
        totalChecks: s.totalChecks,
        timestamp: s.timestamp,
      })),
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow">Hardening</p>
        <h1>Configuration Assessment</h1>
        <p className="sub">CIS policy scores and individual SCA checks from Wazuh telemetry.</p>
      </header>

      <div className="kpi-grid">
        {summaries.map((s) => (
          <button
            type="button"
            className="kpi glass"
            key={s.indexId}
            style={{ cursor: "pointer", border: "none", textAlign: "left" }}
            onClick={() => setControls((c) => ({ ...c, agent: s.agentName }))}
          >
            <strong>{s.score}%</strong>
            <span>
              {s.agentName} · {s.passed}/{s.totalChecks} passed
            </span>
          </button>
        ))}
        {byResult.slice(0, 4).map((b) => (
          <div className="kpi glass" key={b.result}>
            <strong>{b.count}</strong>
            <span>{b.result}</span>
          </div>
        ))}
      </div>

      <section className="panel glass">
        <div className="toolbar" style={{ flexDirection: "column", alignItems: "stretch" }}>
          <ListControls
            value={controls}
            onChange={setControls}
            agentPlaceholder="Filter by endpoint…"
          />
          <div className="toolbar">
            <input placeholder="Search checks…" value={q} onChange={(e) => setQ(e.target.value)} />
            <select value={result} onChange={(e) => setResult(e.target.value)}>
              <option value="">All results</option>
              <option value="failed">failed</option>
              <option value="passed">passed</option>
              <option value="not applicable">not applicable</option>
            </select>
            <button
              className="btn btn-ghost"
              type="button"
              disabled={!checks.length && !summaries.length}
              onClick={exportCsv}
            >
              Export CSV
            </button>
            {controls.agent && (
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => setControls((c) => ({ ...c, agent: "" }))}
              >
                Clear endpoint
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="panel glass">
        {loading && <p className="empty">Loading SCA…</p>}
        {error && <p className="error-text">{error}</p>}
        {!loading && !error && (
          <>
            <p className="empty" style={{ paddingTop: 0 }}>
              {total.toLocaleString()} checks
              {controls.agent ? ` · endpoint ${controls.agent}` : ""}
            </p>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Result</th>
                  <th>Check</th>
                  <th>Policy</th>
                  <th>Agent</th>
                  <SortableTimeTh
                    sort={controls.sort}
                    onToggle={() => setControls((c) => ({ ...c, sort: toggleSort(c.sort) }))}
                  />
                </tr>
              </thead>
              <tbody>
                {checks.map((c) => (
                  <tr key={c.indexId} onClick={() => setSelected(c)}>
                    <td>
                      <span className="badge">{c.result}</span>
                    </td>
                    <td>
                      <strong>{c.title || c.checkId}</strong>
                    </td>
                    <td>{c.policy}</td>
                    <td>{c.agentName}</td>
                    <td>{c.timestamp ? new Date(c.timestamp).toLocaleString() : "—"}</td>
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
            <h2>{selected.title}</h2>
            <span className="badge">{selected.result}</span>
            <p style={{ color: "var(--ink-soft)", lineHeight: 1.55 }}>{selected.description}</p>
            <div className="meta-grid">
              <div>
                <span>Remediation</span>
                <strong style={{ fontWeight: 400, lineHeight: 1.5 }}>{selected.remediation || "—"}</strong>
              </div>
              <div>
                <span>Reason</span>
                <strong style={{ fontWeight: 400 }}>{selected.reason || "—"}</strong>
              </div>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
