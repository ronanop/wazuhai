type IconProps = { className?: string };

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function IconOverview({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <rect x="3" y="3" width="8" height="8" rx="2" {...stroke} />
      <rect x="13" y="3" width="8" height="8" rx="2" {...stroke} />
      <rect x="3" y="13" width="8" height="8" rx="2" {...stroke} />
      <rect x="13" y="13" width="8" height="8" rx="2" {...stroke} />
    </svg>
  );
}

export function IconAlerts({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path d="M12 3.5 21 19.5H3L12 3.5Z" {...stroke} />
      <path d="M12 10v4" {...stroke} />
      <circle cx="12" cy="16.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconVulns({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        d="M12 3 20 6.5v5.8c0 4.6-3.2 8.2-8 9.7-4.8-1.5-8-5.1-8-9.7V6.5L12 3Z"
        {...stroke}
      />
      <path d="M9 12.2 11.1 14.3 15.2 9.8" {...stroke} />
    </svg>
  );
}

export function IconEndpoints({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <rect x="3" y="4.5" width="18" height="12" rx="2.2" {...stroke} />
      <path d="M8 20h8M12 16.5V20" {...stroke} />
    </svg>
  );
}

export function IconUsers({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <circle cx="9" cy="8.5" r="3.2" {...stroke} />
      <path d="M3.8 19c.7-3 2.8-4.6 5.2-4.6s4.5 1.6 5.2 4.6" {...stroke} />
      <circle cx="17" cy="9" r="2.4" {...stroke} />
      <path d="M15.4 14.6c1.9.3 3.5 1.4 4.3 3.4" {...stroke} />
    </svg>
  );
}

export function IconProfile({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="8.5" r="3.5" {...stroke} />
      <path d="M5.5 19.5c1.1-3.4 3.5-5 6.5-5s5.4 1.6 6.5 5" {...stroke} />
    </svg>
  );
}

export function IconSignOut({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path d="M10 4.5H7A2.5 2.5 0 0 0 4.5 7v10A2.5 2.5 0 0 0 7 19.5h3" {...stroke} />
      <path d="M14 8.5 18.5 12 14 15.5M18.2 12H10" {...stroke} />
    </svg>
  );
}

export function IconHunt({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <circle cx="11" cy="11" r="6.2" {...stroke} />
      <path d="M16 16.2 20.5 20.7" {...stroke} />
    </svg>
  );
}

export function IconFim({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        d="M5 7.5h7.2L14.5 10H19a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 19 20H5a1.5 1.5 0 0 1-1.5-1.5v-11A1.5 1.5 0 0 1 5 7.5Z"
        {...stroke}
      />
      <path d="M8.5 14h7M8.5 17h4.5" {...stroke} />
    </svg>
  );
}

export function IconSca({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path d="M8 6.5h12M8 12h12M8 17.5h7" {...stroke} />
      <path d="M4 6.5h.01M4 12h.01M4 17.5h.01" {...stroke} />
      <path d="M16.2 16 18 17.8 21 14.5" {...stroke} />
    </svg>
  );
}

export function IconMalware({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="4.5" {...stroke} />
      <path
        d="M12 3v2.3M12 18.7V21M3 12h2.3M18.7 12H21M5.8 5.8l1.7 1.7M16.5 16.5l1.7 1.7M18.2 5.8l-1.7 1.7M7.5 16.5l-1.7 1.7"
        {...stroke}
      />
    </svg>
  );
}

export function IconMitre({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" {...stroke} />
      <path d="M3.5 9.5h17M3.5 14.5h17M9.5 4.5v15M14.5 4.5v15" {...stroke} />
    </svg>
  );
}

export function IconThreatIntel({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="8.2" {...stroke} />
      <path d="M3.8 12h16.4M12 3.8c2.4 2.6 3.6 5.4 3.6 8.2S14.4 17.6 12 20.2C9.6 17.6 8.4 14.8 8.4 12S9.6 6.4 12 3.8Z" {...stroke} />
      <circle cx="12" cy="12" r="2.2" {...stroke} />
    </svg>
  );
}

export function IconIncidents({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        d="M12 8.5v4M12 15.8h.01M10.3 4.8 3.6 17.2a2 2 0 0 0 1.8 2.9h13.2a2 2 0 0 0 1.8-2.9L13.7 4.8a2 2 0 0 0-3.4 0Z"
        {...stroke}
      />
    </svg>
  );
}

export function IconTickets({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        d="M4.5 8h15v2.2a2.2 2.2 0 0 0 0 4.4V17h-15v-2.4a2.2 2.2 0 0 0 0-4.4V8Z"
        {...stroke}
      />
      <path d="M12 8v9" strokeDasharray="2.2 2.4" {...stroke} />
    </svg>
  );
}

export function IconAudit({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        d="M8 4.5h8.5L19 7.5v12a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 19.5v-13A2 2 0 0 1 8 4.5Z"
        {...stroke}
      />
      <path d="M9.5 10.5h5M9.5 14h5M9.5 17.5h3" {...stroke} />
    </svg>
  );
}

export function IconBell({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        d="M6 17.5h12l-1.3-1.6V10a4.7 4.7 0 1 0-9.4 0v5.9L6 17.5Z"
        {...stroke}
      />
      <path d="M10 19.2a2 2 0 0 0 4 0" {...stroke} />
    </svg>
  );
}

export function IconCompliance({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        d="M8 4.5h8l2.5 2.5V19a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 19V6A1.5 1.5 0 0 1 8 4.5Z"
        {...stroke}
      />
      <path d="M9.5 12.2 11.2 14 14.8 10" {...stroke} />
    </svg>
  );
}

export function IconReports({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path d="M5 19.5V10M10.5 19.5V5.5M16 19.5v-7M21 19.5V8.5" {...stroke} />
      <path d="M3.5 19.5h19" {...stroke} />
    </svg>
  );
}

export function IconSettings({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="3.2" {...stroke} />
      <path
        d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6.1 6.1l1.4 1.4M16.5 16.5l1.4 1.4M17.9 6.1l-1.4 1.4M7.5 16.5l-1.4 1.4"
        {...stroke}
      />
    </svg>
  );
}

export function IconResponse({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path d="M4.5 12h11.5M12.5 7.5 17.5 12l-5 4.5" {...stroke} />
      <path d="M4.5 5v14" {...stroke} />
    </svg>
  );
}

export function IconRoles({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="8" r="3.2" {...stroke} />
      <path d="M6 19c1-3.2 3.2-4.8 6-4.8s5 1.6 6 4.8" {...stroke} />
      <path d="M17.5 8.2h3M19 6.7v3" {...stroke} />
    </svg>
  );
}
