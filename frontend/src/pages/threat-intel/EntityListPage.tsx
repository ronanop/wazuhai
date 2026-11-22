import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { api, type CatalogEntity } from "../../api/client";
import { entityDetailPath, isTiEntitySlug } from "./tiNav";
import "../../styles/soc.css";

export function EntityListPage() {
  const { type = "" } = useParams();
  const valid = isTiEntitySlug(type);
  const navigate = useNavigate();
  const [entities, setEntities] = useState<CatalogEntity[]>([]);
  const [total, setTotal] = useState(0);
  const [label, setLabel] = useState(type);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!valid) return;
    let alive = true;
    setLoading(true);
    setError(null);
    api
      .openctiEntities(type, { pageSize: 50, q: q || undefined })
      .then((res) => {
        if (!alive) return;
        setEntities(res.entities);
        setTotal(res.total);
        setLabel(res.catalog?.label || type);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Failed to load entities");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [type, q, valid]);

  if (!valid) {
    return <Navigate to="/app/threat-intel" replace />;
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Threat Intel</p>
          <h1>{label}</h1>
          <p className="sub">Browse OpenCTI {label.toLowerCase()} — search, open detail, explore relationships.</p>
        </div>
        <span className="badge">{total.toLocaleString()} total</span>
      </header>

      <div className="toolbar">
        <input
          placeholder={`Search ${label.toLowerCase()}…`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ minWidth: 240 }}
        />
      </div>

      {loading && <p className="empty">Loading from OpenCTI…</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading && !error && entities.length === 0 && <p className="empty">No entities found.</p>}

      {entities.length > 0 && (
        <section className="panel glass">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Labels</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {entities.map((e) => (
                <tr
                  key={e.id}
                  style={{ cursor: "pointer" }}
                  onClick={() => navigate(entityDetailPath(e.slug || type, e.id))}
                >
                  <td>
                    <strong>{e.name}</strong>
                    {e.mitreId && (
                      <span className="badge" style={{ marginLeft: 6 }}>
                        {e.mitreId}
                      </span>
                    )}
                    {e.patternType && (
                      <div style={{ color: "var(--muted)", fontSize: "0.75rem" }}>{e.patternType}</div>
                    )}
                  </td>
                  <td>
                    <span className="badge">{e.entityType}</span>
                  </td>
                  <td>
                    {e.labels.slice(0, 3).map((l) => (
                      <span key={l.value} className="badge" style={{ marginRight: 4 }}>
                        {l.value}
                      </span>
                    ))}
                  </td>
                  <td>{e.createdAt ? new Date(e.createdAt).toLocaleString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <p className="sub" style={{ marginTop: "0.5rem" }}>
        <Link to="/app/threat-intel">← Back to dashboard</Link>
      </p>
    </div>
  );
}
