import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { api, type ThreatIntelCase } from "../../api/client";
import { entityDetailPath } from "./tiNav";
import "../../styles/soc.css";

export function CaseDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [row, setRow] = useState<ThreatIntelCase | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.threatCase(id);
      setRow(res.case);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load case");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!id) return <Navigate to="/app/threat-intel/cases" replace />;

  async function saveStatus(status: string) {
    if (!row) return;
    const res = await api.updateThreatCase(row.id, { status });
    setRow(res.case);
  }

  async function addNote() {
    if (!row || !note.trim()) return;
    const res = await api.addThreatCaseNote(row.id, note.trim());
    setRow(res.case);
    setNote("");
  }

  async function createIncident() {
    if (!row) return;
    const res = await api.threatCaseCreateIncident(row.id);
    setRow(res.case);
    if (res.incidentId) navigate("/app/incidents");
  }

  async function detach(entityId: string) {
    if (!row) return;
    const res = await api.detachThreatCaseEntity(row.id, entityId);
    setRow(res.case);
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Threat Intel · Case</p>
          <h1>{loading ? "Loading…" : row?.title || "Case"}</h1>
          <p className="sub">{row?.description || "Linked CTI entities and IR notes."}</p>
        </div>
        <div className="toolbar">
          <Link className="btn btn-ghost" to="/app/threat-intel/cases">
            All cases
          </Link>
          {row && !row.incidentId && (
            <button className="btn btn-primary" type="button" onClick={() => void createIncident()}>
              Create incident
            </button>
          )}
          {row?.incidentId && (
            <Link className="btn btn-ghost" to="/app/incidents">
              Open linked incident
            </Link>
          )}
        </div>
      </header>

      {error && <p className="error-text">{error}</p>}

      {row && (
        <>
          <div className="toolbar">
            <span className="badge">{row.status}</span>
            <span className="badge">{row.severity}</span>
            <select value={row.status} onChange={(e) => void saveStatus(e.target.value)}>
              <option value="open">open</option>
              <option value="investigating">investigating</option>
              <option value="closed">closed</option>
            </select>
          </div>

          <section className="panel glass">
            <h2 style={{ marginTop: 0, fontSize: "1rem" }}>Linked entities</h2>
            {row.entities.length === 0 && (
              <p className="empty">No entities yet. Open an entity detail and attach it to this case.</p>
            )}
            {row.entities.length > 0 && (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {row.entities.map((e) => (
                    <tr key={e.id}>
                      <td>
                        <Link to={entityDetailPath(e.slug || "malware", e.openctiId)}>{e.name}</Link>
                      </td>
                      <td>
                        <span className="badge">{e.entityType}</span>
                      </td>
                      <td>
                        <button className="btn btn-ghost" type="button" onClick={() => void detach(e.id)}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="panel glass">
            <h2 style={{ marginTop: 0, fontSize: "1rem" }}>Notes</h2>
            <div className="toolbar" style={{ marginBottom: "0.75rem" }}>
              <input
                placeholder="Add analyst note…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                style={{ flex: 1, minWidth: 200 }}
              />
              <button className="btn btn-primary" type="button" onClick={() => void addNote()}>
                Add note
              </button>
            </div>
            {row.notes.map((n) => (
              <div key={n.id} style={{ borderBottom: "1px solid var(--line)", padding: "0.55rem 0" }}>
                <strong style={{ fontSize: "0.85rem" }}>{n.user.name}</strong>
                <span style={{ color: "var(--muted)", fontSize: "0.75rem", marginLeft: 8 }}>
                  {new Date(n.createdAt).toLocaleString()}
                </span>
                <p style={{ margin: "0.25rem 0 0", fontSize: "0.88rem" }}>{n.body}</p>
              </div>
            ))}
            {row.notes.length === 0 && <p className="empty">No notes yet.</p>}
          </section>
        </>
      )}
    </div>
  );
}
