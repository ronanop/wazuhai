export type PlaybookSeed = {
  key: string;
  name: string;
  description: string;
  category: string;
  actionType: "create_ticket" | "update_incident_status" | "wazuh_active_response" | "recommend_only";
  command: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  requiresApproval: boolean;
};

export const PLAYBOOK_CATALOG: PlaybookSeed[] = [
  {
    key: "create_followup_ticket",
    name: "Create follow-up ticket",
    description: "Open a ticket linked to the current incident or alert for tracking remediation work.",
    category: "workflow",
    actionType: "create_ticket",
    command: "",
    riskLevel: "low",
    requiresApproval: false,
  },
  {
    key: "mark_investigating",
    name: "Mark incident investigating",
    description: "Update the linked incident status to INVESTIGATING.",
    category: "workflow",
    actionType: "update_incident_status",
    command: "INVESTIGATING",
    riskLevel: "low",
    requiresApproval: false,
  },
  {
    key: "mark_contained",
    name: "Mark incident contained",
    description: "Update the linked incident status to CONTAINED after containment steps.",
    category: "workflow",
    actionType: "update_incident_status",
    command: "CONTAINED",
    riskLevel: "medium",
    requiresApproval: true,
  },
  {
    key: "recommend_isolate_host",
    name: "Recommend host isolation",
    description: "Recommend isolating the affected host. Does not execute network changes.",
    category: "containment",
    actionType: "recommend_only",
    command: "",
    riskLevel: "high",
    requiresApproval: true,
  },
  {
    key: "recommend_block_ioc",
    name: "Recommend IOC block",
    description: "Recommend blocking an indicator (IP/hash/domain). Recommendation only until firewall automation is approved.",
    category: "containment",
    actionType: "recommend_only",
    command: "",
    riskLevel: "high",
    requiresApproval: true,
  },
  {
    key: "ar_restart_wazuh",
    name: "Restart Wazuh agent",
    description: "Run Wazuh active response restart-wazuh on the target agent (requires AR enabled + approval).",
    category: "active_response",
    actionType: "wazuh_active_response",
    command: "restart-wazuh",
    riskLevel: "medium",
    requiresApproval: true,
  },
  {
    key: "ar_firewall_drop",
    name: "Firewall drop (active response)",
    description: "Run Wazuh firewall-drop active response against a source IP on the target agent.",
    category: "active_response",
    actionType: "wazuh_active_response",
    command: "firewall-drop",
    riskLevel: "critical",
    requiresApproval: true,
  },
];
