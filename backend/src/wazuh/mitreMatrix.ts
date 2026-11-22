/** Compact ATT&CK Enterprise subset for coverage visualization. */
export type MitreTechnique = {
  id: string;
  name: string;
  tactic: string;
};

export const MITRE_TECHNIQUES: MitreTechnique[] = [
  { id: "T1078", name: "Valid Accounts", tactic: "Initial Access" },
  { id: "T1133", name: "External Remote Services", tactic: "Initial Access" },
  { id: "T1190", name: "Exploit Public-Facing Application", tactic: "Initial Access" },
  { id: "T1059", name: "Command and Scripting Interpreter", tactic: "Execution" },
  { id: "T1053", name: "Scheduled Task/Job", tactic: "Execution" },
  { id: "T1204", name: "User Execution", tactic: "Execution" },
  { id: "T1548", name: "Abuse Elevation Control Mechanism", tactic: "Privilege Escalation" },
  { id: "T1548.003", name: "Sudo and Sudo Caching", tactic: "Privilege Escalation" },
  { id: "T1543", name: "Create or Modify System Process", tactic: "Persistence" },
  { id: "T1136", name: "Create Account", tactic: "Persistence" },
  { id: "T1098", name: "Account Manipulation", tactic: "Persistence" },
  { id: "T1027", name: "Obfuscated Files or Information", tactic: "Defense Evasion" },
  { id: "T1562", name: "Impair Defenses", tactic: "Defense Evasion" },
  { id: "T1562.001", name: "Disable or Modify Tools", tactic: "Defense Evasion" },
  { id: "T1070", name: "Indicator Removal", tactic: "Defense Evasion" },
  { id: "T1003", name: "OS Credential Dumping", tactic: "Credential Access" },
  { id: "T1110", name: "Brute Force", tactic: "Credential Access" },
  { id: "T1087", name: "Account Discovery", tactic: "Discovery" },
  { id: "T1082", name: "System Information Discovery", tactic: "Discovery" },
  { id: "T1057", name: "Process Discovery", tactic: "Discovery" },
  { id: "T1021", name: "Remote Services", tactic: "Lateral Movement" },
  { id: "T1083", name: "File and Directory Discovery", tactic: "Discovery" },
  { id: "T1041", name: "Exfiltration Over C2 Channel", tactic: "Exfiltration" },
  { id: "T1486", name: "Data Encrypted for Impact", tactic: "Impact" },
  { id: "T1490", name: "Inhibit System Recovery", tactic: "Impact" },
];

export const MITRE_TACTICS = [
  "Initial Access",
  "Execution",
  "Persistence",
  "Privilege Escalation",
  "Defense Evasion",
  "Credential Access",
  "Discovery",
  "Lateral Movement",
  "Exfiltration",
  "Impact",
];
