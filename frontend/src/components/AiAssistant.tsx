import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useLocation } from "react-router-dom";
import { api } from "../api/client";
import { useChatAssistant } from "../ai/ChatContext";
import { ChatMessageContent } from "./ChatMessageContent";

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
  sources?: Array<{ kind: string; id: string; label: string }>;
  mode?: string;
};

export function AiAssistant() {
  const location = useLocation();
  const { open, setOpen, selection, setSelection, draftPrompt, clearDraft } = useChatAssistant();
  const [minimized, setMinimized] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [lastMode, setLastMode] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ model?: string; grounding?: boolean; keyOk?: boolean }>({});
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    api
      .chatbotPublicSettings()
      .then((res) => {
        setEnabled(res.settings.enabled);
        setMeta({
          model: res.settings.model,
          grounding: res.settings.groundingEnabled,
          keyOk: res.settings.apiKeyConfigured,
        });
      })
      .catch(() => undefined);
    api
      .chatHistory()
      .then((res) => {
        setMessages(
          res.messages.map((m) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
            createdAt: m.createdAt,
            sources: (m.evidence as { sources?: Msg["sources"]; mode?: string } | null)?.sources,
            mode: (m.evidence as { mode?: string } | null)?.mode,
          })),
        );
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    api
      .chatSuggestions(location.pathname, selection?.type)
      .then((res) => setSuggestions(res.prompts))
      .catch(() => setSuggestions([]));
  }, [location.pathname, selection?.type]);

  useEffect(() => {
    if (draftPrompt && open) {
      setInput(draftPrompt);
      clearDraft();
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [draftPrompt, open, clearDraft]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open, loading]);

  useEffect(() => {
    if (open && !minimized) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open, minimized]);

  if (!enabled) return null;

  async function onSend(e?: FormEvent, override?: string) {
    e?.preventDefault();
    const text = (override ?? input).trim();
    if (!text || loading) return;
    setInput("");
    setError(null);
    setLoading(true);
    const tempId = `local-${Date.now()}`;
    setMessages((prev) => [...prev, { id: tempId, role: "user", content: text }]);

    try {
      const res = await api.chat({
        message: text,
        page: location.pathname,
        selected: selection
          ? {
              type: selection.type,
              id: selection.id,
              title: selection.title,
              meta: selection.meta,
            }
          : undefined,
      });
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempId),
        { id: `u-${tempId}`, role: "user", content: text },
        {
          id: res.message.id,
          role: "assistant",
          content: res.message.content,
          createdAt: res.message.createdAt,
          sources: res.evidence?.sources,
          mode: res.mode,
        },
      ]);
      setLastMode(res.mode);
      if (res.model) setMeta((m) => ({ ...m, model: res.model }));
      if (res.suggestions?.length) setSuggestions(res.suggestions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chat failed");
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void onSend();
    }
  }

  const pageLabel = location.pathname.replace(/^\/app\/?/, "") || "overview";
  const showEmpty = messages.length === 0 && !loading;

  return (
    <div className="ai-root">
      {!open && (
        <button className="ai-fab" type="button" onClick={() => setOpen(true)} aria-label="Open AI assistant">
          <svg viewBox="0 0 24 24" aria-hidden>
            <path
              d="M12 3.5 13.8 9.2 19.5 11 13.8 12.8 12 18.5 10.2 12.8 4.5 11 10.2 9.2 12 3.5Z"
              fill="currentColor"
            />
            <path d="M18.5 4.5v3M17 6h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />
          </svg>
        </button>
      )}

      {open && (
        <section className={`ai-panel ${minimized ? "is-min" : ""}`} aria-label="Aegis AI assistant">
          <header className="ai-head">
            <div className="ai-brand">
              <div className="ai-avatar" aria-hidden>
                <svg viewBox="0 0 24 24">
                  <path
                    d="M12 3.5 13.8 9.2 19.5 11 13.8 12.8 12 18.5 10.2 12.8 4.5 11 10.2 9.2 12 3.5Z"
                    fill="currentColor"
                  />
                </svg>
              </div>
              <div className="ai-titles">
                <strong>Aegis Assistant</strong>
                <div className="ai-status-row">
                  <span className={`ai-pill ${meta.grounding ? "ok" : ""}`}>
                    {meta.grounding ? "Grounded" : "No grounding"}
                  </span>
                  <span className="ai-pill muted" title={meta.model || "model"}>
                    {shortModel(meta.model)}
                  </span>
                  {lastMode && <span className="ai-pill soft">{lastMode}</span>}
                </div>
              </div>
            </div>
            <div className="ai-toolbar">
              <button
                type="button"
                className="ai-icon-btn"
                title={minimized ? "Expand" : "Minimize"}
                aria-label={minimized ? "Expand" : "Minimize"}
                onClick={() => setMinimized((v) => !v)}
              >
                {minimized ? (
                  <svg viewBox="0 0 24 24" aria-hidden>
                    <path d="M6 14h12M12 8v12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" aria-hidden>
                    <path d="M6 12h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
                  </svg>
                )}
              </button>
              <button
                type="button"
                className="ai-icon-btn"
                title="Clear chat"
                aria-label="Clear chat"
                onClick={async () => {
                  await api.clearChatHistory();
                  setMessages([]);
                  setLastMode(null);
                  setError(null);
                }}
              >
                <svg viewBox="0 0 24 24" aria-hidden>
                  <path
                    d="M8 8h8v11a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V8Z"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    fill="none"
                  />
                  <path d="M6 8h12M10 5.5h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" fill="none" />
                </svg>
              </button>
              <button
                type="button"
                className="ai-icon-btn danger"
                title="Close"
                aria-label="Close assistant"
                onClick={() => setOpen(false)}
              >
                <svg viewBox="0 0 24 24" aria-hidden>
                  <path d="M7 7l10 10M17 7 7 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
                </svg>
              </button>
            </div>
          </header>

          {!minimized && (
            <>
              {selection && (
                <div className="ai-context">
                  <div className="ai-context-main">
                    <span className="ai-context-kicker">Pinned context</span>
                    <strong>
                      {selection.type}
                      <span className="ai-dot">·</span>
                      {selection.title || selection.id}
                    </strong>
                  </div>
                  <button type="button" className="ai-link-btn" onClick={() => setSelection(null)}>
                    Remove
                  </button>
                </div>
              )}

              <div className="ai-body">
                {showEmpty && (
                  <div className="ai-empty">
                    <div className="ai-empty-icon" aria-hidden>
                      <svg viewBox="0 0 24 24">
                        <path
                          d="M12 3.5 13.8 9.2 19.5 11 13.8 12.8 12 18.5 10.2 12.8 4.5 11 10.2 9.2 12 3.5Z"
                          fill="currentColor"
                        />
                      </svg>
                    </div>
                    <h3>Ask about your SOC data</h3>
                    <p>
                      Alerts, vulns, incidents, FIM, SCA, MITRE, compliance — answers cite live evidence when grounding
                      is on.
                    </p>
                    {suggestions.length > 0 && (
                      <div className="ai-prompt-list">
                        {suggestions.slice(0, 4).map((s) => (
                          <button
                            key={s}
                            type="button"
                            className="ai-prompt-card"
                            disabled={loading}
                            onClick={() => onSend(undefined, s)}
                          >
                            <span className="ai-prompt-label">Try</span>
                            <span className="ai-prompt-text">{s}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {messages.map((m) => (
                  <article key={m.id} className={`ai-msg ${m.role}`}>
                    {m.role === "assistant" && (
                      <div className="ai-msg-meta">
                        <span className="ai-role">Assistant</span>
                        {m.mode && <span className="ai-mode">{m.mode}</span>}
                      </div>
                    )}
                    <div className="ai-bubble">
                      <ChatMessageContent content={m.content} variant={m.role} />
                    </div>
                    {m.sources && m.sources.length > 0 && (
                      <div className="ai-sources" aria-label="Evidence sources">
                        {m.sources.slice(0, 6).map((s) => (
                          <span key={`${s.kind}-${s.id}`} className="ai-source" title={s.label || s.id}>
                            <em>{s.kind}</em>
                            {s.label || s.id}
                          </span>
                        ))}
                      </div>
                    )}
                  </article>
                ))}

                {loading && (
                  <div className="ai-msg assistant">
                    <div className="ai-msg-meta">
                      <span className="ai-role">Assistant</span>
                    </div>
                    <div className="ai-bubble thinking">
                      <span className="ai-dots" aria-hidden>
                        <i />
                        <i />
                        <i />
                      </span>
                      Retrieving evidence…
                    </div>
                  </div>
                )}

                {error && (
                  <div className="ai-error" role="alert">
                    <strong>Couldn’t answer</strong>
                    <span>{error}</span>
                  </div>
                )}
                <div ref={endRef} />
              </div>

              {!showEmpty && suggestions.length > 0 && (
                <div className="ai-chip-row" aria-label="Suggested prompts">
                  {suggestions.slice(0, 3).map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="ai-chip"
                      disabled={loading}
                      onClick={() => onSend(undefined, s)}
                      title={s}
                    >
                      {truncate(s, 42)}
                    </button>
                  ))}
                </div>
              )}

              <form className="ai-composer" onSubmit={onSend}>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Ask a security question… (Enter to send)"
                  disabled={loading}
                  rows={2}
                />
                <div className="ai-composer-bar">
                  <span className="ai-page">
                    Viewing <strong>{pageLabel}</strong>
                  </span>
                  <button className="ai-send" type="submit" disabled={loading || !input.trim()} aria-label="Send">
                    <svg viewBox="0 0 24 24" aria-hidden>
                      <path
                        d="M5 12h12M13 6l6 6-6 6"
                        stroke="currentColor"
                        strokeWidth="1.9"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                      />
                    </svg>
                  </button>
                </div>
              </form>
            </>
          )}
        </section>
      )}

      <style>{`
        .ai-root {
          position: fixed;
          right: 1.15rem;
          bottom: 1.15rem;
          z-index: 80;
        }
        .ai-fab {
          width: 52px;
          height: 52px;
          border-radius: 14px;
          border: 0;
          background: linear-gradient(145deg, #3b82f6, #1d4ed8);
          color: #fff;
          cursor: pointer;
          box-shadow: 0 10px 28px rgba(37, 99, 235, 0.35);
          display: grid;
          place-items: center;
          transition: transform 140ms ease, box-shadow 140ms ease;
        }
        .ai-fab:hover {
          transform: translateY(-2px);
          box-shadow: 0 14px 32px rgba(37, 99, 235, 0.42);
        }
        .ai-fab svg { width: 22px; height: 22px; }

        .ai-panel {
          width: min(420px, calc(100vw - 1.5rem));
          max-height: min(720px, calc(100vh - 2rem));
          border-radius: 16px;
          overflow: hidden;
          display: grid;
          grid-template-rows: auto 1fr auto;
          border: 1px solid #d8dee8;
          background: #f7f8fb;
          box-shadow: 0 18px 48px rgba(15, 23, 42, 0.18);
        }
        .ai-panel.is-min {
          width: 300px;
          grid-template-rows: auto;
        }

        .ai-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 0.75rem;
          padding: 0.85rem 0.9rem;
          background: linear-gradient(180deg, #121826, #1a2232);
          color: #e8eef8;
        }
        .ai-brand {
          display: flex;
          align-items: center;
          gap: 0.7rem;
          min-width: 0;
        }
        .ai-avatar {
          width: 36px;
          height: 36px;
          border-radius: 11px;
          display: grid;
          place-items: center;
          background: linear-gradient(145deg, #3b82f6, #1d4ed8);
          color: #fff;
          flex-shrink: 0;
          box-shadow: 0 6px 16px rgba(37, 99, 235, 0.35);
        }
        .ai-avatar svg { width: 16px; height: 16px; }
        .ai-titles { min-width: 0; }
        .ai-titles strong {
          display: block;
          font-size: 0.95rem;
          font-weight: 700;
          letter-spacing: -0.02em;
        }
        .ai-status-row {
          display: flex;
          flex-wrap: wrap;
          gap: 0.3rem;
          margin-top: 0.3rem;
        }
        .ai-pill {
          display: inline-flex;
          align-items: center;
          max-width: 120px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          border-radius: 999px;
          padding: 0.12rem 0.45rem;
          font-size: 0.65rem;
          font-weight: 650;
          letter-spacing: 0.02em;
          background: rgba(255,255,255,0.08);
          color: #b8c2d6;
          border: 1px solid rgba(255,255,255,0.08);
        }
        .ai-pill.ok {
          background: rgba(16, 185, 129, 0.18);
          color: #6ee7b7;
          border-color: rgba(16, 185, 129, 0.25);
        }
        .ai-pill.soft {
          background: rgba(59, 130, 246, 0.18);
          color: #93c5fd;
        }
        .ai-pill.muted { color: #9aa6bd; }

        .ai-toolbar { display: flex; gap: 0.3rem; flex-shrink: 0; }
        .ai-icon-btn {
          appearance: none;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.05);
          color: #c5d0e4;
          display: grid;
          place-items: center;
          cursor: pointer;
        }
        .ai-icon-btn:hover {
          background: rgba(255,255,255,0.1);
          color: #fff;
        }
        .ai-icon-btn.danger:hover {
          background: rgba(239, 68, 68, 0.2);
          color: #fecaca;
          border-color: rgba(239, 68, 68, 0.3);
        }
        .ai-icon-btn svg { width: 15px; height: 15px; }

        .ai-context {
          display: flex;
          justify-content: space-between;
          gap: 0.65rem;
          align-items: center;
          padding: 0.65rem 0.9rem;
          background: #eef4ff;
          border-bottom: 1px solid #d7e3f8;
        }
        .ai-context-kicker {
          display: block;
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #64748b;
          margin-bottom: 0.15rem;
        }
        .ai-context-main strong {
          font-size: 0.82rem;
          color: #1e293b;
          font-weight: 650;
        }
        .ai-dot { margin: 0 0.35rem; color: #94a3b8; font-weight: 500; }
        .ai-link-btn {
          appearance: none;
          border: 0;
          background: transparent;
          color: #2563eb;
          font-size: 0.75rem;
          font-weight: 650;
          cursor: pointer;
          padding: 0.25rem 0.35rem;
          border-radius: 6px;
        }
        .ai-link-btn:hover { background: rgba(37, 99, 235, 0.08); }

        .ai-body {
          min-height: 280px;
          max-height: 420px;
          overflow: auto;
          padding: 0.95rem;
          display: grid;
          gap: 0.85rem;
          align-content: start;
          background:
            radial-gradient(500px 180px at 100% 0%, rgba(59,130,246,0.06), transparent 60%),
            #f7f8fb;
        }

        .ai-empty {
          text-align: center;
          padding: 0.5rem 0.25rem 0.25rem;
        }
        .ai-empty-icon {
          width: 44px;
          height: 44px;
          margin: 0 auto 0.75rem;
          border-radius: 14px;
          display: grid;
          place-items: center;
          color: #2563eb;
          background: #e8f0ff;
        }
        .ai-empty-icon svg { width: 20px; height: 20px; }
        .ai-empty h3 {
          margin: 0 0 0.35rem;
          font-size: 1rem;
          letter-spacing: -0.02em;
          color: #0f172a;
        }
        .ai-empty p {
          margin: 0 auto 1rem;
          max-width: 32ch;
          color: #64748b;
          font-size: 0.82rem;
          line-height: 1.45;
        }
        .ai-prompt-list {
          display: grid;
          gap: 0.45rem;
          text-align: left;
        }
        .ai-prompt-card {
          appearance: none;
          width: 100%;
          border: 1px solid #dbe3ef;
          background: #fff;
          border-radius: 12px;
          padding: 0.7rem 0.8rem;
          cursor: pointer;
          display: grid;
          gap: 0.2rem;
          transition: border-color 120ms ease, box-shadow 120ms ease, transform 120ms ease;
        }
        .ai-prompt-card:hover:not(:disabled) {
          border-color: #93c5fd;
          box-shadow: 0 6px 16px rgba(37, 99, 235, 0.08);
          transform: translateY(-1px);
        }
        .ai-prompt-card:disabled { opacity: 0.55; cursor: not-allowed; }
        .ai-prompt-label {
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #2563eb;
        }
        .ai-prompt-text {
          font-size: 0.84rem;
          color: #1e293b;
          line-height: 1.35;
          font-weight: 500;
        }

        .ai-msg { display: grid; gap: 0.35rem; max-width: 100%; }
        .ai-msg.user { justify-items: end; }
        .ai-msg.assistant { justify-items: start; }
        .ai-msg-meta {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          padding-left: 0.15rem;
        }
        .ai-role {
          font-size: 0.68rem;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: #64748b;
        }
        .ai-mode {
          font-size: 0.65rem;
          font-weight: 650;
          color: #2563eb;
          background: #e8f0ff;
          border-radius: 999px;
          padding: 0.1rem 0.4rem;
        }
        .ai-bubble {
          max-width: 94%;
          padding: 0.8rem 0.95rem;
          border-radius: 14px;
          font-size: 0.875rem;
          line-height: 1.5;
          color: #0f172a;
          overflow: hidden;
        }
        .ai-msg.assistant .ai-bubble {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-bottom-left-radius: 6px;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
        }
        .ai-msg.user .ai-bubble {
          background: linear-gradient(145deg, #2563eb, #1d4ed8);
          color: #fff;
          border: 0;
          border-bottom-right-radius: 6px;
          box-shadow: 0 6px 16px rgba(37, 99, 235, 0.22);
        }
        .ai-bubble.thinking {
          display: inline-flex;
          align-items: center;
          gap: 0.55rem;
          color: #64748b;
          font-size: 0.82rem;
        }
        .ai-dots { display: inline-flex; gap: 0.22rem; }
        .ai-dots i {
          width: 5px;
          height: 5px;
          border-radius: 999px;
          background: #94a3b8;
          display: block;
          animation: ai-bounce 1s infinite ease-in-out;
        }
        .ai-dots i:nth-child(2) { animation-delay: 0.15s; }
        .ai-dots i:nth-child(3) { animation-delay: 0.3s; }
        @keyframes ai-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.45; }
          40% { transform: translateY(-3px); opacity: 1; }
        }

        .ai-sources {
          display: flex;
          flex-wrap: wrap;
          gap: 0.3rem;
          max-width: 94%;
        }
        .ai-source {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          border-radius: 7px;
          padding: 0.2rem 0.45rem;
          font-size: 0.68rem;
          color: #475569;
          background: #eef2f7;
          border: 1px solid #e2e8f0;
        }
        .ai-source em {
          font-style: normal;
          font-weight: 700;
          color: #2563eb;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          font-size: 0.6rem;
        }

        .ai-error {
          display: grid;
          gap: 0.15rem;
          padding: 0.7rem 0.8rem;
          border-radius: 12px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #991b1b;
          font-size: 0.8rem;
        }
        .ai-error strong { font-size: 0.78rem; }

        .ai-chip-row {
          display: flex;
          gap: 0.4rem;
          overflow-x: auto;
          padding: 0 0.85rem 0.55rem;
          scrollbar-width: none;
        }
        .ai-chip-row::-webkit-scrollbar { display: none; }
        .ai-chip {
          appearance: none;
          flex: 0 0 auto;
          border: 1px dashed #c5d0e0;
          background: #fff;
          color: #334155;
          border-radius: 999px;
          padding: 0.35rem 0.7rem;
          font-size: 0.72rem;
          font-weight: 500;
          cursor: pointer;
          max-width: 220px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .ai-chip:hover:not(:disabled) {
          border-style: solid;
          border-color: #93c5fd;
          color: #1d4ed8;
          background: #f8fbff;
        }
        .ai-chip:disabled { opacity: 0.5; cursor: not-allowed; }

        .ai-composer {
          display: grid;
          gap: 0.45rem;
          padding: 0.75rem 0.85rem 0.85rem;
          background: #fff;
          border-top: 1px solid #e5eaf1;
        }
        .ai-composer textarea {
          width: 100%;
          resize: none;
          border: 1px solid #d0d7e2;
          border-radius: 12px;
          padding: 0.75rem 0.85rem;
          background: #f8fafc;
          color: #0f172a;
          font: inherit;
          font-size: 0.88rem;
          line-height: 1.4;
          outline: none;
          min-height: 64px;
        }
        .ai-composer textarea:focus {
          border-color: #60a5fa;
          background: #fff;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
        }
        .ai-composer-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
        }
        .ai-page {
          font-size: 0.72rem;
          color: #94a3b8;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .ai-page strong {
          color: #64748b;
          font-weight: 650;
        }
        .ai-send {
          appearance: none;
          width: 40px;
          height: 40px;
          border-radius: 11px;
          border: 0;
          background: linear-gradient(145deg, #3b82f6, #1d4ed8);
          color: #fff;
          display: grid;
          place-items: center;
          cursor: pointer;
          box-shadow: 0 6px 14px rgba(37, 99, 235, 0.28);
        }
        .ai-send:hover:not(:disabled) { filter: brightness(1.05); }
        .ai-send:disabled {
          opacity: 0.45;
          cursor: not-allowed;
          box-shadow: none;
        }
        .ai-send svg { width: 17px; height: 17px; }
      `}</style>
    </div>
  );
}

function shortModel(model?: string) {
  if (!model) return "model";
  const cleaned = model.replace(/^llama/i, "Llama").replace(/:8b$/i, " 8B");
  return cleaned.length > 18 ? `${cleaned.slice(0, 16)}…` : cleaned;
}

function truncate(text: string, max: number) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}
