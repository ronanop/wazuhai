import { useEffect, useMemo, useState, type ReactNode } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  IconAlerts,
  IconAudit,
  IconBell,
  IconCompliance,
  IconEndpoints,
  IconFim,
  IconHunt,
  IconIncidents,
  IconMalware,
  IconMitre,
  IconThreatIntel,
  IconOverview,
  IconProfile,
  IconReports,
  IconResponse,
  IconSca,
  IconSettings,
  IconSignOut,
  IconTickets,
  IconRoles,
  IconUsers,
  IconVulns,
} from "../components/NavIcons";
import { AiAssistant } from "../components/AiAssistant";
import { useAuth } from "../auth/AuthContext";
import { api, type AppNotification } from "../api/client";
const TITLE_MAP: Array<{ match: RegExp; title: string }> = [
  { match: /^\/app\/?$/, title: "Overview" },
  { match: /^\/app\/alerts/, title: "Security Alerts" },
  { match: /^\/app\/endpoints/, title: "Endpoints" },
  { match: /^\/app\/vulnerabilities/, title: "Vulnerabilities" },
  { match: /^\/app\/hunting/, title: "Threat Hunting" },
  { match: /^\/app\/fim/, title: "File Integrity Monitoring" },
  { match: /^\/app\/sca/, title: "Configuration Assessment" },
  { match: /^\/app\/malware/, title: "Malware" },
  { match: /^\/app\/mitre/, title: "MITRE ATT&CK" },
  { match: /^\/app\/threat-intel\/cases/, title: "Threat Intel Cases" },
  { match: /^\/app\/threat-intel\/attack-coverage/, title: "ATT&CK Coverage" },
  { match: /^\/app\/threat-intel/, title: "Threat Intel" },
  { match: /^\/app\/incidents/, title: "Incidents" },
  { match: /^\/app\/tickets/, title: "Tickets" },
  { match: /^\/app\/response-actions/, title: "Response Actions" },
  { match: /^\/app\/compliance/, title: "Compliance" },
  { match: /^\/app\/reports/, title: "Reports" },
  { match: /^\/app\/users/, title: "Users" },
  { match: /^\/app\/roles/, title: "Roles & Access" },
  { match: /^\/app\/audit/, title: "Audit Logs" },
  { match: /^\/app\/settings/, title: "Settings" },
  { match: /^\/app\/profile/, title: "Profile" },
];

const SIDEBAR_KEY = "aegis.sidebar.collapsed";

function NavItem({
  to,
  end,
  title,
  icon,
  children,
}: {
  to: string;
  end?: boolean;
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <NavLink to={to} end={end} title={title}>
      <span className="nav-icon-wrap">{icon}</span>
      <span className="nav-text">{children}</span>
    </NavLink>
  );
}

export function AppShell() {
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) === "1";
    } catch {
      return false;
    }
  });

  function toggleSidebar() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }

  const pageTitle = useMemo(() => {
    const hit = TITLE_MAP.find((t) => t.match.test(location.pathname));
    return hit?.title || "Aegis";
  }, [location.pathname]);

  async function refreshNotifications() {
    try {
      const res = await api.notifications();
      setNotifications(res.notifications);
      setUnread(res.unreadCount);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    refreshNotifications();
    const t = window.setInterval(refreshNotifications, 30000);
    return () => window.clearInterval(t);
  }, []);

  async function onLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  async function openNotification(n: AppNotification) {
    if (!n.readAt) await api.markNotificationRead(n.id);
    await refreshNotifications();
    setNotifOpen(false);
    if (n.href) navigate(n.href);
  }

  return (
    <div className={`app-shell ${collapsed ? "is-collapsed" : ""}`}>
      <aside className="app-sidebar">
        <div className="app-brand-row">
          <div
            className="app-brand"
            onClick={() => navigate("/app")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") navigate("/app");
            }}
            role="button"
            tabIndex={0}
            title="Aegis"
          >
            <div className="app-brand-mark" aria-hidden>
              <svg viewBox="0 0 32 32" fill="none">
                <path
                  d="M16 3L27 9.5V22.5L16 29L5 22.5V9.5L16 3Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
                <path
                  d="M16 10.5V21.5M11.5 13.5L16 16L20.5 13.5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="app-brand-text">
              <strong>Aegis</strong>
              <span>Security Platform</span>
            </div>
          </div>
          <button
            className="sidebar-toggle"
            type="button"
            onClick={toggleSidebar}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
          >
            <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden>
              {collapsed ? (
                <path
                  d="M9 6l6 6-6 6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : (
                <path
                  d="M15 6l-6 6 6 6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </svg>
          </button>
        </div>

        <nav className="app-nav">
          <p className="nav-label">Monitor</p>
          <NavItem to="/app" end title="Overview" icon={<IconOverview className="nav-icon" />}>
            Overview
          </NavItem>
          <NavItem to="/app/alerts" title="Alerts" icon={<IconAlerts className="nav-icon" />}>
            Alerts
          </NavItem>
          <NavItem to="/app/endpoints" title="Endpoints" icon={<IconEndpoints className="nav-icon" />}>
            Endpoints
          </NavItem>
          <NavItem
            to="/app/vulnerabilities"
            title="Vulnerabilities"
            icon={<IconVulns className="nav-icon" />}
          >
            Vulnerabilities
          </NavItem>

          <p className="nav-label">Detect</p>
          <NavItem to="/app/hunting" title="Threat Hunting" icon={<IconHunt className="nav-icon" />}>
            Threat Hunting
          </NavItem>
          <NavItem to="/app/fim" title="FIM" icon={<IconFim className="nav-icon" />}>
            FIM
          </NavItem>
          <NavItem to="/app/sca" title="SCA" icon={<IconSca className="nav-icon" />}>
            SCA
          </NavItem>
          <NavItem to="/app/malware" title="Malware" icon={<IconMalware className="nav-icon" />}>
            Malware
          </NavItem>
          <NavItem to="/app/mitre" title="MITRE" icon={<IconMitre className="nav-icon" />}>
            MITRE
          </NavItem>
          <NavLink
            to="/app/threat-intel"
            title="Threat Intel"
            className={() => (location.pathname.startsWith("/app/threat-intel") ? "active" : undefined)}
          >
            <span className="nav-icon-wrap">
              <IconThreatIntel className="nav-icon" />
            </span>
            <span className="nav-text">Threat Intel</span>
          </NavLink>

          <p className="nav-label">Respond</p>
          <NavItem to="/app/incidents" title="Incidents" icon={<IconIncidents className="nav-icon" />}>
            Incidents
          </NavItem>
          <NavItem to="/app/tickets" title="Tickets" icon={<IconTickets className="nav-icon" />}>
            Tickets
          </NavItem>
          <NavItem
            to="/app/response-actions"
            title="Response Actions"
            icon={<IconResponse className="nav-icon" />}
          >
            Response Actions
          </NavItem>

          <p className="nav-label">Govern</p>
          <NavItem
            to="/app/compliance"
            title="Compliance"
            icon={<IconCompliance className="nav-icon" />}
          >
            Compliance
          </NavItem>
          <NavItem to="/app/reports" title="Reports" icon={<IconReports className="nav-icon" />}>
            Reports
          </NavItem>

          <p className="nav-label">Management</p>
          {hasRole("ADMINISTRATOR") && (
            <>
              <NavItem to="/app/users" title="Users" icon={<IconUsers className="nav-icon" />}>
                Users
              </NavItem>
              <NavItem to="/app/roles" title="Roles" icon={<IconRoles className="nav-icon" />}>
                Roles
              </NavItem>
              <NavItem to="/app/audit" title="Audit" icon={<IconAudit className="nav-icon" />}>
                Audit
              </NavItem>
              <NavItem to="/app/settings" title="Settings" icon={<IconSettings className="nav-icon" />}>
                Settings
              </NavItem>
            </>
          )}
          <NavItem to="/app/profile" title="Profile" icon={<IconProfile className="nav-icon" />}>
            Profile
          </NavItem>
        </nav>

        <div className="app-sidebar-foot">
          <div className="app-user" title={user?.name || "User"}>
            <div className="app-avatar">{user?.name?.slice(0, 1)}</div>
            <div className="app-user-meta">
              <strong>{user?.name}</strong>
              <span>{user?.role === "ADMINISTRATOR" ? "Administrator" : "SOC Analyst"}</span>
            </div>
          </div>
          <button className="app-signout" type="button" onClick={onLogout} title="Sign out">
            <IconSignOut className="nav-icon" />
          </button>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <div className="app-crumb">
            <button
              className="sidebar-toggle topbar-toggle"
              type="button"
              onClick={toggleSidebar}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
            >
              <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden>
                <path
                  d="M4 7h16M4 12h16M4 17h16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            <span>Aegis</span>
            <span className="sep">/</span>
            <strong>{pageTitle}</strong>
          </div>
          <div className="app-top-actions">
            <div className="notif-wrap">
              <button
                className="icon-btn"
                type="button"
                aria-label="Notifications"
                onClick={() => {
                  setNotifOpen((v) => !v);
                  refreshNotifications();
                }}
              >
                <IconBell className="nav-icon" />
                {unread > 0 && <span className="notif-badge">{unread > 9 ? "9+" : unread}</span>}
              </button>
              {notifOpen && (
                <div className="notif-dropdown">
                  <div className="notif-head">
                    <strong>Notifications</strong>
                    <button
                      className="btn btn-ghost"
                      type="button"
                      onClick={async () => {
                        await api.markAllNotificationsRead();
                        await refreshNotifications();
                      }}
                    >
                      Mark all read
                    </button>
                  </div>
                  {notifications.length === 0 && <p className="empty">No notifications yet.</p>}
                  {notifications.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      className={`notif-item ${n.readAt ? "" : "unread"}`}
                      onClick={() => openNotification(n)}
                    >
                      <strong>{n.title}</strong>
                      <span>{n.body || new Date(n.createdAt).toLocaleString()}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="app-content">
          <Outlet />
        </main>
      </div>

      <AiAssistant />

      <style>{`
        .app-shell {
          --sidebar-w: 256px;
          height: 100vh;
          display: grid;
          grid-template-columns: var(--sidebar-w) 1fr;
          background: var(--bg1);
          overflow: hidden;
          transition: grid-template-columns 180ms ease;
        }
        .app-shell.is-collapsed { --sidebar-w: 72px; }
        .app-sidebar {
          background:
            radial-gradient(120% 60% at 0% 0%, rgba(59,130,246,0.12), transparent 55%),
            linear-gradient(180deg, var(--sidebar) 0%, var(--sidebar-2) 100%);
          color: var(--sidebar-text);
          display: flex;
          flex-direction: column;
          min-height: 0;
          border-right: 1px solid rgba(255,255,255,0.08);
          overflow: hidden;
        }
        .app-brand-row {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.75rem 0.65rem 0.75rem 0.7rem;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          flex-shrink: 0;
          min-height: 64px;
        }
        .app-brand {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          min-width: 0;
          flex: 1;
          cursor: pointer;
          padding: 0.3rem 0.35rem;
          border-radius: 10px;
        }
        .app-brand:hover { background: var(--sidebar-hover); }
        .app-brand-mark {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: grid;
          place-items: center;
          color: #fff;
          background: linear-gradient(145deg, #3b82f6, #1d4ed8);
          box-shadow: 0 6px 16px rgba(37, 99, 235, 0.35);
          flex-shrink: 0;
        }
        .app-brand-mark svg { width: 18px; height: 18px; }
        .app-brand-text {
          min-width: 0;
          overflow: hidden;
        }
        .app-brand-text strong {
          display: block;
          color: #fff;
          font-size: 1.05rem;
          font-weight: 700;
          letter-spacing: -0.02em;
          white-space: nowrap;
          line-height: 1.2;
        }
        .app-brand-text span {
          display: block;
          margin-top: 0.12rem;
          color: var(--sidebar-muted);
          font-size: 0.75rem;
          font-weight: 500;
          white-space: nowrap;
        }
        .sidebar-toggle {
          appearance: none;
          border: 0;
          background: transparent;
          color: var(--sidebar-muted);
          width: 34px;
          height: 34px;
          border-radius: 8px;
          display: grid;
          place-items: center;
          cursor: pointer;
          flex-shrink: 0;
        }
        .sidebar-toggle:hover {
          background: var(--sidebar-hover);
          color: #fff;
        }
        .sidebar-toggle .nav-icon {
          width: 16px;
          height: 16px;
          opacity: 1;
        }
        .sidebar-toggle.topbar-toggle {
          color: var(--ink-soft);
          border: 1px solid var(--line);
          background: #fff;
          width: 34px;
          height: 34px;
          margin-right: 0.35rem;
        }
        .sidebar-toggle.topbar-toggle:hover {
          background: #f8fafc;
          color: var(--ink);
        }
        .app-nav {
          flex: 1;
          overflow: auto;
          padding: 0.7rem 0.7rem 1rem;
          display: grid;
          gap: 0.18rem;
          align-content: start;
        }
        .app-nav::-webkit-scrollbar { width: 6px; }
        .app-nav::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.12);
          border-radius: 999px;
        }
        .nav-label {
          margin: 0.85rem 0 0.3rem;
          padding: 0 0.65rem;
          font-size: 0.7rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #aab4c6;
          font-weight: 700;
          white-space: nowrap;
          overflow: hidden;
        }
        .nav-label:first-child { margin-top: 0.15rem; }
        .app-nav a {
          display: flex;
          align-items: center;
          gap: 0.7rem;
          padding: 0.55rem 0.6rem;
          border-radius: 10px;
          color: var(--sidebar-text);
          font-size: 0.92rem;
          font-weight: 500;
          letter-spacing: -0.01em;
          white-space: nowrap;
          overflow: hidden;
          transition: background 120ms ease, color 120ms ease, box-shadow 120ms ease;
        }
        .app-nav a:hover {
          background: var(--sidebar-hover);
          color: #fff;
        }
        .app-nav a:hover .nav-icon-wrap {
          background: rgba(255,255,255,0.1);
          color: #fff;
        }
        .app-nav a.active {
          background: linear-gradient(90deg, rgba(59,130,246,0.28), rgba(59,130,246,0.12));
          color: #fff;
          box-shadow: inset 3px 0 0 #60a5fa;
          font-weight: 600;
        }
        .app-nav a.active .nav-icon-wrap {
          background: rgba(96,165,250,0.22);
          color: #dbeafe;
        }
        .nav-icon-wrap {
          width: 30px;
          height: 30px;
          border-radius: 8px;
          display: grid;
          place-items: center;
          background: rgba(255,255,255,0.05);
          color: #c5d0e0;
          flex-shrink: 0;
          transition: background 120ms ease, color 120ms ease;
        }
        .nav-icon {
          width: 17px;
          height: 17px;
          flex-shrink: 0;
          opacity: 1;
          display: block;
        }
        .app-sidebar-foot {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.85rem 0.85rem;
          border-top: 1px solid rgba(255,255,255,0.08);
          background: rgba(0,0,0,0.18);
          flex-shrink: 0;
          overflow: hidden;
        }
        .app-user {
          display: flex;
          align-items: center;
          gap: 0.65rem;
          min-width: 0;
          flex: 1;
        }
        .app-avatar {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          display: grid;
          place-items: center;
          background: linear-gradient(145deg, rgba(59,130,246,0.45), rgba(255,255,255,0.08));
          color: #fff;
          font-size: 0.85rem;
          font-weight: 700;
          flex-shrink: 0;
          border: 1px solid rgba(255,255,255,0.1);
        }
        .app-user-meta { min-width: 0; overflow: hidden; }
        .app-user-meta strong {
          display: block;
          color: #fff;
          font-size: 0.88rem;
          font-weight: 650;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .app-user-meta span {
          display: block;
          margin-top: 0.1rem;
          color: var(--sidebar-muted);
          font-size: 0.74rem;
          font-weight: 500;
          white-space: nowrap;
        }
        .app-signout {
          appearance: none;
          border: 0;
          background: rgba(255,255,255,0.04);
          color: var(--sidebar-muted);
          width: 34px;
          height: 34px;
          border-radius: 8px;
          display: grid;
          place-items: center;
          cursor: pointer;
          flex-shrink: 0;
        }
        .app-signout:hover {
          background: rgba(220, 38, 38, 0.18);
          color: #fca5a5;
        }
        .app-shell.is-collapsed .app-brand-text,
        .app-shell.is-collapsed .app-user-meta,
        .app-shell.is-collapsed .nav-label,
        .app-shell.is-collapsed .nav-text,
        .app-shell.is-collapsed .app-signout {
          display: none;
        }
        .app-shell.is-collapsed .app-brand-row {
          flex-direction: column;
          justify-content: center;
          gap: 0.4rem;
          padding: 0.7rem 0.4rem;
        }
        .app-shell.is-collapsed .app-brand {
          justify-content: center;
          flex: 0;
          padding: 0.15rem;
        }
        .app-shell.is-collapsed .sidebar-toggle:not(.topbar-toggle) {
          display: grid;
          width: 38px;
          height: 38px;
          color: #fff;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.14);
        }
        .app-shell.is-collapsed .sidebar-toggle:not(.topbar-toggle):hover {
          background: rgba(59, 130, 246, 0.35);
          border-color: rgba(96, 165, 250, 0.55);
        }
        .app-shell.is-collapsed .app-nav {
          padding: 0.6rem 0.45rem;
          gap: 0.28rem;
        }
        .app-shell.is-collapsed .app-nav a {
          justify-content: center;
          padding: 0.4rem;
        }
        .app-shell.is-collapsed .app-nav a.active {
          box-shadow: none;
          background: rgba(59,130,246,0.28);
        }
        .app-shell.is-collapsed .nav-icon-wrap {
          width: 34px;
          height: 34px;
        }
        .app-shell.is-collapsed .app-sidebar-foot {
          justify-content: center;
          padding: 0.75rem 0.45rem;
        }
        .app-shell.is-collapsed .app-user {
          justify-content: center;
          flex: 0;
        }
        .app-main {
          min-width: 0;
          min-height: 0;
          display: grid;
          grid-template-rows: var(--topbar-h) 1fr;
          overflow: hidden;
        }
        .app-topbar {
          height: var(--topbar-h);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          padding: 0 1.1rem;
          background: #fff;
          border-bottom: 1px solid var(--line);
        }
        .app-crumb {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.85rem;
          color: var(--muted);
        }
        .app-crumb .sep { opacity: 0.5; }
        .app-crumb strong {
          color: var(--ink);
          font-weight: 600;
        }
        .app-top-actions {
          display: flex;
          align-items: center;
          gap: 0.45rem;
        }
        .icon-btn {
          position: relative;
          appearance: none;
          border: 1px solid var(--line);
          background: #fff;
          width: 32px;
          height: 32px;
          border-radius: 6px;
          display: grid;
          place-items: center;
          cursor: pointer;
          color: var(--ink-soft);
        }
        .icon-btn:hover { background: #f8fafc; }
        .notif-badge {
          position: absolute;
          top: -5px;
          right: -5px;
          min-width: 15px;
          height: 15px;
          border-radius: 999px;
          background: var(--accent);
          color: #fff;
          font-size: 0.6rem;
          font-weight: 700;
          display: grid;
          place-items: center;
          padding: 0 3px;
        }
        .notif-wrap { position: relative; }
        .notif-dropdown {
          position: absolute;
          right: 0;
          top: calc(100% + 6px);
          width: min(340px, 90vw);
          background: #fff;
          border: 1px solid var(--line);
          border-radius: 8px;
          box-shadow: var(--shadow);
          padding: 0.55rem;
          display: grid;
          gap: 0.3rem;
          z-index: 30;
          max-height: 360px;
          overflow: auto;
        }
        .notif-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.2rem;
        }
        .notif-head .btn { min-height: 26px; padding: 0.25rem 0.5rem; font-size: 0.72rem; }
        .notif-item {
          appearance: none;
          border: 0;
          background: #f8fafc;
          border-radius: 6px;
          padding: 0.5rem 0.55rem;
          text-align: left;
          display: grid;
          gap: 0.1rem;
          cursor: pointer;
          color: var(--ink-soft);
        }
        .notif-item.unread {
          background: var(--accent-soft);
          color: var(--ink);
        }
        .notif-item span { font-size: 0.72rem; color: var(--muted); }
        .app-content {
          overflow: auto;
          padding: 1rem 1.1rem 1.25rem;
          min-height: 0;
        }
        @media (max-width: 640px) {
          .app-shell,
          .app-shell.is-collapsed {
            --sidebar-w: 100%;
            grid-template-columns: 1fr;
            height: auto;
            min-height: 100vh;
            overflow: visible;
          }
          .app-shell.is-collapsed .app-brand-text { display: block; }
          .app-shell.is-collapsed .app-user-meta { display: block; }
          .app-shell.is-collapsed .nav-label { display: block; }
          .app-shell.is-collapsed .nav-text { display: inline; }
          .app-shell.is-collapsed .app-signout { display: grid; }
          .app-shell.is-collapsed .sidebar-toggle:not(.topbar-toggle) { display: grid; }
          .app-shell.is-collapsed .app-brand-row { justify-content: flex-start; padding: 0.55rem 0.45rem 0.55rem 0.55rem; }
          .app-shell.is-collapsed .app-brand { justify-content: flex-start; flex: 1; }
          .app-shell.is-collapsed .app-nav a { justify-content: flex-start; padding: 0.42rem 0.55rem; }
          .app-shell.is-collapsed .app-sidebar-foot { justify-content: flex-start; padding: 0.7rem 0.75rem; }
          .app-main { overflow: visible; }
          .app-content { overflow: visible; }
        }
      `}</style>
    </div>
  );
}
