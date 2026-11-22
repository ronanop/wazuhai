import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type ChatSelection = {
  type: string;
  id: string;
  title?: string;
  meta?: Record<string, unknown>;
};

type ChatContextValue = {
  open: boolean;
  setOpen: (v: boolean) => void;
  selection: ChatSelection | null;
  setSelection: (s: ChatSelection | null) => void;
  draftPrompt: string | null;
  clearDraft: () => void;
  askAbout: (selection: ChatSelection, prompt?: string) => void;
};

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState<ChatSelection | null>(null);
  const [draftPrompt, setDraftPrompt] = useState<string | null>(null);

  const clearDraft = useCallback(() => setDraftPrompt(null), []);

  const askAbout = useCallback((sel: ChatSelection, prompt?: string) => {
    setSelection(sel);
    if (prompt) setDraftPrompt(prompt);
    setOpen(true);
  }, []);

  const value = useMemo(
    () => ({ open, setOpen, selection, setSelection, draftPrompt, clearDraft, askAbout }),
    [open, selection, draftPrompt, clearDraft, askAbout],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChatAssistant() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatAssistant must be used within ChatProvider");
  return ctx;
}
