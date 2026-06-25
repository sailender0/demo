import { useRef, MouseEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { authApi } from "../api/client";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { Github, GitlabIcon, ExternalLink, TrendingUp, Zap } from "lucide-react";

/* ── mock weekly chart data ─────────────────────── */
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const CHART_DATA = DAYS.map((day) => ({
  day,
  GitHub: Math.floor(Math.random() * 12 + 2),
  Jira:   Math.floor(Math.random() * 8  + 1),
  Teams:  Math.floor(Math.random() * 6  + 1),
  GitLab: Math.floor(Math.random() * 4),
}));

/* ── KPI tilt card ───────────────────────────────── */
function KpiCard({
  label, value, sub, accent, bg, icon,
}: {
  label: string; value: number | string; sub: string;
  accent: string; bg: string; icon: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function onMove(e: MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width  - 0.5) * 16;
    const y = ((e.clientY - r.top)  / r.height - 0.5) * -16;
    el.style.transform = `perspective(600px) rotateX(${y}deg) rotateY(${x}deg) scale(1.02)`;
  }
  function onLeave() {
    if (ref.current) ref.current.style.transform = "";
  }

  return (
    <div
      ref={ref}
      className="tilt-card rounded-xl p-5 border"
      style={{ background: bg, borderColor: accent + "33" }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: accent }}>
          {label}
        </span>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: accent + "22" }}
        >
          <span style={{ color: accent }}>{icon}</span>
        </div>
      </div>
      <p className="text-3xl font-bold mb-1" style={{ color: "var(--text)" }}>{value}</p>
      <p className="text-xs" style={{ color: "var(--text-3)" }}>{sub}</p>
    </div>
  );
}

/* ── custom tooltip ──────────────────────────────── */
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl px-4 py-3 text-sm border"
      style={{
        background: "var(--surface)",
        borderColor: "var(--border)",
        boxShadow: "var(--shadow-md)",
      }}
    >
      <p className="font-semibold mb-2" style={{ color: "var(--text)" }}>{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 mb-0.5">
          <span className="w-2 h-2 rounded-full" style={{ background: p.fill }} />
          <span style={{ color: "var(--text-2)" }}>{p.name}</span>
          <span className="ml-auto font-medium" style={{ color: "var(--text)" }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ── recent activity row ─────────────────────────── */
function ActivityRow({
  icon, source, title, meta, time, accentColor,
}: {
  icon: React.ReactNode; source: string; title: string;
  meta?: string; time: string; accentColor: string;
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b last:border-0" style={{ borderColor: "var(--border)" }}>
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: accentColor + "20", color: accentColor }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>{title}</p>
        {meta && <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-3)" }}>{meta}</p>}
      </div>
      <div className="flex-shrink-0 text-right">
        <span
          className="text-[10px] px-2 py-0.5 rounded-full font-medium"
          style={{ background: accentColor + "20", color: accentColor }}
        >
          {source}
        </span>
        <p className="text-[10px] mt-1" style={{ color: "var(--text-3)" }}>{time}</p>
      </div>
    </div>
  );
}

/* ── page ────────────────────────────────────────── */
export function Overview() {
  const { data, isLoading } = useQuery({
    queryKey: ["my-profile"],
    queryFn: authApi.getMyProfile,
  });

  const identity = data?.identity;
  const gh = data?.apps?.github;
  const jira = data?.apps?.jira;
  const teams = data?.apps?.teams;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  const openPRs     = gh?.recent_prs?.length ?? 0;
  const openIssues  = jira?.open_issues?.length ?? 0;
  const teamsCount  = teams?.teams?.length ?? 0;
  const totalEvents = openPRs + openIssues + teamsCount;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>
            {greeting}, {identity?.name?.split(" ")[0] ?? "there"} 👋
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-2)" }}>
            Here's your activity across all connected tools this week
          </p>
        </div>
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border"
          style={{ borderColor: "var(--border)", color: "var(--text-2)", background: "var(--surface)" }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 pulse-green inline-block" />
          Live
        </div>
      </div>

      {/* KPI cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 rounded-xl animate-pulse" style={{ background: "var(--surface-2)" }} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="GitHub" value={openPRs}     sub="open pull requests"  accent="var(--gh)"    bg="var(--gh-bg)"    icon={<Github className="w-4 h-4"/>} />
          <KpiCard label="Jira"   value={openIssues}  sub="open issues"         accent="var(--jira)"  bg="var(--jira-bg)"  icon={<JiraIcon />} />
          <KpiCard label="Teams"  value={teamsCount}  sub="active teams"        accent="var(--teams)" bg="var(--teams-bg)" icon={<TeamsIconSmall />} />
          <KpiCard label="Total"  value={totalEvents} sub="events this week"    accent="var(--accent)" bg="var(--accent-soft)" icon={<Zap className="w-4 h-4"/>} />
        </div>
      )}

      {/* Chart + Activity split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Stacked bar chart */}
        <div
          className="lg:col-span-2 rounded-xl border p-5"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm" style={{ color: "var(--text)" }}>
              Weekly activity
            </h2>
            <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-3)" }}>
              <TrendingUp className="w-3.5 h-3.5" /> This week
            </span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={CHART_DATA} barSize={10} barCategoryGap="30%">
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="4 2" />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 11, fill: "var(--text-3)" }}
                axisLine={false} tickLine={false}
              />
              <YAxis hide />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--surface-2)" }} />
              <Legend
                iconType="circle" iconSize={7}
                formatter={(v) => (
                  <span style={{ color: "var(--text-2)", fontSize: 11 }}>{v}</span>
                )}
              />
              <Bar dataKey="GitHub" stackId="a" fill="var(--gh)"    radius={[0,0,0,0]} />
              <Bar dataKey="Jira"   stackId="a" fill="var(--jira)"  radius={[0,0,0,0]} />
              <Bar dataKey="Teams"  stackId="a" fill="var(--teams)" radius={[0,0,0,0]} />
              <Bar dataKey="GitLab" stackId="a" fill="var(--gl)"    radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Quick status */}
        <div
          className="rounded-xl border p-5 flex flex-col gap-4"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          <h2 className="font-semibold text-sm" style={{ color: "var(--text)" }}>
            Connection status
          </h2>
          {[
            { label: "GitHub", connected: gh?.connected, accent: "var(--gh)" },
            { label: "Jira",   connected: jira?.connected, accent: "var(--jira)" },
            { label: "Teams",  connected: teams?.connected, accent: "var(--teams)" },
            { label: "GitLab", connected: false, accent: "var(--gl)" },
          ].map(({ label, connected, accent }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-sm" style={{ color: "var(--text-2)" }}>{label}</span>
              <span
                className="text-xs px-2.5 py-0.5 rounded-full font-medium"
                style={
                  connected
                    ? { background: accent + "20", color: accent }
                    : { background: "var(--surface-2)", color: "var(--text-3)" }
                }
              >
                {connected ? "Connected" : "Not set up"}
              </span>
            </div>
          ))}

          {teams?.presence && (
            <div
              className="mt-2 p-3 rounded-lg"
              style={{ background: "var(--surface-2)" }}
            >
              <p className="text-xs font-medium mb-1" style={{ color: "var(--text-2)" }}>
                Your Teams presence
              </p>
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: presenceColor(teams.presence.availability) }}
                />
                <span className="text-sm font-medium" style={{ color: "var(--text)" }}>
                  {teams.presence.availability}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent activity timeline */}
      <div
        className="rounded-xl border p-5"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <h2 className="font-semibold text-sm mb-4" style={{ color: "var(--text)" }}>
          Recent activity
        </h2>

        {!gh?.connected && !jira?.connected && !teams?.connected ? (
          <div className="py-12 text-center">
            <p className="text-sm" style={{ color: "var(--text-3)" }}>
              No apps connected. Visit GitHub, Jira, or Teams to get started.
            </p>
          </div>
        ) : (
          <div>
            {gh?.connected && gh.recent_prs?.map((pr: any, i: number) => (
              <ActivityRow
                key={`pr-${i}`}
                icon={<Github className="w-4 h-4" />}
                source="GitHub"
                title={pr.title}
                meta={`#${pr.number} · ${pr.repo}`}
                time="PR"
                accentColor="var(--gh)"
              />
            ))}
            {gh?.connected && gh.recent_commits?.slice(0, 3).map((c: any, i: number) => (
              <ActivityRow
                key={`commit-${i}`}
                icon={<Github className="w-4 h-4" />}
                source="GitHub"
                title={c.message}
                meta={`${c.sha} · ${c.repo}`}
                time="commit"
                accentColor="var(--gh)"
              />
            ))}
            {jira?.connected && jira.open_issues?.slice(0, 3).map((issue: any, i: number) => (
              <ActivityRow
                key={`jira-${i}`}
                icon={<JiraIcon />}
                source="Jira"
                title={issue.summary}
                meta={`${issue.key} · ${issue.status}`}
                time={issue.priority ?? ""}
                accentColor="var(--jira)"
              />
            ))}
          </div>
        )}

        {(gh?.connected || jira?.connected) && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs" style={{ color: "var(--text-3)" }}>
              Showing recent activity from connected apps
            </p>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs"
              style={{ color: "var(--accent)" }}
            >
              View all <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function presenceColor(avail?: string) {
  const map: Record<string, string> = {
    Available: "#22c55e", Busy: "#ef4444",
    DoNotDisturb: "#ef4444", Away: "#f59e0b",
    BeRightBack: "#f59e0b", Offline: "#6b7280",
  };
  return map[avail ?? ""] ?? "#6b7280";
}

function JiraIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? "w-4 h-4"} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2L2 12l4 4 6-6 6 6 4-4L12 2z" opacity="0.4" />
      <path d="M12 6.5L7 12l5 5 5-5-5-5.5z" />
    </svg>
  );
}
function TeamsIconSmall() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M15 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
      <path d="M8.5 10a3 3 0 100-6 3 3 0 000 6z" />
      <path d="M2 21v-2.5A6.5 6.5 0 0115 18.5V21H2z" />
    </svg>
  );
}
