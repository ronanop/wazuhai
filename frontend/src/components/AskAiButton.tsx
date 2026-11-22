import { useChatAssistant, type ChatSelection } from "../ai/ChatContext";

export function AskAiButton({
  selection,
  prompt,
  label = "Ask AI",
}: {
  selection: ChatSelection;
  prompt?: string;
  label?: string;
}) {
  const { askAbout } = useChatAssistant();
  return (
    <button
      className="ask-ai-btn"
      type="button"
      title={`Ask the assistant about this ${selection.type}`}
      onClick={() =>
        askAbout(
          selection,
          prompt ||
            `Summarize this ${selection.type} with evidence citations: ${selection.title || selection.id}`,
        )
      }
    >
      <svg viewBox="0 0 24 24" aria-hidden>
        <path
          d="M12 3.5 13.8 9.2 19.5 11 13.8 12.8 12 18.5 10.2 12.8 4.5 11 10.2 9.2 12 3.5Z"
          fill="currentColor"
        />
      </svg>
      <span>{label}</span>
      <style>{`
        .ask-ai-btn {
          appearance: none;
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          min-height: 32px;
          padding: 0.4rem 0.75rem;
          border-radius: 8px;
          border: 1px solid #bfdbfe;
          background: linear-gradient(180deg, #eff6ff, #dbeafe);
          color: #1d4ed8;
          font: inherit;
          font-size: 0.82rem;
          font-weight: 650;
          cursor: pointer;
          line-height: 1.2;
        }
        .ask-ai-btn:hover {
          border-color: #93c5fd;
          background: linear-gradient(180deg, #dbeafe, #bfdbfe);
        }
        .ask-ai-btn svg {
          width: 14px;
          height: 14px;
          flex-shrink: 0;
        }
      `}</style>
    </button>
  );
}
