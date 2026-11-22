export const PLATFORM_MODULES = [
  "overview",
  "alerts",
  "endpoints",
  "vulnerabilities",
  "hunting",
  "fim",
  "sca",
  "malware",
  "mitre",
  "threat_intel",
  "incidents",
  "tickets",
  "response_actions",
  "compliance",
  "reports",
  "users",
  "roles",
  "settings",
  "audit",
  "notifications",
] as const;

export type PlatformModule = (typeof PLATFORM_MODULES)[number];

export function defaultPermissionsForRole(role: "ADMINISTRATOR" | "SOC_ANALYST") {
  return PLATFORM_MODULES.map((module) => {
    if (role === "ADMINISTRATOR") {
      return {
        role,
        module,
        canView: true,
        canCreate: true,
        canUpdate: true,
        canExport: true,
        canAdmin: ["users", "roles", "settings", "audit"].includes(module),
      };
    }
    const adminOnly = ["users", "roles", "settings", "audit"].includes(module);
    return {
      role,
      module,
      canView: !adminOnly,
      canCreate: !adminOnly && ["incidents", "tickets", "hunting", "response_actions"].includes(module),
      canUpdate: !adminOnly && ["incidents", "tickets", "alerts"].includes(module),
      canExport: !adminOnly,
      canAdmin: false,
    };
  });
}
