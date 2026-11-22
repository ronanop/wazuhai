import { useEffect, useMemo, useState, type FormEvent } from "react";
import { api, type Role, type User } from "../api/client";
import { ListControls, SortableTimeTh } from "../components/ListControls";
import {
  applyClientListControls,
  DEFAULT_LIST_CONTROLS,
  toggleSort,
  type ListControlValue,
} from "../lib/listControls";
import "../styles/soc.css";

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [controls, setControls] = useState<ListControlValue>(DEFAULT_LIST_CONTROLS);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("SOC_ANALYST");
  const [busy, setBusy] = useState(false);

  const visibleUsers = useMemo(
    () =>
      applyClientListControls(users, { ...controls, agent: "" }, {
        time: (u) => u.lastLoginAt,
      }),
    [users, controls],
  );

  async function load() {
    setLoading(true);
    try {
      const res = await api.users();
      setUsers(res.users);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onInvite(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await api.inviteUser({ email, name, role });
      setMessage(`Invited ${res.user.email}. Token (dev/stub mail): ${res.inviteToken}`);
      setEmail("");
      setName("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invite failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow">Administration</p>
        <h1>Users</h1>
        <p className="sub">Invite analysts, deactivate accounts, and issue password resets. Public signup cannot create administrators.</p>
      </header>

      {error && <p className="error-text">{error}</p>}
      {message && (
        <div className="warning-banner" style={{ background: "rgba(31,122,76,0.1)", color: "var(--success)" }}>
          {message}
        </div>
      )}

      <section className="panel glass">
        <form className="toolbar" onSubmit={onInvite}>
          <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
          <input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="SOC_ANALYST">SOC Analyst</option>
            <option value="ADMINISTRATOR">Administrator</option>
          </select>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            Invite
          </button>
        </form>
      </section>

      <section className="panel glass">
        <ListControls value={controls} onChange={setControls} showAgent={false} />
      </section>

      <section className="panel glass">
        {loading && <p className="empty">Loading users…</p>}
        {!loading && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <SortableTimeTh
                  label="Last login"
                  sort={controls.sort}
                  onToggle={() => setControls((c) => ({ ...c, sort: toggleSort(c.sort) }))}
                />
                <th />
              </tr>
            </thead>
            <tbody>
              {visibleUsers.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>
                    <span className={`badge ${u.role === "ADMINISTRATOR" ? "badge-admin" : "badge-analyst"}`}>
                      {u.role === "ADMINISTRATOR" ? "Administrator" : "SOC Analyst"}
                    </span>
                  </td>
                  <td>{u.status}</td>
                  <td>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "—"}</td>
                  <td>
                    <div className="toolbar" style={{ justifyContent: "flex-end" }}>
                      <button
                        className="btn btn-ghost"
                        type="button"
                        onClick={async () => {
                          const next = u.status === "DISABLED" ? "ACTIVE" : "DISABLED";
                          await api.updateUser(u.id, { status: next });
                          await load();
                        }}
                      >
                        {u.status === "DISABLED" ? "Activate" : "Deactivate"}
                      </button>
                      <button
                        className="btn btn-ghost"
                        type="button"
                        onClick={async () => {
                          const res = await api.adminResetPassword(u.id);
                          setMessage(`Reset token for ${u.email}: ${res.resetToken}`);
                        }}
                      >
                        Reset password
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
