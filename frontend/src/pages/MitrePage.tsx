import { useEffect, useState } from "react";
import { api, type Alert, type MitreCoverage } from "../api/client";
import "../styles/soc.css";

export function MitrePage() {
  const [coverage, setCoverage] = useState<MitreCoverage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{
    technique: { id: string; name: string; tactic: string };
    total: number;
    alerts: Alert[];
  } | null>(null);

  useEffect(() => {
    api
      .mitreCoverage()
      .then(setCoverage)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load MITRE"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    api.mitreTechnique(selectedId).then(setDetail).catch(() => setDetail(null));
  }, [selectedId]);

  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow">Detection intel</p>
        <h1>MITRE ATT&CK</h1>
        <p className="sub">Coverage from observed Wazuh rule mappings — click a technique to inspect related alerts.</p>
      </header>

      {loading && <p className="empty">Building coverage matrix…</p>}
      {error && <p className="error-text">{error}</p>}

      {coverage && (
        <>
          <div className="kpi-grid">
            <div className="kpi glass">
              <strong>{coverage.observedTechniques}</strong>
              <span>Observed techniques</span>
            </div>
            <div className="kpi glass">
              <strong>{coverage.coveredInMatrix}</strong>
              <span>Covered in matrix</span>
            </div>
            <div className="kpi glass">
              <strong>{coverage.matrixSize}</strong>
              <span>Matrix techniques</span>
            </div>
          </div>

          <div className="mitre-grid">
            {coverage.tactics.map((tactic) => (
              <section className="panel glass mitre-col" key={tactic.tactic}>
                <div className="mitre-head">
                  <strong>{tactic.tactic}</strong>
                  <span>
                    {tactic.covered}/{tactic.total}
                  </span>
                </div>
                <div className="tech-list">
                  {tactic.techniques.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={`tech-chip ${t.covered ? "covered" : ""}`}
                      onClick={() => setSelectedId(t.id)}
                    >
                      <span>{t.id}</span>
                      <em>{t.name}</em>
                      {t.alertCount > 0 && <b>{t.alertCount}</b>}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}

      {detail && (
        <>
          <div className="drawer-backdrop" onClick={() => setSelectedId(null)} />
          <aside className="drawer">
            <button className="btn btn-ghost" type="button" onClick={() => setSelectedId(null)}>
              Close
            </button>
            <h2>
              {detail.technique.id} · {detail.technique.name}
            </h2>
            <p className="empty" style={{ padding: 0 }}>
              {detail.technique.tactic} · {detail.total} related alerts
            </p>
            <ul className="recent-list">
              {detail.alerts.map((a) => (
                <li key={a.indexId}>
                  <div>
                    <strong>{a.ruleDescription}</strong>
                    <span>
                      {a.agentName} · {a.timestamp ? new Date(a.timestamp).toLocaleString() : "—"}
                    </span>
                  </div>
                  <span className={`sev sev-${a.severity}`}>{a.severity}</span>
                </li>
              ))}
            </ul>
          </aside>
        </>
      )}

      <style>{`
        .mitre-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 0.75rem;
        }
        .mitre-col { padding: 0.85rem; }
        .mitre-head {
          display: flex;
          justify-content: space-between;
          gap: 0.5rem;
          margin-bottom: 0.65rem;
          font-size: 0.85rem;
        }
        .mitre-head span { color: var(--muted); }
        .tech-list { display: grid; gap: 0.35rem; }
        .tech-chip {
          appearance: none;
          border: 1px solid var(--line);
          background: rgba(255,255,255,0.55);
          border-radius: 12px;
          padding: 0.55rem 0.65rem;
          text-align: left;
          cursor: pointer;
          display: grid;
          gap: 0.15rem;
          color: var(--ink-soft);
        }
        .tech-chip span {
          font-size: 0.72rem;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--muted);
        }
        .tech-chip em {
          font-style: normal;
          font-size: 0.82rem;
          color: var(--ink);
        }
        .tech-chip b {
          font-size: 0.75rem;
          color: var(--accent);
        }
        .tech-chip.covered {
          border-color: rgba(28,78,216,0.28);
          background: rgba(28,78,216,0.08);
        }
        .recent-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 0.65rem;
        }
        .recent-list li {
          display: flex;
          justify-content: space-between;
          gap: 0.75rem;
          padding: 0.75rem;
          border-radius: 12px;
          border: 1px solid var(--line);
          background: rgba(255,255,255,0.55);
        }
        .recent-list span { color: var(--muted); font-size: 0.8rem; }
      `}</style>
    </div>
  );
}
