import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, type ThreatIntelCase } from "../../api/client";
import "../../styles/soc.css";

export function CasesPage() {
  const navigate = useNavigate();
  const [cases, setCases] = useState<ThreatIntelCase[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.threatCases({
        q: q || undefined,
        status: status || undefined,
      });
      setCases(res.cases);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cases");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function createCase() {
    if (!title.trim()) return;
    const res = await api.createThreatCase({ title: title.trim(), severity: "medium" });
    setTitle("");
    navigate(`/app/threat-intel/cases/${res.case.id}`);
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Threat Intel</p>
          <h1>CTI cases</h1>
          <p className="sub">
            IR workspace for threat intel — attach OpenCTI entities and link or create Aegis incidents.
          </p>
        </div>
      </header>

      <section className="panel glass">
        <div className="toolbar" style={{ flexWrap: "wrap" }}>
          <input
            placeholder="New case title…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ minWidth: 220 }}
          />
          <button className="btn btn-primary" type="button" onClick={() => void createCase()}>
            Create case
          </button>
          <input
            placeholder="Search cases…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void refresh();
            }}
          />
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="investigating">Investigating</option>
            <option value="closed">Closed</option>
          </select>
          <button className="btn btn-ghost" type="button" onClick={() => void refresh()}>
            Refresh
          </button>
        </div>
      </section>

      {loading && <p className="empty">Loading cases…</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading && cases.length === 0 && <p className="empty">No cases yet. Create one to start an investigation.</p>}

      {cases.length > 0 && (
        <section className="panel glass">
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Severity</th>
                <th>Entities</th>
                <th>Incident</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <tr
                  key={c.id}
                  style={{ cursor: "pointer" }}
                  onClick={() => navigate(`/app/threat-intel/cases/${c.id}`)}
                >
                  <td>
                    <strong>{c.title}</strong>
                  </td>
                  <td>
                    <span className="badge">{c.status}</span>
                  </td>
                  <td>{c.severity}</td>
                  <td>{c.entities.length}</td>
                  <td>
                    {c.incident ? (
                      <Link to={`/app/incidents`} onClick={(e) => e.stopPropagation()}>
                        {c.incident.title}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{new Date(c.updatedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
