import { useState, useRef, MouseEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { authApi } from "../api/client";
import {
  ChevronLeft, ChevronRight, Sparkles, Download,
  Github, RefreshCw,
} from "lucide-react";
import { format, addDays, subDays, startOfWeek, isSameDay, isToday } from "date-fns";

/* ── mock timeline events ─────────────────────────── */
function mockEvents(date: Date) {
  return [
    { id: 1, source: "github", type: "commit",      title: "feat: add dark mode support",  repo: "devtracker",      sha: "a1b2c3d", time: "09:14" },
    { id: 2, source: "jira",   type: "status_change",title: "PROJ-42 moved to In Progress", project: "devtracker",  key: "PROJ-42", time: "09:30" },
    { id: 3, source: "teams",  type: "meeting",      title: "Daily standup",                channel: "Engineering",  duration: "30m", time: "10:00" },
    { id: 4, source: "github", type: "pr_opened",    title: "PR: Refactor auth middleware",  repo: "api-service",    number: 87,     time: "11:22" },
    { id: 5, source: "jira",   type: "comment",      title: "Commented on PROJ-39",          project: "devtracker",  key: "PROJ-39", time: "13:05" },
    { id: 6, source: "github", type: "review",       title: "Reviewed PR #83 in api-service",repo: "api-service",    number: 83,     time: "14:40" },
    { id: 7, source: "teams",  type: "message",      title: "Posted in #general (12 msgs)",  channel: "general",     time: "15:00" },
    { id: 8, source: "github", type: "commit",       title: "fix: null pointer in token store", repo: "api-service", sha: "f9e8d7c", time: "16:30" },
  ].map((e) => ({ ...e, date }));
}

/* ── source config ────────────────────────────────── */
const SRC = {
  github: { label: "GitHub", accent: "var(--gh)",    bg: "var(--gh-bg)" },
  jira:   { label: "Jira",   accent: "var(--jira)",  bg: "var(--jira-bg)" },
  teams:  { label: "Teams",  accent: "var(--teams)", bg: "var(--teams-bg)" },
  gitlab: { label: "GitLab", accent: "var(--gl)",    bg: "var(--gl-bg)" },
} as const;

/* ── KPI card ─────────────────────────────────────── */
function KpiCard({ label, value, sub, accent, bg }: {
  label: string; value: number; sub: string; accent: string; bg: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  function onMove(e: MouseEvent<HTMLDivElement>) {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width  - 0.5) * 14;
    const y = ((e.clientY - r.top)  / r.height - 0.5) * -14;
    el.style.transform = `perspective(600px) rotateX(${y}deg) rotateY(${x}deg) scale(1.02)`;
  }
  function onLeave() { if (ref.current) ref.current.style.transform = ""; }

  return (
    <div
      ref={ref}
      className="tilt-card rounded-xl p-4 border"
      style={{ background: bg, borderColor: accent + "33" }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: accent }}>{label}</p>
      <p className="text-2xl font-bold mb-0.5" style={{ color: "var(--text)" }}>{value}</p>
      <p className="text-xs" style={{ color: "var(--text-3)" }}>{sub}</p>
    </div>
  );
}

/* ── page ─────────────────────────────────────────── */
export function MyDayPage() {
  const [selected, setSelected] = useState(new Date());
  const [calOpen, setCalOpen] = useState(false);
  const [calMonth, setCalMonth] = useState(new Date());
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const { data } = useQuery({
    queryKey: ["my-profile"],
    queryFn: authApi.getMyProfile,
  });

  const gh    = data?.apps?.github;
  const jira  = data?.apps?.jira;
  const teams = data?.apps?.teams;

  const events = mockEvents(selected);
  const ghEvents    = events.filter((e) => e.source === "github");
  const jiraEvents  = events.filter((e) => e.source === "jira");
  const teamsEvents = events.filter((e) => e.source === "teams");

  const todayLabel = isToday(selected) ? "TODAY" : format(selected, "EEE").toUpperCase();
  const dateLabel  = format(selected, "MMMM d, yyyy");

  /* week row for calendar */
  const weekStart = startOfWeek(calMonth, { weekStartsOn: 1 });
  const monthDays = (() => {
    const d = new Date(calMonth.getFullYear(), calMonth.getMonth(), 1);
    const days: Date[] = [];
    while (d.getMonth() === calMonth.getMonth()) { days.push(new Date(d)); d.setDate(d.getDate() + 1); }
    return days;
  })();

  function generateSummary() {
    setGenerating(true);
    setTimeout(() => {
      setAiSummary(
        `On ${dateLabel}, you made ${ghEvents.length} GitHub contributions across ${[...new Set(ghEvents.map((e: any) => e.repo))].length} repositories — ` +
        `including ${ghEvents.filter((e) => e.type === "commit").length} commits and 1 pull request. ` +
        `You updated ${jiraEvents.length} Jira issues and participated in ${teamsEvents.filter((e) => e.type === "meeting").length} meeting. ` +
        `Overall a productive day with strong code output and cross-team collaboration.`
      );
      setGenerating(false);
    }, 1600);
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelected((d) => subDays(d, 1))}
            className="p-1.5 rounded-lg transition-colors hover:bg-[var(--surface-2)]"
            style={{ color: "var(--text-2)" }}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCalOpen((o) => !o)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors hover:bg-[var(--surface-2)]"
            style={{ color: "var(--text)", borderColor: "var(--border)", background: "var(--surface)" }}
          >
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded"
              style={{ background: isToday(selected) ? "#22c55e20" : "var(--surface-2)", color: isToday(selected) ? "#22c55e" : "var(--text-3)" }}
            >
              {todayLabel}
            </span>
            {dateLabel}
            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${calOpen ? "rotate-90" : ""}`} />
          </button>
          <button
            onClick={() => setSelected((d) => addDays(d, 1))}
            disabled={isToday(selected)}
            className="p-1.5 rounded-lg transition-colors hover:bg-[var(--surface-2)] disabled:opacity-30"
            style={{ color: "var(--text-2)" }}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => setSelected(new Date())}
            className="text-xs px-2.5 py-1 rounded-lg border transition-colors hover:bg-[var(--surface-2)]"
            style={{ borderColor: "var(--border)", color: "var(--text-3)", background: "var(--surface)" }}
          >
            Today
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors hover:bg-[var(--surface-2)]"
            style={{ borderColor: "var(--border)", color: "var(--text-2)", background: "var(--surface)" }}
          >
            <Download className="w-3.5 h-3.5" /> PDF
          </button>
          <button
            onClick={generateSummary}
            disabled={generating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-60"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            {generating ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            {aiSummary ? "Regenerate" : "Generate summary"}
          </button>
        </div>
      </div>

      {/* Calendar dropdown */}
      {calOpen && (
        <div
          className="rounded-xl border p-4 shadow-lg"
          style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-md)" }}
        >
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setCalMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1))}
              className="p-1 rounded hover:bg-[var(--surface-2)]"
              style={{ color: "var(--text-2)" }}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
              {format(calMonth, "MMMM yyyy")}
            </span>
            <button
              onClick={() => setCalMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1))}
              className="p-1 rounded hover:bg-[var(--surface-2)]"
              style={{ color: "var(--text-2)" }}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {["M","T","W","T","F","S","S"].map((d, i) => (
              <div key={i} className="text-[10px] font-semibold py-1" style={{ color: "var(--text-3)" }}>{d}</div>
            ))}
            {/* leading blanks */}
            {Array.from({ length: (weekStart.getDay() || 7) - 1 }).map((_, i) => (
              <div key={`b${i}`} />
            ))}
            {monthDays.map((d) => {
              const active = isSameDay(d, selected);
              const today  = isToday(d);
              const future = d > new Date();
              return (
                <button
                  key={d.toISOString()}
                  disabled={future}
                  onClick={() => { setSelected(d); setCalOpen(false); }}
                  className="w-8 h-8 rounded-full text-xs font-medium mx-auto flex items-center justify-center transition-colors disabled:opacity-30"
                  style={{
                    background: active ? "var(--accent)" : today ? "var(--accent-soft)" : "transparent",
                    color: active ? "#fff" : today ? "var(--accent)" : "var(--text-2)",
                  }}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* AI Summary */}
      <div
        className="rounded-xl border p-5"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4" style={{ color: "var(--accent)" }} />
          <h2 className="text-sm font-semibold" style={{ color: "var(--text)" }}>AI Summary</h2>
        </div>
        {generating ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-3 rounded animate-pulse" style={{ background: "var(--surface-2)", width: i === 2 ? "60%" : "100%" }} />
            ))}
          </div>
        ) : aiSummary ? (
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>{aiSummary}</p>
        ) : (
          <p className="text-sm" style={{ color: "var(--text-3)" }}>
            Click "Generate summary" to get an AI-powered overview of your day.
          </p>
        )}
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="GitHub"  value={ghEvents.length}    sub="events today" accent="var(--gh)"    bg="var(--gh-bg)" />
        <KpiCard label="Jira"    value={jiraEvents.length}  sub="events today" accent="var(--jira)"  bg="var(--jira-bg)" />
        <KpiCard label="Teams"   value={teamsEvents.length} sub="events today" accent="var(--teams)" bg="var(--teams-bg)" />
        <KpiCard label="GitLab"  value={0}                  sub="events today" accent="var(--gl)"    bg="var(--gl-bg)" />
      </div>

      {/* Timeline */}
      <div
        className="rounded-xl border"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-sm font-semibold" style={{ color: "var(--text)" }}>Activity timeline</h2>
          <span className="text-xs" style={{ color: "var(--text-3)" }}>{events.length} events</span>
        </div>
        <div className="divide-y" style={{ borderColor: "var(--border)" }}>
          {events.map((ev) => {
            const src = SRC[ev.source as keyof typeof SRC];
            return (
              <div key={ev.id} className="flex items-start gap-4 px-5 py-3">
                <span className="text-xs pt-0.5 tabular-nums w-10 flex-shrink-0" style={{ color: "var(--text-3)" }}>
                  {ev.time}
                </span>
                <div
                  className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                  style={{ background: src.accent }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium" style={{ color: "var(--text)" }}>{ev.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>
                    {"repo" in ev ? ev.repo as string : "project" in ev ? ev.project as string : "channel" in ev ? `#${ev.channel}` : ""}
                  </p>
                </div>
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                  style={{ background: src.accent + "20", color: src.accent }}
                >
                  {src.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
