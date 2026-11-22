export type FrameworkId = "pci_dss" | "hipaa" | "nist" | "gdpr" | "tsc" | "iso27001";

export type FrameworkDef = {
  id: FrameworkId;
  name: string;
  shortName: string;
  description: string;
  /** OpenSearch field on alerts */
  alertField: string;
  /** Optional SCA nested field (may be comma-joined values) */
  scaField?: string;
  disclaimer: string;
};

export const FRAMEWORKS: FrameworkDef[] = [
  {
    id: "pci_dss",
    name: "PCI DSS",
    shortName: "PCI DSS",
    description: "Payment Card Industry Data Security Standard — evidence from Wazuh rule mappings.",
    alertField: "rule.pci_dss",
    scaField: "data.sca.check.compliance.pci_dss",
    disclaimer: "Evidence-based view only. Not a PCI certification.",
  },
  {
    id: "hipaa",
    name: "HIPAA",
    shortName: "HIPAA",
    description: "Health Insurance Portability and Accountability Act — security rule mappings.",
    alertField: "rule.hipaa",
    scaField: "data.sca.check.compliance.hipaa",
    disclaimer: "Evidence-based view only. Not a HIPAA compliance attestation.",
  },
  {
    id: "nist",
    name: "NIST 800-53",
    shortName: "NIST",
    description: "NIST SP 800-53 control families mapped from Wazuh detections.",
    alertField: "rule.nist_800_53",
    scaField: "data.sca.check.compliance.nist_800_53",
    disclaimer: "Evidence-based view only. Not a NIST assessment certification.",
  },
  {
    id: "gdpr",
    name: "GDPR",
    shortName: "GDPR",
    description: "General Data Protection Regulation articles referenced by Wazuh rules.",
    alertField: "rule.gdpr",
    scaField: "data.sca.check.compliance.gdpr_IV",
    disclaimer: "Evidence-based view only. Not a GDPR compliance certificate.",
  },
  {
    id: "tsc",
    name: "SOC 2 / Trust Services Criteria",
    shortName: "SOC 2 / TSC",
    description: "AICPA Trust Services Criteria mapped from Wazuh telemetry.",
    alertField: "rule.tsc",
    scaField: "data.sca.check.compliance.tsc",
    disclaimer: "Evidence-based view only. Not a SOC 2 audit opinion.",
  },
  {
    id: "iso27001",
    name: "ISO 27001",
    shortName: "ISO 27001",
    description:
      "Limited coverage via overlapping Wazuh mappings. Prefer PCI/NIST/TSC for denser evidence in this lab.",
    alertField: "rule.gpg13",
    disclaimer: "Limited / indirect mapping only. Not an ISO 27001 certification.",
  },
];

export function getFramework(id: string): FrameworkDef | undefined {
  return FRAMEWORKS.find((f) => f.id === id);
}
