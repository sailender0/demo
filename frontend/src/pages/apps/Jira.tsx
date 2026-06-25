import { useRef, MouseEvent, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { authApi } from "../../api/client";
import {
  ExternalLink, CheckCircle, TrendingUp, AlertCircle, BarChart2,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";

const ACCENT = "var(--jira)";

const WEEK = ["Mon","Tue","Wed","Thu","Fri"];
const CHART_DATA = WEEK.map((day) => ({
  day,
  created:  Math.floor(Math.random() * 5 + 1),
  resolved: Math.floor(Math.random() * 4),
  comments: Math.floor(Math.random() * 6 + 1),
}));

const PRIORITY_COLORS: Record<string, string> = {
  Highest: "#ef4444", High: "#f97316",
  Medium:  "#f59e0b", Low: "#22c55e", Lowest: "#6b7280",
};
const STATUS_COLORS: Record<string, string> = {
  "In Progress": "#3b82f6", "To Do": "#6b7280",
  "Done": "#22c55e",   "In Review": "#f59e0b",
};

function KpiCard({ label, value, sub, icon }: {
  label: string; value: number; sub: string; icon: React.ReactNode;
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
      className="tilt-card rounded-xl p-5 border"
      style={{ background: "var(--jira-bg)", borderColor: ACCENT + "33" }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: ACCENT }}>{label}</span>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: ACCENT + "22", color: ACCENT }}>
          {icon}
        </div>
      </div>
      <p className="text-3xl font-bold mb-1" style={{ color: "var(--text)" }}>{value}</p>
      <p className="text-xs" style={{ color: "var(--text-3)" }}>{sub}</p>
    </div>
  );
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-4 py-3 text-sm border" style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-md)" }}>
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

export function JiraPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["my-profile"],
    queryFn: authApi.getMyProfile,
  });
  const [tab, setTab] = useState<"open" | "resolved">("open");
  const jira = data?.apps?.jira;

  if (isLoading) {
    return (
      <div className="p-6 grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 rounded-xl animate-pulse" style={{ background: "var(--surface)" }} />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--jira-bg)" }}>
          <JiraIcon className="w-5 h-5" style={{ color: ACCENT }} />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>Jira</h1>
          <p className="text-xs" style={{ color: "var(--text-3)" }}>Issues & sprint tracking</p>
        </div>
        <span
          className="ml-auto text-xs px-3 py-1 rounded-full font-semibold"
          style={
            jira?.connected
              ? { background: "#22c55e20", color: "#22c55e" }
              : { background: "var(--surface-2)", color: "var(--text-3)" }
          }
        >
          {jira?.connected ? "● Connected" : "Not connected"}
        </span>
      </div>

      {!jira?.connected && (
        <div className="rounded-xl border p-8 text-center" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <JiraIcon className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--text-3)" }} />
          <p className="font-semibold mb-1" style={{ color: "var(--text)" }}>Jira not connected</p>
          <p className="text-sm" style={{ color: "var(--text-3)" }}>
            Ask your admin to configure Jira credentials in the organization settings.
          </p>
        </div>
      )}

      {jira?.connected && (
        <>
          {/* Profile card */}
          {jira.profile && (
            <div className="rounded-xl border p-5 flex items-center gap-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              {jira.profile.avatar && (
                <img src={jira.profile.avatar} alt={jira.profile.display_name}
                  className="w-12 h-12 rounded-full border-2"
                  style={{ borderColor: ACCENT + "44" }}
                />
              )}
              <div>
                <p className="font-semibold" style={{ color: "var(--text)" }}>{jira.profile.display_name}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>{jira.profile.email}</p>
              </div>
              <div className="ml-auto flex items-center gap-1.5 text-xs" style={{ color: "#22c55e" }}>
                <CheckCircle className="w-4 h-4" /> Linked via SSO
              </div>
            </div>
          )}

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard label="Open issues" value={jira.open_issues?.length ?? 0}       sub="assigned to you"  icon={<AlertCircle className="w-3.5 h-3.5" />} />
            <KpiCard label="Resolved"    value={jira.recently_resolved?.length ?? 0}  sub="recently closed"  icon={<CheckCircle className="w-3.5 h-3.5" />} />
            <KpiCard label="This week"   value={CHART_DATA.reduce((a,d) => a+d.created,0)} sub="created"   icon={<TrendingUp className="w-3.5 h-3.5" />} />
            <KpiCard label="Comments"    value={CHART_DATA.reduce((a,d) => a+d.comments,0)} sub="this week" icon={<BarChart2 className="w-3.5 h-3.5" />} />
          </div>

          {/* Chart */}
          <div className="rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text)" }}>Issue activity this week</h2>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={CHART_DATA} barSize={12} barCategoryGap="35%">
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="4 2" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--text-3)" }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--surface-2)" }} />
                <Legend iconType="circle" iconSize={7} formatter={(v) => <span style={{ color: "var(--text-2)", fontSize: 11 }}>{v}</span>} />
                <Bar dataKey="created"  fill="#2563eb" radius={[4,4,0,0]} />
                <Bar dataKey="resolved" fill="#22c55e" radius={[4,4,0,0]} />
                <Bar dataKey="comments" fill="#f59e0b" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Issues list */}
          <div className="rounded-xl border overflow-hidden" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="flex items-center border-b px-5" style={{ borderColor: "var(--border)" }}>
              {(["open","resolved"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className="py-3.5 mr-5 text-sm font-medium border-b-2 transition-colors"
                  style={{
                    borderColor: tab === t ? ACCENT : "transparent",
                    color: tab === t ? ACCENT : "var(--text-3)",
                  }}
                >
                  {t === "open"
                    ? `Open (${jira.open_issues?.length ?? 0})`
                    : `Resolved (${jira.recently_resolved?.length ?? 0})`}
                </button>
              ))}
            </div>

            {(tab === "open" ? jira.open_issues : jira.recently_resolved)?.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-sm" style={{ color: "var(--text-3)" }}>
                  {tab === "open" ? "No open issues — nice work!" : "No resolved issues found."}
                </p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                {(tab === "open" ? jira.open_issues : jira.recently_resolved)?.map((issue: any, i: number) => (
                  <a
                    key={i}
                    href={issue.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-4 px-5 py-4 transition-colors hover:bg-[var(--surface-2)]"
                  >
                    <div
                      className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0"
                      style={{ background: PRIORITY_COLORS[issue.priority] ?? "#6b7280" }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium" style={{ color: "var(--text)" }}>{issue.summary}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="text-[10px] font-medium" style={{ color: ACCENT }}>{issue.key}</code>
                        {issue.status && (
                          <span
                            className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                            style={{
                              background: (STATUS_COLORS[issue.status] ?? "#6b7280") + "20",
                              color: STATUS_COLORS[issue.status] ?? "#6b7280",
                            }}
                          >
                            {issue.status}
                          </span>
                        )}
                        {issue.type && (
                          <span className="text-[10px]" style={{ color: "var(--text-3)" }}>{issue.type}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {issue.priority && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                          style={{
                            background: (PRIORITY_COLORS[issue.priority] ?? "#6b7280") + "20",
                            color: PRIORITY_COLORS[issue.priority] ?? "#6b7280",
                          }}
                        >
                          {issue.priority}
                        </span>
                      )}
                      <ExternalLink className="w-3.5 h-3.5" style={{ color: "var(--text-3)" }} />
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function JiraIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2L2 12l4 4 6-6 6 6 4-4L12 2z" opacity="0.4" />
      <path d="M12 6.5L7 12l5 5 5-5-5-5.5z" />
    </svg>
  );
}
