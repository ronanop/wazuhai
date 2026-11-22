import { useState, type FormEvent } from "react";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import "../styles/soc.css";

export function ProfilePage() {
  const { user, logout } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.updateProfile(name.trim());
      setMessage("Profile updated. Refresh session to see name in shell.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setMessage("Password changed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Password change failed");
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow">Account</p>
        <h1>Profile</h1>
        <p className="sub">Update your display name, change password, and review session details.</p>
      </header>

      {error && <p className="error-text">{error}</p>}
      {message && (
        <div className="warning-banner" style={{ background: "rgba(31,122,76,0.1)", color: "var(--success)" }}>
          {message}
        </div>
      )}

      <section className="panel glass">
        <div className="meta-grid">
          <div>
            <span>Email</span>
            <strong>{user?.email}</strong>
          </div>
          <div>
            <span>Role</span>
            <strong>{user?.role === "ADMINISTRATOR" ? "Administrator" : "SOC Analyst"}</strong>
          </div>
          <div>
            <span>Last login</span>
            <strong>{user?.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "—"}</strong>
          </div>
          <div>
            <span>Session</span>
            <strong>HttpOnly cookie · 8h default (configurable in Settings)</strong>
          </div>
        </div>
      </section>

      <section className="panel glass">
        <form onSubmit={saveProfile} className="settings-form">
          <div className="field">
            <label>Display name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <button className="btn btn-primary" type="submit">
            Save profile
          </button>
        </form>
      </section>

      <section className="panel glass">
        <form onSubmit={savePassword} className="settings-form">
          <div className="field">
            <label>Current password</label>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
          </div>
          <div className="field">
            <label>New password</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} required />
          </div>
          <div className="toolbar">
            <button className="btn btn-primary" type="submit">
              Change password
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => logout()}>
              Sign out
            </button>
          </div>
        </form>
      </section>

      <style>{`
        .settings-form { display: grid; gap: 0.85rem; padding-top: 0.35rem; max-width: 480px; }
      `}</style>
    </div>
  );
}
