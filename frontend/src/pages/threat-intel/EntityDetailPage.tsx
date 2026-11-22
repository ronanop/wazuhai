import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import ForceGraph2D, { type ForceGraphMethods } from "react-force-graph-2d";
import {
  api,
  type CatalogEntity,
  type EntityRelEdge,
  type EntityRelNode,
  type IndicatorSightings,
  type ThreatIntelCase,
} from "../../api/client";
import { entityDetailPath, isTiEntitySlug } from "./tiNav";
import "../../styles/soc.css";

type GraphNode = EntityRelNode & { isCenter?: boolean };
type GraphLink = { source: string; target: string; type: string };

export function EntityDetailPage() {
  const { type = "", id = "" } = useParams();
  const valid = isTiEntitySlug(type) && Boolean(id);
  const navigate = useNavigate();
  const graphRef = useRef<ForceGraphMethods<GraphNode, GraphLink> | undefined>(undefined);

  const [entity, setEntity] = useState<CatalogEntity | null>(null);
  const [uiUrl, setUiUrl] = useState("http://localhost:8080");
  const [nodes, setNodes] = useState<EntityRelNode[]>([]);
  const [edges, setEdges] = useState<EntityRelEdge[]>([]);
  const [sightings, setSightings] = useState<IndicatorSightings | null>(null);
  const [cases, setCases] = useState<ThreatIntelCase[]>([]);
  const [caseId, setCaseId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [graphWidth, setGraphWidth] = useState(640);
  const graphWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!valid) return;
    let alive = true;
    setLoading(true);
    setError(null);
    Promise.all([
      api.openctiEntity(type, id),
      api.openctiRelationships(type, id, { limit: 80 }),
      type === "indicators"
        ? api.openctiIndicatorSightings(id).catch(() => null)
        : Promise.resolve(null),
      api.threatCases().catch(() => ({ cases: [] as ThreatIntelCase[] })),
    ])
      .then(([ent, rel, sight, caseRes]) => {
        if (!alive) return;
        setEntity(ent.entity);
        setUiUrl(ent.uiUrl);
        setNodes(rel.nodes);
        setEdges(rel.edges);
        setSightings(sight);
        setCases(caseRes.cases.filter((c) => c.status !== "closed"));
      })
      .catch((err) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Failed to load entity");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [type, id, valid]);

  useEffect(() => {
    const el = graphWrapRef.current;
    if (!el) return;
    const measure = () => setGraphWidth(Math.max(320, el.clientWidth));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [entity]);

  const graphData = useMemo(() => {
    const centerId = entity?.id || id;
    const nmap = new Map<string, GraphNode>();
    if (entity) {
      nmap.set(entity.id, {
        id: entity.id,
        name: entity.name,
        entityType: entity.entityType,
        slug: entity.slug || type,
        isCenter: true,
      });
    }
    for (const n of nodes) {
      if (!nmap.has(n.id)) nmap.set(n.id, { ...n, isCenter: n.id === centerId });
    }
    const links: GraphLink[] = edges.map((e) => ({
      source: e.fromId,
      target: e.toId,
      type: e.relationshipType,
    }));
    return { nodes: [...nmap.values()], links };
  }, [entity, nodes, edges, id, type]);

  async function attachToCase() {
    if (!entity || !caseId) return;
    await api.attachThreatCaseEntity(caseId, {
      openctiId: entity.id,
      entityType: entity.entityType,
      name: entity.name,
      slug: entity.slug || type,
    });
    alert("Attached to case");
  }

  if (!valid) return <Navigate to="/app/threat-intel" replace />;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Threat Intel · {entity?.entityType || type}</p>
          <h1>{loading ? "Loading…" : entity?.name || "Entity"}</h1>
          <p className="sub">
            {entity?.description?.slice(0, 220) || "Knowledge graph, relationships, and detection sightings."}
            {entity?.description && entity.description.length > 220 ? "…" : ""}
          </p>
        </div>
        <div className="toolbar">
          <Link className="btn btn-ghost" to={`/app/threat-intel/${type}`}>
            Back to list
          </Link>
          <a className="btn btn-ghost" href={uiUrl} target="_blank" rel="noreferrer">
            Open in OpenCTI
          </a>
        </div>
      </header>

      {error && <p className="error-text">{error}</p>}

      {entity && (
        <>
          <div className="toolbar" style={{ flexWrap: "wrap", gap: "0.45rem" }}>
            <span className="badge">{entity.entityType}</span>
            {entity.mitreId && <span className="badge">{entity.mitreId}</span>}
            {entity.score != null && <span className="badge">score {entity.score}</span>}
            {entity.labels.map((l) => (
              <span key={l.value} className="badge">
                {l.value}
              </span>
            ))}
          </div>

          <section className="panel glass">
            <div className="threat-section-head" style={{ display: "flex", justifyContent: "space-between" }}>
              <h2 style={{ margin: 0, fontSize: "1rem" }}>Knowledge graph</h2>
              <span className="badge">
                {graphData.nodes.length} nodes · {graphData.links.length} links
              </span>
            </div>
            <div ref={graphWrapRef} style={{ height: 360, borderRadius: 8, overflow: "hidden", background: "#f8fafc" }}>
              <ForceGraph2D
                ref={graphRef as never}
                width={graphWidth}
                height={360}
                graphData={graphData}
                nodeLabel={(n) => `${(n as GraphNode).name} (${(n as GraphNode).entityType})`}
                nodeCanvasObject={(node, ctx, globalScale) => {
                  const n = node as GraphNode & { x?: number; y?: number };
                  const label = n.name.length > 22 ? `${n.name.slice(0, 20)}…` : n.name;
                  const fontSize = 12 / globalScale;
                  const r = n.isCenter ? 7 : 5;
                  ctx.beginPath();
                  ctx.arc(n.x || 0, n.y || 0, r, 0, 2 * Math.PI);
                  ctx.fillStyle = n.isCenter ? "#2563eb" : "#64748b";
                  ctx.fill();
                  ctx.font = `${fontSize}px Sans-Serif`;
                  ctx.textAlign = "center";
                  ctx.textBaseline = "top";
                  ctx.fillStyle = "#0f172a";
                  ctx.fillText(label, n.x || 0, (n.y || 0) + r + 2);
                }}
                linkColor={() => "rgba(100,116,139,0.45)"}
                linkDirectionalArrowLength={3.5}
                linkDirectionalArrowRelPos={1}
                onNodeClick={(node) => {
                  const n = node as GraphNode;
                  if (n.id === entity.id) return;
                  if (isTiEntitySlug(n.slug) || n.slug) {
                    navigate(entityDetailPath(n.slug || "malware", n.id));
                  }
                }}
              />
            </div>
          </section>

          {edges.length > 0 && (
            <section className="panel glass">
              <h2 style={{ marginTop: 0, fontSize: "1rem" }}>Relationships</h2>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>From</th>
                    <th>To</th>
                  </tr>
                </thead>
                <tbody>
                  {edges.slice(0, 40).map((e) => {
                    const from = nodes.find((n) => n.id === e.fromId) || graphData.nodes.find((n) => n.id === e.fromId);
                    const to = nodes.find((n) => n.id === e.toId) || graphData.nodes.find((n) => n.id === e.toId);
                    return (
                      <tr key={e.id}>
                        <td>
                          <span className="badge">{e.relationshipType}</span>
                        </td>
                        <td>
                          {from ? (
                            <button
                              type="button"
                              className="btn btn-ghost"
                              onClick={() => navigate(entityDetailPath(from.slug, from.id))}
                            >
                              {from.name}
                            </button>
                          ) : (
                            e.fromId
                          )}
                        </td>
                        <td>
                          {to ? (
                            <button
                              type="button"
                              className="btn btn-ghost"
                              onClick={() => navigate(entityDetailPath(to.slug, to.id))}
                            >
                              {to.name}
                            </button>
                          ) : (
                            e.toId
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          )}

          {type === "indicators" && (
            <section className="panel glass">
              <h2 style={{ marginTop: 0, fontSize: "1rem" }}>Wazuh sightings</h2>
              {entity.pattern && (
                <p style={{ color: "var(--muted)", fontSize: "0.82rem", wordBreak: "break-all" }}>
                  Pattern: {entity.pattern}
                </p>
              )}
              {!sightings && <p className="empty">No sightings loaded.</p>}
              {sightings && (
                <>
                  <div className="toolbar" style={{ marginBottom: "0.5rem" }}>
                    {sightings.observables.map((o) => (
                      <span key={`${o.kind}-${o.value}`} className="badge">
                        {o.kind}: {o.value}
                      </span>
                    ))}
                    <span className="badge">{sightings.total} alert hits</span>
                    {sightings.observables[0] && (
                      <Link
                        className="btn btn-ghost"
                        to={`/app/alerts?q=${encodeURIComponent(sightings.observables[0].value)}`}
                      >
                        Search alerts
                      </Link>
                    )}
                  </div>
                  {sightings.alerts.length === 0 ? (
                    <p className="empty">No matching Wazuh alerts for extracted observables.</p>
                  ) : (
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Rule</th>
                          <th>Agent</th>
                          <th>Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sightings.alerts.map((a) => (
                          <tr key={a.id}>
                            <td>{a.ruleDescription || a.ruleId}</td>
                            <td>{a.agentName || "—"}</td>
                            <td>{a.timestamp ? new Date(a.timestamp).toLocaleString() : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </>
              )}
            </section>
          )}

          <section className="panel glass">
            <h2 style={{ marginTop: 0, fontSize: "1rem" }}>Add to CTI case</h2>
            <div className="toolbar">
              <select value={caseId} onChange={(e) => setCaseId(e.target.value)}>
                <option value="">Select open case…</option>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
              <button className="btn btn-primary" type="button" disabled={!caseId} onClick={() => void attachToCase()}>
                Attach
              </button>
              <Link className="btn btn-ghost" to="/app/threat-intel/cases">
                Manage cases
              </Link>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
