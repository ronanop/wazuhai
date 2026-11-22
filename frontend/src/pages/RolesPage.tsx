import { useEffect, useMemo, useState } from "react";
import { api, type Role, type RolePermission } from "../api/client";
import "../styles/soc.css";

export function RolesPage() {
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const [modules, setModules] = useState<string[]>([]);
  const [assignments, setAssignments] = useState<Array<{ role: Role; count: number }>>([]);
  const [role, setRole] = useState<Role>("SOC_ANALYST");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    try {
      const res = await api.roles();
      setPermissions(res.permissions);
      setModules(res.modules);
      setAssignments(res.assignments);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load roles");
    }
  }

  useEffect(() => {
    load();
  }, []);

  const rows = useMemo(
    () => permissions.filter((p) => p.role === role),
    [permissions, role],
  );

  async function toggle(module: string, field: keyof RolePermission, value: boolean) {
    await api.updateRolePermission({ role, module, [field]: value });
    setMessage(`Updated ${role} · ${module}`);
    await load();
  }

  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow">Administration</p>
        <h1>Roles & Access</h1>
        <p className="sub">Module permissions for Administrator and SOC Analyst. Backend route guards still enforce admin-only areas.</p>
      </header>

      {error && <p className="error-text">{error}</p>}
      {message && <div className="warning-banner" style={{ background: "rgba(31,122,76,0.1)", color: "var(--success)" }}>{message}</div>}

      <div className="kpi-grid">
        {assignments.map((a) => (
          <div key={a.role} className="kpi glass">
            <strong>{a.count}</strong>
            <span>{a.role === "ADMINISTRATOR" ? "Administrators" : "SOC Analysts"}</span>
          </div>
        ))}
      </div>

      <section className="panel glass">
        <div className="toolbar">
          <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="SOC_ANALYST">SOC Analyst</option>
            <option value="ADMINISTRATOR">Administrator</option>
          </select>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={async () => {
              await api.resetRolePermissions();
              setMessage("Permissions reset to defaults.");
              await load();
            }}
          >
            Reset defaults
          </button>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Module</th>
              <th>View</th>
              <th>Create</th>
              <th>Update</th>
              <th>Export</th>
              <th>Admin</th>
            </tr>
          </thead>
          <tbody>
            {(rows.length ? rows : modules.map((m) => ({ module: m } as RolePermission))).map((p) => (
              <tr key={p.module}>
                <td><strong>{p.module}</strong></td>
                {(["canView", "canCreate", "canUpdate", "canExport", "canAdmin"] as const).map((field) => (
                  <td key={field}>
                    <input
                      type="checkbox"
                      checked={Boolean(p[field])}
                      onChange={(e) => toggle(p.module, field, e.target.checked)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
