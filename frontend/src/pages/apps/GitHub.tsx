import { useRef, MouseEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { authApi } from "../../api/client";
import {
  Github, GitPullRequest, GitCommit, ExternalLink,
  CheckCircle, Star, Users, TrendingUp,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";

const ACCENT = "var(--gh)";

/* ── mock chart ──────────────────────────────────── */
const WEEK = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const CHART_DATA = WEEK.map((day) => ({
  day,
  commits:  Math.floor(Math.random() * 8 + 1),
  prs:      Math.floor(Math.random() * 3),
  reviews:  Math.floor(Math.random() * 4),
}));

/* ── top repos mock ──────────────────────────────── */
const TOP_REPOS = [
  { name: "api-service",    commits: 24, prs: 6  },
  { name: "devtracker",     commits: 18, prs: 4  },
  { name: "frontend-app",   commits: 11, prs: 3  },
  { name: "infra-scripts",  commits: 7,  prs: 1  },
];

/* ── KPI card ─────────────────────────────────────── */
function KpiCard({ label, value, sub, icon }: {
  label: string; value: number | string; sub: string; icon: React.ReactNode;
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
      style={{ background: "var(--gh-bg)", borderColor: ACCENT + "33" }}
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
          <span className="w-2 h-2 rounded-full" style={{ background: p.stroke }} />
          <span style={{ color: "var(--text-2)" }}>{p.name}</span>
          <span className="ml-auto font-medium" style={{ color: "var(--text)" }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ── page ─────────────────────────────────────────── */
export function GitHubPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["my-profile"],
    queryFn: authApi.getMyProfile,
  });

  const gh = data?.apps?.github;

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
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--gh-bg)" }}>
          <Github className="w-5 h-5" style={{ color: ACCENT }} />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>GitHub</h1>
          <p className="text-xs" style={{ color: "var(--text-3)" }}>Code activity & pull requests</p>
        </div>
        <span
          className="ml-auto text-xs px-3 py-1 rounded-full font-semibold"
          style={
            gh?.connected
              ? { background: "#22c55e20", color: "#22c55e" }
              : { background: "var(--surface-2)", color: "var(--text-3)" }
          }
        >
          {gh?.connected ? "● Connected" : "Not connected"}
        </span>
      </div>

      {!gh?.connected && (
        <div
          className="rounded-xl border p-8 text-center"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          <Github className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--text-3)" }} />
          <p className="font-semibold mb-1" style={{ color: "var(--text)" }}>GitHub not connected</p>
          <p className="text-sm" style={{ color: "var(--text-3)" }}>
            Ask your admin to configure the GitHub integration for your organization.
          </p>
        </div>
      )}

      {gh?.connected && (
        <>
          {/* Profile banner */}
          <div
            className="rounded-xl border p-5 flex items-center gap-4"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}
          >
            {gh.profile.avatar && (
              <img src={gh.profile.avatar} alt={gh.profile.name}
                className="w-14 h-14 rounded-full border-2"
                style={{ borderColor: ACCENT + "44" }}
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold" style={{ color: "var(--text)" }}>
                {gh.profile.name || gh.profile.login}
              </p>
              <a
                href={gh.profile.profile_url} target="_blank" rel="noopener noreferrer"
                className="text-sm flex items-center gap-1 hover:underline"
                style={{ color: ACCENT }}
              >
                @{gh.profile.login} <ExternalLink className="w-3 h-3" />
              </a>
              <div className="flex gap-4 mt-1.5 text-xs" style={{ color: "var(--text-3)" }}>
                <span className="flex items-center gap-1"><Star className="w-3 h-3" /> {gh.profile.public_repos} repos</span>
                <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {gh.profile.followers} followers</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs" style={{ color: "#22c55e" }}>
              <CheckCircle className="w-4 h-4" /> Linked via SSO
            </div>
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard label="Open PRs"   value={gh.recent_prs?.length ?? 0}    sub="awaiting review"  icon={<GitPullRequest className="w-3.5 h-3.5" />} />
            <KpiCard label="Commits"    value={gh.recent_commits?.length ?? 0} sub="this week"        icon={<GitCommit className="w-3.5 h-3.5" />} />
            <KpiCard label="Reviews"    value={CHART_DATA.reduce((a,d) => a+d.reviews,0)} sub="this week" icon={<TrendingUp className="w-3.5 h-3.5" />} />
            <KpiCard label="Repos"      value={gh.profile.public_repos ?? 0}  sub="public"           icon={<Github className="w-3.5 h-3.5" />} />
          </div>

          {/* Chart + Top repos */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold" style={{ color: "var(--text)" }}>Activity trend</h2>
                <span className="text-xs flex items-center gap-1" style={{ color: "var(--text-3)" }}>
                  <TrendingUp className="w-3.5 h-3.5" /> This week
                </span>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={CHART_DATA}>
                  <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="4 2" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--text-3)" }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend iconType="circle" iconSize={7} formatter={(v) => <span style={{ color: "var(--text-2)", fontSize: 11 }}>{v}</span>} />
                  <Line dataKey="commits" stroke={ACCENT}       strokeWidth={2} dot={false} />
                  <Line dataKey="prs"     stroke="#22c55e"      strokeWidth={2} dot={false} />
                  <Line dataKey="reviews" stroke="var(--accent)" strokeWidth={2} dot={false} strokeDasharray="4 2" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text)" }}>Top repositories</h2>
              <div className="space-y-3">
                {TOP_REPOS.map((r) => (
                  <div key={r.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium truncate" style={{ color: "var(--text-2)" }}>{r.name}</span>
                      <span className="text-xs" style={{ color: ACCENT }}>{r.commits} commits</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${(r.commits / TOP_REPOS[0].commits) * 100}%`, background: ACCENT }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* PRs + Commits */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* PRs */}
            <div className="rounded-xl border overflow-hidden" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: "var(--border)" }}>
                <GitPullRequest className="w-4 h-4" style={{ color: ACCENT }} />
                <h2 className="text-sm font-semibold" style={{ color: "var(--text)" }}>Open Pull Requests</h2>
                <span
                  className="ml-auto text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ background: ACCENT + "20", color: ACCENT }}
                >
                  {gh.recent_prs?.length ?? 0}
                </span>
              </div>
              {!gh.recent_prs?.length ? (
                <div className="px-5 py-8 text-center">
                  <p className="text-sm" style={{ color: "var(--text-3)" }}>No open pull requests</p>
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                  {gh.recent_prs.map((pr: any, i: number) => (
                    <a
                      key={i}
                      href={pr.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-[var(--surface-2)]"
                    >
                      <GitPullRequest className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#22c55e" }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>{pr.title}</p>
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>#{pr.number} · {pr.repo}</p>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: "var(--text-3)" }} />
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Commits */}
            <div className="rounded-xl border overflow-hidden" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: "var(--border)" }}>
                <GitCommit className="w-4 h-4" style={{ color: ACCENT }} />
                <h2 className="text-sm font-semibold" style={{ color: "var(--text)" }}>Recent Commits</h2>
              </div>
              {!gh.recent_commits?.length ? (
                <div className="px-5 py-8 text-center">
                  <p className="text-sm" style={{ color: "var(--text-3)" }}>No recent commits</p>
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                  {gh.recent_commits.map((c: any, i: number) => (
                    <a
                      key={i}
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-[var(--surface-2)]"
                    >
                      <GitCommit className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: ACCENT }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>{c.message}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <code className="text-[10px]" style={{ color: "var(--text-3)" }}>{c.sha}</code>
                          <span style={{ color: "var(--border-2)" }}>·</span>
                          <span className="text-xs" style={{ color: "var(--text-3)" }}>{c.repo}</span>
                        </div>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: "var(--text-3)" }} />
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
