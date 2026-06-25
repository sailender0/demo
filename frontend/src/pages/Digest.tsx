import { useState } from "react";
import { ChevronDown, Download, Zap, Github, Calendar } from "lucide-react";
import { format, startOfWeek, endOfWeek, subWeeks } from "date-fns";

/* ── mock summaries ──────────────────────────────── */
const MOCK_SUMMARIES = Array.from({ length: 6 }).map((_, i) => {
  const weekStart = startOfWeek(subWeeks(new Date(), i), { weekStartsOn: 1 });
  const weekEnd   = endOfWeek(weekStart, { weekStartsOn: 1 });
  return {
    id: `week-${i}`,
    weekLabel: `Week of ${format(weekStart, "MMM d")}`,
    dateRange: `${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d, yyyy")}`,
    isCurrentWeek: i === 0,
    summary: i === 0
      ? "Generated summaries are updated every Friday. Check back at the end of the week."
      : `This was a productive week. You opened ${3 + i} pull requests across ${2 + (i % 2)} repositories, ` +
        `resolved ${4 + i} Jira issues, and attended ${2 + (i % 3)} team meetings. ` +
        `Key highlights include refactoring the authentication middleware, closing out the sprint backlog, ` +
        `and collaborating on the new dashboard feature with the frontend team.`,
    stats: {
      github: 5 + i * 2,
      jira:   4 + i,
      teams:  3 + (i % 3),
      gitlab: i % 2,
    },
    days: ["Mon","Tue","Wed","Thu","Fri"].map((day) => ({
      day,
      github: Math.floor(Math.random() * 8 + 1),
      jira:   Math.floor(Math.random() * 5 + 1),
      teams:  Math.floor(Math.random() * 3),
    })),
  };
});

/* ── mini bar ─────────────────────────────────────── */
function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min((value / max) * 100, 100)}%`, background: color }}
        />
      </div>
      <span className="text-xs tabular-nums w-4 text-right" style={{ color: "var(--text-3)" }}>{value}</span>
    </div>
  );
}

/* ── week row ─────────────────────────────────────── */
function WeekRow({ week }: { week: typeof MOCK_SUMMARIES[0] }) {
  const [open, setOpen] = useState(week.isCurrentWeek ? false : true);
  const maxStat = Math.max(week.stats.github, week.stats.jira, week.stats.teams, 1);

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      {/* header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-[var(--surface-2)]"
      >
        <div
          className="px-2.5 py-1 rounded-lg text-xs font-bold"
          style={{
            background: week.isCurrentWeek ? "var(--accent-soft)" : "var(--surface-2)",
            color: week.isCurrentWeek ? "var(--accent)" : "var(--text-3)",
          }}
        >
          {week.isCurrentWeek ? "Current" : "W"}
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>{week.weekLabel}</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>{week.dateRange}</p>
        </div>
        <div className="flex items-center gap-4 mr-4">
          {[
            { label: "GH",  val: week.stats.github, color: "var(--gh)" },
            { label: "JR",  val: week.stats.jira,   color: "var(--jira)" },
            { label: "MS",  val: week.stats.teams,  color: "var(--teams)" },
          ].map(({ label, val, color }) => (
            <div key={label} className="text-center hidden sm:block">
              <p className="text-base font-bold" style={{ color: "var(--text)" }}>{val}</p>
              <p className="text-[10px]" style={{ color }}>{label}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); }}
            className="p-1.5 rounded-lg transition-colors hover:bg-[var(--surface-2)]"
            style={{ color: "var(--text-3)" }}
            title="Download PDF"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            style={{ color: "var(--text-3)" }}
          />
        </div>
      </button>

      {/* body */}
      {open && (
        <div className="px-5 pb-5 space-y-4" style={{ borderTop: "1px solid var(--border)" }}>
          {/* Summary text */}
          <p className="pt-4 text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
            {week.summary}
          </p>

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "GitHub",  val: week.stats.github, accent: "var(--gh)",    bg: "var(--gh-bg)" },
              { label: "Jira",    val: week.stats.jira,   accent: "var(--jira)",  bg: "var(--jira-bg)" },
              { label: "Teams",   val: week.stats.teams,  accent: "var(--teams)", bg: "var(--teams-bg)" },
              { label: "GitLab",  val: week.stats.gitlab, accent: "var(--gl)",    bg: "var(--gl-bg)" },
            ].map(({ label, val, accent, bg }) => (
              <div
                key={label}
                className="rounded-lg p-3 border"
                style={{ background: bg, borderColor: accent + "33" }}
              >
                <p className="text-xs font-semibold mb-1" style={{ color: accent }}>{label}</p>
                <p className="text-xl font-bold" style={{ color: "var(--text)" }}>{val}</p>
                <p className="text-[10px] mt-0.5" style={{ color: "var(--text-3)" }}>events</p>
              </div>
            ))}
          </div>

          {/* Day breakdown */}
          <div
            className="rounded-lg border p-4"
            style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}
          >
            <p className="text-xs font-semibold mb-3 flex items-center gap-1.5" style={{ color: "var(--text-2)" }}>
              <Calendar className="w-3.5 h-3.5" /> Day breakdown
            </p>
            <div className="space-y-3">
              {week.days.map((d) => (
                <div key={d.day} className="grid grid-cols-[3rem_1fr] gap-3 items-center">
                  <span className="text-xs font-medium" style={{ color: "var(--text-3)" }}>{d.day}</span>
                  <div className="space-y-1">
                    <MiniBar value={d.github} max={maxStat + 4} color="var(--gh)" />
                    <MiniBar value={d.jira}   max={maxStat + 4} color="var(--jira)" />
                    <MiniBar value={d.teams}  max={maxStat + 4} color="var(--teams)" />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
              {[
                { label: "GitHub", color: "var(--gh)" },
                { label: "Jira",   color: "var(--jira)" },
                { label: "Teams",  color: "var(--teams)" },
              ].map(({ label, color }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                  <span className="text-[10px]" style={{ color: "var(--text-3)" }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── page ─────────────────────────────────────────── */
export function DigestPage() {
  const [generating, setGenerating] = useState(false);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>Digest</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-2)" }}>
            Weekly AI-generated summaries · Generated every Friday
          </p>
        </div>
        <button
          onClick={() => { setGenerating(true); setTimeout(() => setGenerating(false), 2000); }}
          disabled={generating}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-60"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          {generating ? (
            <Github className="w-4 h-4 animate-spin" />
          ) : (
            <Zap className="w-4 h-4" />
          )}
          Generate This Week
        </button>
      </div>

      {/* Summaries */}
      <div className="space-y-3">
        {MOCK_SUMMARIES.map((week) => (
          <WeekRow key={week.id} week={week} />
        ))}
      </div>
    </div>
  );
}
