import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Alert, type AttackCoverage, type AttackCoverageState } from "../../api/client";
import { entityDetailPath } from "./tiNav";
import "../../styles/soc.css";

const STATE_CLASS: Record<AttackCoverageState, string> = {
  both: "ti-cov-both",
  opencti_only: "ti-cov-octi",
  wazuh_only: "ti-cov-wazuh",
  gap: "ti-cov-gap",
};

export function AttackCoveragePage() {
  const [coverage, setCoverage] = useState<AttackCoverage | null>(null);
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
      .openctiAttackCoverage()
      .then(setCoverage)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load coverage"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    api.mitreTechnique(selectedId).then(setDetail).catch(() => setDetail(null));
  }, [selectedId]);

  const selectedMeta = coverage?.tactics
    .flatMap((t) => t.techniques)
    .find((t) => t.id === selectedId);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Threat Intel</p>
          <h1>ATT&CK coverage</h1>
          <p className="sub">
            Dual heatmap — OpenCTI attack patterns merged with Wazuh-observed MITRE technique hits.
          </p>
        </div>
      </header>

      {loading && <p className="empty">Building dual coverage…</p>}
      {error && <p className="error-text">{error}</p>}

      {coverage && (
        <>
          <div className="kpi-grid">
            <div className="kpi glass">
              <strong>{coverage.both}</strong>
              <span>Both CTI + detection</span>
            </div>
            <div className="kpi glass">
              <strong>{coverage.openctiOnly}</strong>
              <span>OpenCTI only</span>
            </div>
            <div className="kpi glass">
              <strong>{coverage.wazuhOnly}</strong>
              <span>Wazuh only</span>
            </div>
            <div className="kpi glass">
              <strong>{coverage.gap}</strong>
              <span>Matrix gaps</span>
            </div>
          </div>

          <div className="ti-cov-legend">
            <span className="ti-cov-both">Both</span>
            <span className="ti-cov-octi">OpenCTI</span>
            <span className="ti-cov-wazuh">Wazuh</span>
            <span className="ti-cov-gap">Gap</span>
          </div>

          <div className="mitre-grid">
            {coverage.tactics.map((tactic) => (
              <section className="panel glass mitre-col" key={tactic.tactic}>
                <div className="mitre-head">
                  <strong>{tactic.tactic}</strong>
                  <span>
                    {tactic.both}/{tactic.total}
                  </span>
                </div>
                <div className="tech-list">
                  {tactic.techniques.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={`tech-chip ${STATE_CLASS[t.state]}`}
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

      {selectedId && (
        <>
          <div className="drawer-backdrop" onClick={() => setSelectedId(null)} />
          <aside className="drawer" style={{ width: "min(480px, 96vw)" }}>
            <button className="btn btn-ghost" type="button" onClick={() => setSelectedId(null)}>
              Close
            </button>
            <h2>{selectedMeta?.name || selectedId}</h2>
            <p className="sub">
              {selectedId} · {selectedMeta?.state?.replace("_", " ")} ·{" "}
              {detail?.total ?? selectedMeta?.alertCount ?? 0} Wazuh alerts
            </p>
            {selectedMeta?.openctiId && (
              <Link
                className="btn btn-primary"
                to={entityDetailPath("attack-patterns", selectedMeta.openctiId)}
              >
                Open OpenCTI attack pattern
              </Link>
            )}
            <div style={{ marginTop: "0.85rem" }}>
              {(detail?.alerts ?? []).slice(0, 12).map((a) => (
                <div key={a.id} className="panel" style={{ marginBottom: 6, padding: "0.55rem 0.7rem" }}>
                  <strong style={{ fontSize: "0.85rem" }}>{a.ruleDescription || a.ruleId}</strong>
                  <div style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
                    {a.agentName || "—"} · {a.timestamp ? new Date(a.timestamp).toLocaleString() : "—"}
                  </div>
                </div>
              ))}
              {!detail?.alerts?.length && <p className="empty">No recent alerts for this technique.</p>}
            </div>
          </aside>
        </>
      )}

      <style>{`
        .ti-cov-legend {
          display: flex;
          flex-wrap: wrap;
          gap: 0.45rem;
        }
        .ti-cov-legend span,
        .tech-chip.ti-cov-both,
        .tech-chip.ti-cov-octi,
        .tech-chip.ti-cov-wazuh,
        .tech-chip.ti-cov-gap {
          border-radius: 8px;
          padding: 0.35rem 0.5rem;
          font-size: 0.72rem;
          font-weight: 600;
        }
        .ti-cov-legend span { border: 1px solid var(--line); }
        .ti-cov-both, .tech-chip.ti-cov-both { background: #dbeafe; color: #1e40af; border-color: #93c5fd; }
        .ti-cov-octi, .tech-chip.ti-cov-octi { background: #f3e8ff; color: #6b21a8; border-color: #d8b4fe; }
        .ti-cov-wazuh, .tech-chip.ti-cov-wazuh { background: #ffedd5; color: #9a3412; border-color: #fdba74; }
        .ti-cov-gap, .tech-chip.ti-cov-gap { background: #f1f5f9; color: #64748b; border-color: #e2e8f0; }
      `}</style>
    </div>
  );
}
