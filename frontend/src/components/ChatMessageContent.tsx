import type { ReactNode } from "react";
import { DataView } from "./DataView";
import { tryParseJson } from "../lib/jsonTable";

type Props = {
  content: string;
  variant?: "user" | "assistant";
};

/** Lightweight markdown-ish renderer for assistant/user chat bubbles (no extra deps). */
export function ChatMessageContent({ content, variant = "assistant" }: Props) {
  const blocks = parseBlocks(content.trim());

  return (
    <div className={`chat-md chat-md-${variant}`}>
      {blocks.map((block, i) => {
        if (block.type === "code") {
          const parsed = tryParseJson(block.text);
          if (parsed !== undefined && (typeof parsed === "object" || Array.isArray(parsed))) {
            return (
              <div key={i} className="chat-md-dataview">
                <DataView data={parsed} defaultMode="table" maxHeight="320px" />
              </div>
            );
          }
          return (
            <pre key={i} className="chat-md-code">
              <code>{block.text}</code>
            </pre>
          );
        }
        if (block.type === "ul") {
          return (
            <ul key={i} className="chat-md-list">
              {block.items.map((item, j) => (
                <li key={j}>{renderInline(item)}</li>
              ))}
            </ul>
          );
        }
        if (block.type === "ol") {
          return (
            <ol key={i} className="chat-md-list">
              {block.items.map((item, j) => (
                <li key={j}>{renderInline(item)}</li>
              ))}
            </ol>
          );
        }
        if (block.type === "heading") {
          const Tag = block.level <= 2 ? "h4" : "h5";
          return (
            <Tag key={i} className="chat-md-h">
              {renderInline(block.text)}
            </Tag>
          );
        }
        if (block.type === "callout") {
          return (
            <div key={i} className={`chat-md-callout ${block.kind}`}>
              <span className="chat-md-callout-label">{block.label}</span>
              <div className="chat-md-callout-body">{renderInline(block.text)}</div>
            </div>
          );
        }
        return (
          <p key={i} className="chat-md-p">
            {renderInline(block.text)}
          </p>
        );
      })}

      <style>{`
        .chat-md {
          display: grid;
          gap: 0.55rem;
          overflow-wrap: anywhere;
          word-break: break-word;
        }
        .chat-md-p {
          margin: 0;
          white-space: pre-wrap;
        }
        .chat-md-h {
          margin: 0.15rem 0 0;
          font-size: 0.9rem;
          font-weight: 700;
          letter-spacing: -0.01em;
          line-height: 1.35;
        }
        .chat-md-list {
          margin: 0;
          padding-left: 1.15rem;
          display: grid;
          gap: 0.28rem;
        }
        .chat-md-list li {
          padding-left: 0.1rem;
          line-height: 1.45;
        }
        .chat-md-code {
          margin: 0;
          padding: 0.65rem 0.75rem;
          border-radius: 10px;
          background: #0f172a;
          color: #e2e8f0;
          font-size: 0.75rem;
          line-height: 1.45;
          overflow-x: auto;
          white-space: pre;
        }
        .chat-md-user .chat-md-code {
          background: rgba(0,0,0,0.22);
          color: #eff6ff;
        }
        .chat-md-callout {
          border-radius: 10px;
          padding: 0.55rem 0.7rem;
          display: grid;
          gap: 0.2rem;
          border: 1px solid transparent;
        }
        .chat-md-callout-label {
          font-size: 0.65rem;
          font-weight: 750;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .chat-md-callout.evidence {
          background: #f0fdf4;
          border-color: #bbf7d0;
        }
        .chat-md-callout.evidence .chat-md-callout-label { color: #15803d; }
        .chat-md-callout.interpretation {
          background: #eff6ff;
          border-color: #bfdbfe;
        }
        .chat-md-callout.interpretation .chat-md-callout-label { color: #1d4ed8; }
        .chat-md-callout.warning {
          background: #fffbeb;
          border-color: #fde68a;
        }
        .chat-md-callout.warning .chat-md-callout-label { color: #b45309; }
        .chat-md strong { font-weight: 700; }
        .chat-md em { font-style: italic; }
        .chat-md-inline-code {
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 0.78em;
          padding: 0.08rem 0.32rem;
          border-radius: 5px;
          background: rgba(15, 23, 42, 0.06);
        }
        .chat-md-user .chat-md-inline-code {
          background: rgba(255,255,255,0.18);
        }
        .chat-md-user .chat-md-callout {
          background: rgba(255,255,255,0.12);
          border-color: rgba(255,255,255,0.18);
        }
        .chat-md-user .chat-md-callout-label { color: #dbeafe; }
        .chat-md-dataview {
          border-radius: 10px;
          border: 1px solid rgba(15, 23, 42, 0.08);
          background: #fff;
          padding: 0.55rem;
        }
        .chat-md-user .chat-md-dataview {
          background: rgba(255,255,255,0.1);
          border-color: rgba(255,255,255,0.18);
        }
      `}</style>
    </div>
  );
}

type Block =
  | { type: "p"; text: string }
  | { type: "heading"; level: number; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "code"; text: string }
  | { type: "callout"; kind: "evidence" | "interpretation" | "warning"; label: string; text: string };

function parseBlocks(content: string): Block[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i += 1;
      continue;
    }

    if (line.trim().startsWith("```")) {
      const buf: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        buf.push(lines[i]);
        i += 1;
      }
      i += 1;
      blocks.push({ type: "code", text: buf.join("\n") });
      continue;
    }

    const heading = /^(#{1,4})\s+(.+)$/.exec(line.trim());
    if (heading) {
      blocks.push({ type: "heading", level: heading[1].length, text: heading[2] });
      i += 1;
      continue;
    }

    const callout = /^(Evidence|Interpretation|Warning|Note)\s*:\s*(.*)$/i.exec(line.trim());
    if (callout) {
      const label = callout[1];
      const kind =
        /^evidence$/i.test(label) ? "evidence" : /^interpretation$/i.test(label) ? "interpretation" : "warning";
      const parts = [callout[2]];
      i += 1;
      while (i < lines.length) {
        const next = lines[i];
        if (next.trim() === "") break;
        if (/^(Evidence|Interpretation|Warning|Note)\s*:/i.test(next.trim())) break;
        if (/^#{1,4}\s+/.test(next.trim())) break;
        if (/^[-*•]\s+/.test(next.trim())) break;
        if (/^\d+\.\s+/.test(next.trim())) break;
        if (next.trim().startsWith("```")) break;
        parts.push(next.trim());
        i += 1;
      }
      blocks.push({ type: "callout", kind, label, text: parts.filter(Boolean).join(" ") });
      continue;
    }

    if (/^[-*•]\s+/.test(line.trim())) {
      const items: string[] = [];
      while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*•]\s+/, ""));
        i += 1;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    if (/^\d+\.\s+/.test(line.trim())) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
        i += 1;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    const parts = [line];
    i += 1;
    while (i < lines.length) {
      const next = lines[i];
      if (next.trim() === "") break;
      if (/^(#{1,4})\s+/.test(next.trim())) break;
      if (/^(Evidence|Interpretation|Warning|Note)\s*:/i.test(next.trim())) break;
      if (/^[-*•]\s+/.test(next.trim())) break;
      if (/^\d+\.\s+/.test(next.trim())) break;
      if (next.trim().startsWith("```")) break;
      parts.push(next);
      i += 1;
    }
    blocks.push({ type: "p", text: parts.join("\n").trim() });
  }

  return blocks.length ? blocks : [{ type: "p", text: content }];
}

function renderInline(text: string) {
  const nodes: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith("**")) {
      nodes.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`")) {
      nodes.push(
        <code key={key++} className="chat-md-inline-code">
          {token.slice(1, -1)}
        </code>,
      );
    } else {
      nodes.push(<em key={key++}>{token.slice(1, -1)}</em>);
    }
    last = match.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}
