import { NavLink, Outlet, useLocation } from "react-router-dom";
import "../../styles/soc.css";

const TI_SECTIONS: Array<{ to: string; label: string; end?: boolean }> = [
  { to: "/app/threat-intel", label: "Overview", end: true },
  { to: "/app/threat-intel/intrusion-sets", label: "Intrusion sets" },
  { to: "/app/threat-intel/malware", label: "Malware" },
  { to: "/app/threat-intel/indicators", label: "Indicators" },
  { to: "/app/threat-intel/attack-patterns", label: "Attack patterns" },
  { to: "/app/threat-intel/campaigns", label: "Campaigns" },
  { to: "/app/threat-intel/tools", label: "Tools" },
  { to: "/app/threat-intel/vulnerabilities", label: "Vulnerabilities" },
  { to: "/app/threat-intel/reports", label: "Reports" },
  { to: "/app/threat-intel/attack-coverage", label: "ATT&CK" },
  { to: "/app/threat-intel/cases", label: "Cases" },
];

export function ThreatIntelLayout() {
  const location = useLocation();

  return (
    <div className="ti-workspace">
      <nav className="ti-subnav" aria-label="Threat Intel sections">
        {TI_SECTIONS.map((item) => {
          const active = item.end
            ? location.pathname === item.to
            : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={() => `ti-subnav-link${active ? " active" : ""}`}
            >
              {item.label}
            </NavLink>
          );
        })}
      </nav>
      <Outlet />
      <style>{`
        .ti-workspace {
          display: grid;
          gap: 0.85rem;
          min-width: 0;
        }
        .ti-subnav {
          display: flex;
          flex-wrap: nowrap;
          gap: 0.25rem;
          padding: 0.3rem;
          background: var(--surface-solid);
          border: 1px solid var(--line);
          border-radius: var(--radius);
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: thin;
        }
        .ti-subnav::-webkit-scrollbar { height: 4px; }
        .ti-subnav::-webkit-scrollbar-thumb {
          background: rgba(15, 23, 42, 0.15);
          border-radius: 999px;
        }
        .ti-subnav-link {
          flex: 0 0 auto;
          text-decoration: none;
          color: var(--muted);
          font-size: 0.76rem;
          font-weight: 600;
          padding: 0.4rem 0.7rem;
          border-radius: 8px;
          border: 1px solid transparent;
          white-space: nowrap;
          line-height: 1.2;
        }
        .ti-subnav-link:hover {
          color: var(--ink);
          background: #f1f5f9;
        }
        .ti-subnav-link.active {
          color: var(--accent);
          background: var(--accent-soft);
          border-color: rgba(37, 99, 235, 0.16);
        }
      `}</style>
    </div>
  );
}
