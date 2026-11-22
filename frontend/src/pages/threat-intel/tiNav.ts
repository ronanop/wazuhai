export const TI_ENTITY_SLUGS = [
  "intrusion-sets",
  "malware",
  "indicators",
  "attack-patterns",
  "campaigns",
  "tools",
  "vulnerabilities",
  "reports",
] as const;

export type TiEntitySlug = (typeof TI_ENTITY_SLUGS)[number];

export const TI_NAV: Array<{ to: string; label: string }> = [
  { to: "/app/threat-intel", label: "Dashboard" },
  { to: "/app/threat-intel/intrusion-sets", label: "Intrusion sets" },
  { to: "/app/threat-intel/malware", label: "Malware" },
  { to: "/app/threat-intel/indicators", label: "Indicators" },
  { to: "/app/threat-intel/attack-patterns", label: "Attack patterns" },
  { to: "/app/threat-intel/campaigns", label: "Campaigns" },
  { to: "/app/threat-intel/tools", label: "Tools" },
  { to: "/app/threat-intel/vulnerabilities", label: "Vulnerabilities" },
  { to: "/app/threat-intel/reports", label: "Reports" },
  { to: "/app/threat-intel/attack-coverage", label: "ATT&CK coverage" },
  { to: "/app/threat-intel/cases", label: "Cases" },
];

export function isTiEntitySlug(value: string): value is TiEntitySlug {
  return (TI_ENTITY_SLUGS as readonly string[]).includes(value);
}

export function entityDetailPath(slug: string, id: string) {
  return `/app/threat-intel/${slug}/${encodeURIComponent(id)}`;
}
