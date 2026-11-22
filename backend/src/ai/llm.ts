import type { ChatbotSettings } from "@prisma/client";
import type { EvidencePack } from "./retrieveEvidence.js";

export async function generateGroundedAnswer(input: {
  settings: ChatbotSettings;
  question: string;
  evidence: EvidencePack;
  userRole: string;
}) {
  const { settings, question, evidence, userRole } = input;

  if (!settings.apiKey?.trim()) {
    return {
      mode: "deterministic" as const,
      content: deterministicAnswer(question, evidence),
      model: "deterministic-evidence",
    };
  }

  const userPayload = [
    `User role: ${userRole}`,
    `Current page: ${evidence.page}`,
    `Grounding enabled: ${settings.groundingEnabled}`,
    `Require citations: ${settings.requireCitations}`,
    `Refuse if no evidence: ${settings.refuseIfNoEvidence}`,
    "",
    "Evidence Pack (JSON):",
    JSON.stringify(
      {
        retrievedAt: evidence.retrievedAt,
        selected: evidence.selected,
        sources: evidence.sources,
        items: evidence.items,
      },
      null,
      2,
    ),
    "",
    `User question: ${question}`,
  ].join("\n");

  const base = settings.apiBaseUrl.replace(/\/$/, "");
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey.trim()}`,
    },
    body: JSON.stringify({
      model: settings.model,
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
      messages: [
        { role: "system", content: settings.systemPrompt },
        { role: "user", content: userPayload },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LLM request failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    model?: string;
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("LLM returned empty content");

  return {
    mode: "llm" as const,
    content,
    model: data.model || settings.model,
  };
}

function deterministicAnswer(question: string, evidence: EvidencePack) {
  const lines: string[] = [];
  lines.push("Evidence: LLM API key is not configured, so this answer is a deterministic summary of retrieved platform evidence only.");
  lines.push("");
  lines.push(`Question: ${question}`);
  lines.push(`Page context: ${evidence.page}`);
  lines.push("");
  lines.push("Sources used:");
  for (const s of evidence.sources.slice(0, 12)) {
    lines.push(`- [${s.kind}] ${s.id} — ${s.label}`);
  }
  if (!evidence.sources.length) {
    lines.push("- none");
    lines.push("");
    lines.push("I don't have enough evidence in the current data to answer that.");
    return lines.join("\n");
  }

  if (evidence.items.selectedAlert) {
    const a = evidence.items.selectedAlert as Record<string, unknown>;
    lines.push("");
    lines.push("Evidence: Selected alert");
    lines.push(`- Rule: ${a.ruleDescription} (#${a.ruleId})`);
    lines.push(`- Severity: ${a.severity} / level ${a.level}`);
    lines.push(`- Agent: ${a.agentName}`);
    lines.push(`- Time: ${a.timestamp}`);
  }

  if (evidence.items.selectedVulnerability) {
    const v = evidence.items.selectedVulnerability as Record<string, unknown>;
    lines.push("");
    lines.push("Evidence: Selected vulnerability");
    lines.push(`- CVE: ${v.cve}`);
    lines.push(`- Severity: ${v.severity}`);
    lines.push(`- Package: ${v.packageName} ${v.packageVersion}`);
    lines.push(`- Agent: ${v.agentName}`);
  }

  if (evidence.items.opsSnapshot) {
    const o = evidence.items.opsSnapshot as Record<string, unknown>;
    lines.push("");
    lines.push("Evidence: Ops snapshot");
    lines.push(`- Open incidents: ${o.openIncidents}`);
    lines.push(`- Open tickets: ${o.openTickets}`);
  }

  lines.push("");
  lines.push(
    "Interpretation: Configure an API key under Application Settings → Chatbot to enable full natural-language grounded answers. Until then, only evidence summaries are returned.",
  );
  return lines.join("\n");
}
