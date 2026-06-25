import { useState, useRef, useEffect } from "react";
import { Sparkles, Send, Plus, Trash2, Bot } from "lucide-react";

/* ── types ───────────────────────────────────────── */
interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: Date;
}

/* ── mock AI responses ───────────────────────────── */
const MOCK_RESPONSES: Record<string, string> = {
  default:
    "I can help you explore your developer activity! Ask me about your GitHub commits, Jira issues, Teams meetings, or activity trends. " +
    "For example, try asking 'What did I push today?' or 'How many PRs did I open this week?'",
  commit:
    "Today you pushed **3 commits** across 2 repositories:\n\n" +
    "- `feat: add dark mode support` → devtracker (09:14)\n" +
    "- `fix: null pointer in token store` → api-service (16:30)\n" +
    "- `chore: update deps` → api-service (11:05)\n\n" +
    "That's a solid day for code output!",
  pr:
    "This week you opened **2 pull requests**:\n\n" +
    "1. **PR #87** — Refactor auth middleware (api-service) · Open\n" +
    "2. **PR #91** — Add pagination to events endpoint (devtracker) · Merged\n\n" +
    "Your PR cycle time is averaging **1.2 days** this week. Nice pace!",
  jira:
    "Your Jira activity this week:\n\n" +
    "- ✅ **4 issues resolved** (PROJ-38, PROJ-39, PROJ-41, PROJ-44)\n" +
    "- 🔄 **2 in progress** (PROJ-42, PROJ-47)\n" +
    "- 📋 **1 new issue created** (PROJ-48)\n\n" +
    "You're tracking well against the sprint goal.",
  meeting:
    "This week you attended **5 meetings** via Microsoft Teams:\n\n" +
    "- Daily standups (Mon–Fri, 30 min each)\n" +
    "- Sprint planning (Tue, 90 min)\n" +
    "- Design review (Thu, 45 min)\n\n" +
    "Total meeting time: **3h 45m**",
};

function getMockResponse(msg: string): string {
  const l = msg.toLowerCase();
  if (l.includes("commit") || l.includes("push")) return MOCK_RESPONSES.commit;
  if (l.includes("pr") || l.includes("pull request")) return MOCK_RESPONSES.pr;
  if (l.includes("jira") || l.includes("issue")) return MOCK_RESPONSES.jira;
  if (l.includes("meeting") || l.includes("teams")) return MOCK_RESPONSES.meeting;
  return MOCK_RESPONSES.default;
}

/* ── suggestion chips ─────────────────────────────── */
const SUGGESTIONS = [
  "What did I push today?",
  "How many PRs this week?",
  "Show my Jira issues",
  "How many meetings this week?",
  "Summarize my week",
  "What's my busiest day?",
];

/* ── markdown-lite renderer ──────────────────────── */
function MdText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1.5 text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
      {lines.map((line, i) => {
        if (!line.trim()) return <br key={i} />;
        const rendered = line
          .replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--text)">$1</strong>')
          .replace(/`(.+?)`/g, '<code style="background:var(--surface-2);padding:1px 4px;border-radius:3px;font-size:0.8em">$1</code>');
        return (
          <p key={i} dangerouslySetInnerHTML={{ __html: rendered }} />
        );
      })}
    </div>
  );
}

/* ── page ─────────────────────────────────────────── */
export function AskAIPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef   = useRef<HTMLDivElement>(null);

  const active = conversations.find((c) => c.id === activeId) ?? null;

  function newChat() {
    const id = Date.now().toString();
    setConversations((cs) => [
      { id, title: "New chat", messages: [], updatedAt: new Date() },
      ...cs,
    ]);
    setActiveId(id);
    setStreamText("");
  }

  async function sendMessage() {
    if (!input.trim() || streaming) return;
    const text = input.trim();
    setInput("");

    let chatId = activeId;
    if (!chatId) {
      chatId = Date.now().toString();
      const newConv: Conversation = {
        id: chatId,
        title: text.slice(0, 30),
        messages: [],
        updatedAt: new Date(),
      };
      setConversations((cs) => [newConv, ...cs]);
      setActiveId(chatId);
    }

    /* add user message */
    setConversations((cs) =>
      cs.map((c) =>
        c.id === chatId
          ? {
              ...c,
              title: c.messages.length === 0 ? text.slice(0, 30) : c.title,
              messages: [...c.messages, { role: "user", content: text }],
              updatedAt: new Date(),
            }
          : c
      )
    );

    /* simulate streaming */
    setStreaming(true);
    setStreamText("");
    const response = getMockResponse(text);
    let i = 0;
    const interval = setInterval(() => {
      i += Math.floor(Math.random() * 5 + 3);
      if (i >= response.length) {
        setStreamText(response);
        clearInterval(interval);
        setConversations((cs) =>
          cs.map((c) =>
            c.id === chatId
              ? { ...c, messages: [...c.messages, { role: "assistant", content: response }], updatedAt: new Date() }
              : c
          )
        );
        setStreaming(false);
        setStreamText("");
      } else {
        setStreamText(response.slice(0, i));
      }
    }, 30);
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [active?.messages, streamText]);

  function autoResize() {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  }

  return (
    <div className="flex h-full" style={{ background: "var(--bg)" }}>
      {/* ── Conversation sidebar ── */}
      <div
        className="w-56 flex-shrink-0 flex flex-col border-r"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="p-3 border-b" style={{ borderColor: "var(--border)" }}>
          <button
            onClick={newChat}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
          >
            <Plus className="w-4 h-4" /> New chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.length === 0 && (
            <p className="text-xs text-center py-8" style={{ color: "var(--text-3)" }}>
              No conversations yet
            </p>
          )}
          {conversations.map((c) => (
            <div
              key={c.id}
              className="group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors"
              style={{
                background: activeId === c.id ? "var(--accent-soft)" : "transparent",
                color: activeId === c.id ? "var(--accent)" : "var(--text-2)",
              }}
              onClick={() => setActiveId(c.id)}
            >
              <span className="flex-1 text-xs truncate">{c.title}</span>
              <button
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  setConversations((cs) => cs.filter((x) => x.id !== c.id));
                  if (activeId === c.id) setActiveId(null);
                }}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Main chat ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {!active || active.messages.length === 0 ? (
            /* Welcome state */
            <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: "var(--accent-soft)" }}
              >
                <Sparkles className="w-7 h-7" style={{ color: "var(--accent)" }} />
              </div>
              <h2 className="text-xl font-bold mb-2" style={{ color: "var(--text)" }}>
                Ask about your activity
              </h2>
              <p className="text-sm mb-6" style={{ color: "var(--text-2)" }}>
                Query your GitHub, Jira, and Teams activity in plain English.
              </p>
              <div className="grid grid-cols-2 gap-2 w-full">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => { setInput(s); textareaRef.current?.focus(); }}
                    className="px-3 py-2.5 rounded-xl text-xs text-left border transition-all hover:shadow-sm"
                    style={{
                      background: "var(--surface)",
                      borderColor: "var(--border)",
                      color: "var(--text-2)",
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {active.messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                >
                  {m.role === "assistant" && (
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: "var(--accent-soft)" }}
                    >
                      <Bot className="w-4 h-4" style={{ color: "var(--accent)" }} />
                    </div>
                  )}
                  <div
                    className="max-w-[75%] px-4 py-3 rounded-2xl text-sm"
                    style={
                      m.role === "user"
                        ? { background: "var(--accent)", color: "#fff", borderRadius: "18px 4px 18px 18px" }
                        : { background: "var(--surface)", borderColor: "var(--border)", border: "1px solid", borderRadius: "4px 18px 18px 18px" }
                    }
                  >
                    {m.role === "user" ? (
                      <p>{m.content}</p>
                    ) : (
                      <MdText text={m.content} />
                    )}
                  </div>
                </div>
              ))}

              {/* Streaming */}
              {streaming && (
                <div className="flex gap-3">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "var(--accent-soft)" }}
                  >
                    <Bot className="w-4 h-4" style={{ color: "var(--accent)" }} />
                  </div>
                  <div
                    className="max-w-[75%] px-4 py-3 rounded-2xl border"
                    style={{ background: "var(--surface)", borderColor: "var(--border)", borderRadius: "4px 18px 18px 18px" }}
                  >
                    {streamText ? (
                      <MdText text={streamText} />
                    ) : (
                      <div className="dot-bounce flex gap-1">
                        <span /><span /><span />
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </>
          )}
        </div>

        {/* Input bar */}
        <div
          className="border-t px-6 py-4"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <div
            className="flex items-end gap-3 border rounded-2xl px-4 py-3 transition-all focus-within:ring-2"
            style={{
              borderColor: "var(--border)",
              background: "var(--bg)",
              "--tw-ring-color": "var(--accent)",
            } as any}
          >
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => { setInput(e.target.value); autoResize(); }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Ask about your activity… (Enter to send)"
              className="flex-1 resize-none bg-transparent outline-none text-sm"
              style={{ color: "var(--text)", maxHeight: 120 }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || streaming}
              className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all disabled:opacity-40"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[10px] text-center mt-2" style={{ color: "var(--text-3)" }}>
            Enter to send · Shift+Enter for new line · Responses use mock data
          </p>
        </div>
      </div>
    </div>
  );
}
