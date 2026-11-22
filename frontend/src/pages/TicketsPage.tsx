import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, type Ticket, type TicketDetail } from "../api/client";
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

const STATUSES = ["OPEN", "IN_PROGRESS", "BLOCKED", "DONE", "CLOSED"];
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];

export function TicketsPage() {
  const [params] = useSearchParams();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<TicketDetail | null>(null);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [controls, setControls] = useState<ListControlValue>(DEFAULT_LIST_CONTROLS);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await api.tickets({ status, q, ...listQueryParams(controls) });
      setTickets(res.tickets);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tickets");
    } finally {
      setLoading(false);
    }
  }

  async function openTicket(id: string) {
    const res = await api.ticket(id);
    setSelected(res.ticket);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, q, controls]);

  useEffect(() => {
    const id = params.get("id");
    if (id) openTicket(id).catch(() => undefined);
  }, [params]);

  async function createTicket() {
    if (!title.trim()) return;
    const due = new Date();
    due.setDate(due.getDate() + 3);
    const res = await api.createTicket({
      title: title.trim(),
      priority: "MEDIUM",
      dueAt: due.toISOString(),
    });
    setTitle("");
    await load();
    await openTicket(res.ticket.id);
  }

  async function updateStatus(next: string) {
    if (!selected) return;
    await api.updateTicket(selected.id, { status: next });
    await load();
    await openTicket(selected.id);
  }

  async function addComment() {
    if (!selected || !comment.trim()) return;
    await api.addTicketComment(selected.id, comment.trim());
    setComment("");
    await openTicket(selected.id);
  }

  function exportTickets() {
    downloadCsv(
      "tickets.csv",
      tickets.map((t) => ({
        id: t.id,
        title: t.title,
        priority: t.priority,
        status: t.status,
        dueAt: t.dueAt,
        owner: t.owner?.name || "",
        incidentId: t.incidentId,
        incidentTitle: t.incident?.title || "",
        linkedAlertId: t.linkedAlertId,
        linkedVulnId: t.linkedVulnId,
        linkedAgentName: t.linkedAgentName,
        overdue: t.overdue ? "yes" : "no",
        updatedAt: t.updatedAt,
      })),
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow">Remediation</p>
        <h1>Tickets</h1>
        <p className="sub">Track remediation work, due dates, and comments linked to incidents and alerts.</p>
      </header>

      <section className="panel glass">
        <div className="toolbar" style={{ flexDirection: "column", alignItems: "stretch" }}>
          <ListControls
            value={controls}
            onChange={setControls}
            agentPlaceholder="Filter by linked agent…"
          />
          <div className="toolbar">
            <input placeholder="Search tickets…" value={q} onChange={(e) => setQ(e.target.value)} />
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <input placeholder="New ticket title…" value={title} onChange={(e) => setTitle(e.target.value)} />
            <button className="btn btn-primary" type="button" onClick={createTicket}>
              Create
            </button>
            <button className="btn btn-ghost" type="button" disabled={!tickets.length} onClick={exportTickets}>
              Export CSV
            </button>
          </div>
        </div>
      </section>

      <section className="panel glass">
        {loading && <p className="empty">Loading tickets…</p>}
        {error && <p className="error-text">{error}</p>}
        {!loading && !error && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Due</th>
                <SortableTimeTh
                  label="Updated"
                  sort={controls.sort}
                  onToggle={() => setControls((c) => ({ ...c, sort: toggleSort(c.sort) }))}
                />
                <th>Owner</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} onClick={() => openTicket(t.id)}>
                  <td>
                    <strong>{t.title}</strong>
                    {t.overdue && (
                      <div style={{ color: "var(--danger)", fontSize: "0.78rem" }}>Overdue</div>
                    )}
                  </td>
                  <td>
                    <span className="badge">{t.priority}</span>
                  </td>
                  <td>
                    <span className="badge">{t.status}</span>
                  </td>
                  <td>{t.dueAt ? new Date(t.dueAt).toLocaleDateString() : "—"}</td>
                  <td>{t.updatedAt ? new Date(t.updatedAt).toLocaleString() : "—"}</td>
                  <td>{t.owner?.name || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
            {selected.overdue && <div className="warning-banner">This ticket is overdue.</div>}
            <p style={{ color: "var(--ink-soft)" }}>{selected.description || "No description."}</p>
            <div className="toolbar">
              <AskAiButton selection={{ type: "ticket", id: selected.id, title: selected.title }} />
            </div>
            <div className="field">
              <label>Status</label>
              <select value={selected.status} onChange={(e) => updateStatus(e.target.value)}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="meta-grid">
              <div>
                <span>Priority</span>
                <strong>{selected.priority}</strong>
              </div>
              <div>
                <span>Incident</span>
                <strong>
                  {selected.incidentId ? (
                    <Link to={`/app/incidents?id=${selected.incidentId}`}>
                      {selected.incident?.title || selected.incidentId}
                    </Link>
                  ) : (
                    "—"
                  )}
                </strong>
              </div>
              <div>
                <span>Linked alert</span>
                <strong style={{ fontWeight: 400, wordBreak: "break-all" }}>
                  {selected.linkedAlertId || "—"}
                </strong>
              </div>
              <div>
                <span>Priorities</span>
                <strong style={{ fontWeight: 400 }}>{PRIORITIES.join(" · ")}</strong>
              </div>
            </div>
            <div className="field">
              <label>Comment</label>
              <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add comment…" />
            </div>
            <button className="btn btn-primary" type="button" onClick={addComment}>
              Post comment
            </button>
            <div className="meta-grid">
              <div>
                <span>Activity</span>
                <strong style={{ fontWeight: 400 }}>
                  {(selected.comments || []).map((c) => (
                    <div key={c.id} style={{ marginBottom: "0.55rem" }}>
                      <div>{c.body}</div>
                      <div style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
                        {c.user.name} · {new Date(c.createdAt).toLocaleString()}
                      </div>
                    </div>
                  ))}
                  {!selected.comments?.length && "No comments yet."}
                </strong>
              </div>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
