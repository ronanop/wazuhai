import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type Alert, type SavedHuntQuery, type Severity } from "../api/client";
import { useChatAssistant } from "../ai/ChatContext";
import { AskAiButton } from "../components/AskAiButton";
import { DataView } from "../components/DataView";
import { ListControls, SortableTimeTh } from "../components/ListControls";
import { downloadCsv } from "../lib/csv";
import {
  DEFAULT_LIST_CONTROLS,
  listQueryParams,
  toggleSort,
  type ListControlValue,
} from "../lib/listControls";
import "../styles/soc.css";

function toIncidentSeverity(s: Severity) {
  return s.toUpperCase();
}

export function ThreatHuntingPage() {
  const navigate = useNavigate();
  const { askAbout } = useChatAssistant();
  const [q, setQ] = useState("");
  const [severity, setSeverity] = useState("");
  const [group, setGroup] = useState("");
  const [controls, setControls] = useState<ListControlValue>(DEFAULT_LIST_CONTROLS);
  const [page, setPage] = useState(1);
  const [events, setEvents] = useState<Alert[]>([]);
  const [total, setTotal] = useState(0);
  const [saved, setSaved] = useState<SavedHuntQuery[]>([]);
  const [selected, setSelected] = useState<Alert | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveName, setSaveName] = useState("");
  const [note, setNote] = useState("");
  const [noteStatus, setNoteStatus] = useState("open");
  const [noteBusy, setNoteBusy] = useState(false);
  const [noteMsg, setNoteMsg] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const pageSize = 25;

  async function runSearch(nextPage = page, nextControls = controls) {
    setLoading(true);
    setError(null);
    try {
      const res = await api.huntSearch({
        page: nextPage,
        pageSize,
        q,
        severity,
        group,
        ...listQueryParams(nextControls),
      });
      setEvents(res.events);
      setTotal(res.total);
      setPage(nextPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    api.huntSaved().then((r) => setSaved(r.queries)).catch(() => undefined);
  }, []);

  useEffect(() => {
    runSearch(1, controls);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controls]);

  useEffect(() => {
    if (!selected) {
      setNote("");
      setNoteStatus("open");
      setNoteMsg(null);
      return;
    }
    let alive = true;
    setNoteMsg(null);
    api
      .huntNotesGet([selected.indexId])
      .then((res) => {
        if (!alive) return;
        const n = res.notes[0];
        setNote(n?.note ?? "");
        setNoteStatus(n?.status ?? "open");
      })
      .catch(() => {
        if (!alive) return;
        setNote("");
        setNoteStatus("open");
      });
    return () => {
      alive = false;
    };
  }, [selected]);

  async function onSave() {
    if (!saveName.trim()) return;
    const created = await api.huntSave(saveName.trim(), {
      q,
      severity,
      agent: controls.agent,
      group,
      from: listQueryParams(controls).from,
      to: listQueryParams(controls).to,
      sort: controls.sort,
      range: controls.range,
    });
    setSaved((prev) => [created.query, ...prev]);
    setSaveName("");
  }

  async function loadSaved(item: SavedHuntQuery) {
    const query = item.query as {
      q?: string;
      severity?: string;
      agent?: string;
      group?: string;
      from?: string;
      to?: string;
      sort?: string;
      range?: string;
    };
    setQ(String(query.q ?? ""));
    setSeverity(String(query.severity ?? ""));
    setGroup(String(query.group ?? ""));
    const nextControls: ListControlValue = {
      ...DEFAULT_LIST_CONTROLS,
      agent: String(query.agent ?? ""),
      from: String(query.from ?? ""),
      to: String(query.to ?? ""),
      sort: query.sort === "asc" ? "asc" : "desc",
      range:
        query.range === "24h" ||
        query.range === "7d" ||
        query.range === "30d" ||
        query.range === "custom" ||
        query.range === "all"
          ? query.range
          : query.from || query.to
            ? "custom"
            : "all",
    };
    setControls(nextControls);
    setTimeout(() => runSearch(1, nextControls), 0);
  }

  async function saveNote() {
    if (!selected) return;
    setNoteBusy(true);
    setNoteMsg(null);
    try {
      await api.huntNoteSet({
        findingKey: selected.indexId,
        note,
        status: noteStatus,
      });
      setNoteMsg("Note saved.");
    } catch (err) {
      setNoteMsg(err instanceof Error ? err.message : "Failed to save note");
    } finally {
      setNoteBusy(false);
    }
  }

  function exportEvents() {
    downloadCsv(
      `hunt-events-page-${page}.csv`,
      events.map((e) => ({
        timestamp: e.timestamp,
        severity: e.severity,
        level: e.level,
        ruleId: e.ruleId,
        ruleDescription: e.ruleDescription,
        agentName: e.agentName,
        agentId: e.agentId,
        location: e.location,
        groups: e.groups.join("|"),
        mitre: (e.mitre ?? []).join("|"),
        indexId: e.indexId,
      })),
    );
  }

  function suggestAiQuery() {
    if (!selected) return;
    askAbout(
      {
        type: "hunt",
        id: selected.indexId,
        title: selected.ruleDescription,
        meta: {
          agentName: selected.agentName,
          agentId: selected.agentId,
          ruleId: selected.ruleId,
          severity: selected.severity,
          groups: selected.groups,
          mitre: selected.mitre,
        },
      },
      [
        "Suggest a threat-hunting query (Wazuh/indexer style) to pivot from this event.",
        `Rule: ${selected.ruleDescription} (#${selected.ruleId})`,
        `Agent: ${selected.agentName} (${selected.agentId || "—"})`,
        `Severity: ${selected.severity}`,
        `Groups: ${selected.groups.join(", ") || "—"}`,
        `MITRE: ${selected.mitre?.join(", ") || "—"}`,
        "Return 1–3 concrete query strings plus what each would surface.",
      ].join("\n"),
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow">Investigation</p>
        <h1>Threat Hunting</h1>
        <p className="sub">Search Wazuh security events, expand evidence, and save reusable queries.</p>
      </header>

      <section className="panel glass">
        <div className="toolbar" style={{ flexDirection: "column", alignItems: "stretch" }}>
          <ListControls value={controls} onChange={setControls} />
          <div className="toolbar">
            <input
              placeholder="Query text…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ flex: 1, minWidth: 220 }}
            />
            <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
              <option value="">Severity</option>
              <option value="critical">critical</option>
              <option value="high">high</option>
              <option value="medium">medium</option>
              <option value="low">low</option>
            </select>
            <input placeholder="Group (e.g. sca)" value={group} onChange={(e) => setGroup(e.target.value)} />
            <button className="btn btn-primary" type="button" onClick={() => runSearch(1)}>
              Run hunt
            </button>
            <button className="btn btn-ghost" type="button" disabled={!events.length} onClick={exportEvents}>
              Export CSV
            </button>
          </div>
          <div className="toolbar">
            <input placeholder="Save query as…" value={saveName} onChange={(e) => setSaveName(e.target.value)} />
            <button className="btn btn-ghost" type="button" onClick={onSave}>
              Save
            </button>
            {saved.slice(0, 5).map((s) => (
              <button key={s.id} className="btn btn-ghost" type="button" onClick={() => loadSaved(s)}>
                {s.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="panel glass">
        {loading && <p className="empty">Searching indexer…</p>}
        {error && <p className="error-text">{error}</p>}
        {!loading && !error && (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <SortableTimeTh
                    sort={controls.sort}
                    onToggle={() => setControls((c) => ({ ...c, sort: toggleSort(c.sort) }))}
                  />
                  <th>Severity</th>
                  <th>Rule</th>
                  <th>Agent</th>
                  <th>Groups</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.indexId} onClick={() => setSelected(e)}>
                    <td>{e.timestamp ? new Date(e.timestamp).toLocaleString() : "—"}</td>
                    <td>
                      <span className={`sev sev-${e.severity}`}>{e.severity}</span>
                    </td>
                    <td>
                      <strong>{e.ruleDescription}</strong>
                      <div style={{ color: "var(--muted)", fontSize: "0.8rem" }}>#{e.ruleId}</div>
                    </td>
                    <td>{e.agentName}</td>
                    <td>{e.groups.slice(0, 3).join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="pager">
              <span>
                {total.toLocaleString()} events · page {page}/{totalPages}
              </span>
              <div className="toolbar">
                <button className="btn btn-ghost" type="button" disabled={page <= 1} onClick={() => runSearch(page - 1)}>
                  Previous
                </button>
                <button
                  className="btn btn-ghost"
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => runSearch(page + 1)}
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
            <h2>{selected.ruleDescription}</h2>
            <div className="meta-grid">
              <div>
                <span>MITRE</span>
                <strong>{selected.mitre?.join(", ") || "—"}</strong>
              </div>
              <div>
                <span>Agent</span>
                <strong>{selected.agentName}</strong>
              </div>
              <div>
                <span>Groups</span>
                <strong>{selected.groups.join(", ") || "—"}</strong>
              </div>
            </div>
            <div style={{ marginTop: "0.85rem" }}>
              <DataView
                data={selected.raw?.data ?? selected.raw ?? {}}
                title="Evidence"
                storageKey="aegis-hunt-evidence-view"
                maxHeight="40vh"
              />
            </div>
            <div className="field">
              <label htmlFor="hunt-status">Investigation status</label>
              <select id="hunt-status" value={noteStatus} onChange={(e) => setNoteStatus(e.target.value)}>
                <option value="open">open</option>
                <option value="investigating">investigating</option>
                <option value="closed">closed</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="hunt-note">Investigation notes</label>
              <input
                id="hunt-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add hunt notes…"
              />
            </div>
            {noteMsg && <p className="empty">{noteMsg}</p>}
            <div className="toolbar">
              <AskAiButton
                selection={{
                  type: "hunt",
                  id: selected.indexId,
                  title: selected.ruleDescription,
                  meta: {
                    agentName: selected.agentName,
                    agentId: selected.agentId,
                    ruleId: selected.ruleId,
                    severity: selected.severity,
                  },
                }}
              />
              <button className="btn btn-ghost" type="button" onClick={suggestAiQuery}>
                Suggest AI query
              </button>
              <button className="btn btn-ghost" type="button" disabled={noteBusy} onClick={saveNote}>
                {noteBusy ? "Saving…" : "Save note"}
              </button>
              <button
                className="btn btn-primary"
                type="button"
                disabled={creating}
                onClick={async () => {
                  setCreating(true);
                  try {
                    const res = await api.createIncident({
                      title: selected.ruleDescription,
                      description: `Created from hunt event ${selected.id}`,
                      severity: toIncidentSeverity(selected.severity),
                      alertIndexId: selected.indexId,
                      alertRuleId: selected.ruleId,
                      alertRuleDescription: selected.ruleDescription,
                      agentName: selected.agentName,
                      agentId: selected.agentId,
                    });
                    navigate(`/app/incidents?id=${res.incident.id}`);
                  } finally {
                    setCreating(false);
                  }
                }}
              >
                {creating ? "Creating…" : "Create incident"}
              </button>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
