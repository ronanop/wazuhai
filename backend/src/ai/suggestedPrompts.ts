export function suggestedPromptsForPage(page?: string, selectedType?: string) {
  const p = page || "";
  if (selectedType === "incident" || p.includes("/incidents")) {
    return [
      "Summarize this incident with evidence citations",
      "What related alerts and vulnerabilities should I check?",
      "Which playbooks are appropriate and why?",
    ];
  }
  if (selectedType === "alert" || p.includes("/alerts") || p.includes("/malware")) {
    return [
      "Explain this alert using only retrieved evidence",
      "Is this likely true positive or noise?",
      "What containment steps would you recommend?",
    ];
  }
  if (selectedType === "vulnerability" || p.includes("/vulnerabilities")) {
    return [
      "How severe is this vulnerability on this host?",
      "What packages and agents are affected?",
      "Recommend a remediation ticket outline",
    ];
  }
  if (selectedType === "ticket" || p.includes("/tickets")) {
    return [
      "Summarize ticket status and linked evidence",
      "What is blocking closure?",
    ];
  }
  if (p.includes("/compliance")) {
    return [
      "Which controls have the strongest evidence gaps?",
      "Summarize PCI DSS evidence available right now",
    ];
  }
  if (p.includes("/mitre")) {
    return ["Which MITRE techniques appear most in recent alerts?"];
  }
  return [
    "What is our current open incident and ticket load?",
    "Show the highest severity recent alerts with citations",
    "Any critical vulnerabilities worth escalating?",
  ];
}
