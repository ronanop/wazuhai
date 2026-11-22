import { useEffect, useState, type FormEvent } from "react";
import { api, type AppSettings, type ChatbotSettings, type NotificationRule } from "../api/client";
import { DEFAULT_PROMPT_HINT } from "../ai/promptHint";
import "../styles/soc.css";

export function SettingsPage() {
  const [tab, setTab] = useState<"general" | "chatbot" | "notifications">("general");
  const [settings, setSettings] = useState<ChatbotSettings | null>(null);
  const [app, setApp] = useState<AppSettings | null>(null);
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [smtpPassDraft, setSmtpPassDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const [chat, appRes, rulesRes] = await Promise.all([
        api.chatbotSettings(),
        api.appSettings(),
        api.notificationRules(),
      ]);
      setSettings(chat.settings);
      setApp(appRes.settings);
      setRules(rulesRes.rules);
      setApiKeyDraft("");
      setSmtpPassDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        enabled: settings.enabled,
        provider: settings.provider,
        model: settings.model,
        apiBaseUrl: settings.apiBaseUrl,
        temperature: Number(settings.temperature),
        maxTokens: Number(settings.maxTokens),
        systemPrompt: settings.systemPrompt,
        groundingEnabled: settings.groundingEnabled,
        requireCitations: settings.requireCitations,
        refuseIfNoEvidence: settings.refuseIfNoEvidence,
        maxEvidenceItems: Number(settings.maxEvidenceItems),
        toolsEnabled: settings.toolsEnabled,
        suggestPlaybooks: settings.suggestPlaybooks,
        activeResponseEnabled: settings.activeResponseEnabled,
        dryRunDefault: settings.dryRunDefault,
        maxActionsPerDay: Number(settings.maxActionsPerDay),
      };
      if (apiKeyDraft.trim()) payload.apiKey = apiKeyDraft.trim();
      const res = await api.updateChatbotSettings(payload);
      setSettings(res.settings);
      setApiKeyDraft("");
      setMessage("Chatbot settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow">Administration</p>
        <h1>Application Settings</h1>
        <p className="sub">Control platform preferences and the grounded security assistant.</p>
      </header>

      <div className="toolbar">
        <button className={`btn ${tab === "general" ? "btn-primary" : "btn-ghost"}`} type="button" onClick={() => setTab("general")}>
          General
        </button>
        <button className={`btn ${tab === "chatbot" ? "btn-primary" : "btn-ghost"}`} type="button" onClick={() => setTab("chatbot")}>
          Chatbot
        </button>
        <button className={`btn ${tab === "notifications" ? "btn-primary" : "btn-ghost"}`} type="button" onClick={() => setTab("notifications")}>
          Email & Notifications
        </button>
      </div>

      {error && tab !== "chatbot" && <p className="error-text">{error}</p>}
      {message && tab !== "chatbot" && (
        <div className="warning-banner" style={{ background: "rgba(31,122,76,0.1)", color: "var(--success)" }}>{message}</div>
      )}

      {tab === "general" && (
        <section className="panel glass">
          {!app && <p className="empty">Loading application settings…</p>}
          {app && (
            <form
              className="settings-form"
              onSubmit={async (e) => {
                e.preventDefault();
                setSaving(true);
                setMessage(null);
                try {
                  const res = await api.updateAppSettings({
                    timezone: app.timezone,
                    dateFormat: app.dateFormat,
                    defaultLanding: app.defaultLanding,
                    sessionHours: Number(app.sessionHours),
                  });
                  setApp(res.settings);
                  setMessage("General settings saved.");
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Save failed");
                } finally {
                  setSaving(false);
                }
              }}
            >
              <div className="field">
                <label>Timezone</label>
                <input value={app.timezone} onChange={(e) => setApp({ ...app, timezone: e.target.value })} />
              </div>
              <div className="field">
                <label>Date format</label>
                <input value={app.dateFormat} onChange={(e) => setApp({ ...app, dateFormat: e.target.value })} />
              </div>
              <div className="field">
                <label>Default landing path</label>
                <input value={app.defaultLanding} onChange={(e) => setApp({ ...app, defaultLanding: e.target.value })} />
              </div>
              <div className="field">
                <label>Session hours</label>
                <input
                  type="number"
                  min={1}
                  max={168}
                  value={app.sessionHours}
                  onChange={(e) => setApp({ ...app, sessionHours: Number(e.target.value) })}
                />
              </div>
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save general settings"}
              </button>
            </form>
          )}
        </section>
      )}

      {tab === "notifications" && (
        <section className="panel glass">
          {app && (
            <form
              className="settings-form"
              onSubmit={async (e) => {
                e.preventDefault();
                setSaving(true);
                setMessage(null);
                try {
                  const payload: Record<string, unknown> = {
                    smtpEnabled: app.smtpEnabled,
                    smtpHost: app.smtpHost,
                    smtpPort: Number(app.smtpPort),
                    smtpUser: app.smtpUser,
                    smtpFrom: app.smtpFrom,
                  };
                  if (smtpPassDraft.trim()) payload.smtpPass = smtpPassDraft.trim();
                  const res = await api.updateAppSettings(payload);
                  setApp(res.settings);
                  setSmtpPassDraft("");
                  setMessage("Email settings saved.");
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Save failed");
                } finally {
                  setSaving(false);
                }
              }}
            >
              <label className="check">
                <input
                  type="checkbox"
                  checked={app.smtpEnabled}
                  onChange={(e) => setApp({ ...app, smtpEnabled: e.target.checked })}
                />
                Enable SMTP delivery (otherwise stub/log mode)
              </label>
              <div className="field">
                <label>SMTP host</label>
                <input value={app.smtpHost} onChange={(e) => setApp({ ...app, smtpHost: e.target.value })} />
              </div>
              <div className="toolbar">
                <div className="field" style={{ flex: 1 }}>
                  <label>Port</label>
                  <input
                    type="number"
                    value={app.smtpPort}
                    onChange={(e) => setApp({ ...app, smtpPort: Number(e.target.value) })}
                  />
                </div>
                <div className="field" style={{ flex: 2 }}>
                  <label>From</label>
                  <input value={app.smtpFrom} onChange={(e) => setApp({ ...app, smtpFrom: e.target.value })} />
                </div>
              </div>
              <div className="field">
                <label>SMTP user</label>
                <input value={app.smtpUser} onChange={(e) => setApp({ ...app, smtpUser: e.target.value })} />
              </div>
              <div className="field">
                <label>SMTP password {app.smtpConfigured ? "(saved)" : "(not set)"}</label>
                <input
                  type="password"
                  value={smtpPassDraft}
                  onChange={(e) => setSmtpPassDraft(e.target.value)}
                  placeholder="Leave blank to keep"
                />
              </div>
              <div className="toolbar">
                <button className="btn btn-primary" type="submit" disabled={saving}>
                  Save email settings
                </button>
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={async () => {
                    const res = await api.testEmail();
                    setMessage(`Test email mode: ${res.result.mode} (delivered=${res.result.delivered})`);
                  }}
                >
                  Send test email
                </button>
              </div>
            </form>
          )}

          <h3 style={{ margin: "1.25rem 0 0.65rem", fontSize: "1rem" }}>Notification rules</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Event</th>
                <th>Min severity</th>
                <th>Channels</th>
                <th>Enabled</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>{r.eventType}</td>
                  <td>{r.minSeverity}</td>
                  <td>{Array.isArray(r.channels) ? r.channels.join(", ") : String(r.channels)}</td>
                  <td>
                    <input
                      type="checkbox"
                      checked={r.enabled}
                      onChange={async (e) => {
                        await api.updateNotificationRule(r.id, { enabled: e.target.checked });
                        await load();
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {tab === "chatbot" && (
        <section className="panel glass">
          {error && <p className="error-text">{error}</p>}
          {message && <div className="warning-banner" style={{ background: "rgba(31,122,76,0.1)", color: "var(--success)" }}>{message}</div>}
          {!settings && !error && <p className="empty">Loading chatbot settings…</p>}
          {settings && (
            <form className="settings-form" onSubmit={onSave}>
              <div className="settings-grid">
                <label className="check">
                  <input
                    type="checkbox"
                    checked={settings.enabled}
                    onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                  />
                  Enable chatbot
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={settings.groundingEnabled}
                    onChange={(e) => setSettings({ ...settings, groundingEnabled: e.target.checked })}
                  />
                  Grounding (live evidence retrieval)
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={settings.requireCitations}
                    onChange={(e) => setSettings({ ...settings, requireCitations: e.target.checked })}
                  />
                  Require citations in prompt policy
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={settings.refuseIfNoEvidence}
                    onChange={(e) => setSettings({ ...settings, refuseIfNoEvidence: e.target.checked })}
                  />
                  Refuse when evidence is missing
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={settings.toolsEnabled}
                    onChange={(e) => setSettings({ ...settings, toolsEnabled: e.target.checked })}
                  />
                  Enable SOAR tools / playbooks
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={settings.suggestPlaybooks}
                    onChange={(e) => setSettings({ ...settings, suggestPlaybooks: e.target.checked })}
                  />
                  Suggest playbooks in investigations
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={settings.dryRunDefault}
                    onChange={(e) => setSettings({ ...settings, dryRunDefault: e.target.checked })}
                  />
                  Default dry-run for actions
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={settings.activeResponseEnabled}
                    onChange={(e) => setSettings({ ...settings, activeResponseEnabled: e.target.checked })}
                  />
                  Allow live Wazuh active response
                </label>
              </div>

              <div className="field">
                <label>Provider</label>
                <select
                  value={settings.provider}
                  onChange={(e) => setSettings({ ...settings, provider: e.target.value })}
                >
                  <option value="openai">OpenAI-compatible</option>
                </select>
              </div>

              <div className="field">
                <label>Model</label>
                <input
                  value={settings.model}
                  onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                  placeholder="gpt-4o-mini"
                />
              </div>

              <div className="field">
                <label>API base URL</label>
                <input
                  value={settings.apiBaseUrl}
                  onChange={(e) => setSettings({ ...settings, apiBaseUrl: e.target.value })}
                />
              </div>

              <div className="field">
                <label>API key {settings.apiKeyConfigured ? `(saved: ${settings.apiKeyMasked})` : "(not configured)"}</label>
                <input
                  type="password"
                  value={apiKeyDraft}
                  onChange={(e) => setApiKeyDraft(e.target.value)}
                  placeholder="Paste new key to update (leave blank to keep)"
                  autoComplete="off"
                />
              </div>

              <div className="toolbar">
                <div className="field" style={{ flex: 1 }}>
                  <label>Temperature</label>
                  <input
                    type="number"
                    step="0.05"
                    min={0}
                    max={2}
                    value={settings.temperature}
                    onChange={(e) => setSettings({ ...settings, temperature: Number(e.target.value) })}
                  />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label>Max tokens</label>
                  <input
                    type="number"
                    min={100}
                    max={8000}
                    value={settings.maxTokens}
                    onChange={(e) => setSettings({ ...settings, maxTokens: Number(e.target.value) })}
                  />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label>Max evidence items</label>
                  <input
                    type="number"
                    min={3}
                    max={40}
                    value={settings.maxEvidenceItems}
                    onChange={(e) => setSettings({ ...settings, maxEvidenceItems: Number(e.target.value) })}
                  />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label>Max actions / day</label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={settings.maxActionsPerDay}
                    onChange={(e) => setSettings({ ...settings, maxActionsPerDay: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="field">
                <label>System prompt</label>
                <textarea
                  className="prompt-box"
                  value={settings.systemPrompt}
                  onChange={(e) => setSettings({ ...settings, systemPrompt: e.target.value })}
                  rows={16}
                />
                <p className="empty" style={{ padding: "0.35rem 0 0" }}>{DEFAULT_PROMPT_HINT}</p>
              </div>

              <div className="toolbar">
                <button className="btn btn-primary" type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Save chatbot settings"}
                </button>
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={async () => {
                    const res = await api.resetChatbotPrompt();
                    setSettings(res.settings);
                    setMessage("System prompt reset to default grounded policy.");
                  }}
                >
                  Reset prompt
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      <style>{`
        .settings-form { display: grid; gap: 0.9rem; padding-top: 0.35rem; }
        .settings-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 0.55rem;
        }
        .check {
          display: flex;
          gap: 0.5rem;
          align-items: center;
          font-size: 0.9rem;
          color: var(--ink-soft);
          padding: 0.65rem 0.75rem;
          border-radius: 12px;
          border: 1px solid var(--line);
          background: rgba(255,255,255,0.5);
        }
        .prompt-box {
          width: 100%;
          border: 1px solid var(--line-strong);
          border-radius: 14px;
          padding: 0.9rem 1rem;
          background: rgba(255,255,255,0.85);
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 0.78rem;
          line-height: 1.45;
          resize: vertical;
        }
        .field select {
          border: 1px solid var(--line-strong);
          border-radius: 14px;
          padding: 0.95rem 1rem;
          background: rgba(255,255,255,0.85);
        }
      `}</style>
    </div>
  );
}
