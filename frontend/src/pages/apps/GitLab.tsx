import { useRef, MouseEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { authApi } from "../../api/client";
import { GitlabIcon, GitMerge, GitCommit, ExternalLink, CheckCircle, TrendingUp, Users } from "lucide-react";

const ACCENT = "var(--gl)";

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
      style={{ background: "var(--gl-bg)", borderColor: ACCENT + "33" }}
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

export function GitLabPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["my-profile"],
    queryFn: authApi.getMyProfile,
  });

  const gl = data?.apps?.gitlab;

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
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--gl-bg)" }}>
          <GitlabIcon className="w-5 h-5" style={{ color: ACCENT }} />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>GitLab</h1>
          <p className="text-xs" style={{ color: "var(--text-3)" }}>Merge requests & commits</p>
        </div>
        <span
          className="ml-auto text-xs px-3 py-1 rounded-full font-semibold"
          style={
            gl?.connected
              ? { background: "#22c55e20", color: "#22c55e" }
              : { background: "var(--surface-2)", color: "var(--text-3)" }
          }
        >
          {gl?.connected ? "● Connected" : "Not connected"}
        </span>
      </div>

      {!gl?.connected && (
        <div className="rounded-xl border p-8 text-center" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <GitlabIcon className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--text-3)" }} />
          <p className="font-semibold mb-1" style={{ color: "var(--text)" }}>No permission</p>
        </div>
      )}

      {gl?.connected && (
        <>
          {/* Profile */}
          <div className="rounded-xl border p-5 flex items-center gap-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            {gl.profile.avatar && (
              <img src={gl.profile.avatar} alt={gl.profile.name}
                className="w-14 h-14 rounded-full border-2"
                style={{ borderColor: ACCENT + "44" }}
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold" style={{ color: "var(--text)" }}>{gl.profile.name}</p>
              <a href={gl.profile.profile_url} target="_blank" rel="noopener noreferrer"
                className="text-sm flex items-center gap-1 hover:underline"
                style={{ color: ACCENT }}
              >
                @{gl.profile.username} <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="flex items-center gap-1.5 text-xs" style={{ color: "#22c55e" }}>
              <CheckCircle className="w-4 h-4" /> Linked via SSO
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard label="Open MRs"  value={gl.open_mrs?.length ?? 0}      sub="merge requests"  icon={<GitMerge className="w-3.5 h-3.5" />} />
            <KpiCard label="Commits"   value={gl.recent_commits?.length ?? 0} sub="recent"          icon={<GitCommit className="w-3.5 h-3.5" />} />
            <KpiCard label="Activity"  value={gl.open_mrs?.length ?? 0}       sub="this week"       icon={<TrendingUp className="w-3.5 h-3.5" />} />
            <KpiCard label="Reviewers" value={0}                              sub="awaiting you"    icon={<Users className="w-3.5 h-3.5" />} />
          </div>

          {/* MRs + Commits */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: "var(--border)" }}>
                <GitMerge className="w-4 h-4" style={{ color: ACCENT }} />
                <h2 className="font-semibold text-sm" style={{ color: "var(--text)" }}>Open Merge Requests</h2>
                {gl.open_mrs?.length > 0 && (
                  <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: ACCENT + "20", color: ACCENT }}>
                    {gl.open_mrs.length}
                  </span>
                )}
              </div>
              {!gl.open_mrs?.length ? (
                <div className="px-5 py-8 text-center text-sm" style={{ color: "var(--text-3)" }}>
                  No open merge requests
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                  {gl.open_mrs.map((mr: any, i: number) => (
                    <div key={i} className="px-5 py-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <a href={mr.url} target="_blank" rel="noopener noreferrer"
                          className="text-sm font-medium hover:underline truncate block"
                          style={{ color: "var(--text)" }}>
                          {mr.title}
                        </a>
                        <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-3)" }}>
                          !{mr.iid}{mr.repo ? ` · ${mr.repo}` : ""}
                        </p>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap flex-shrink-0"
                        style={{ background: "#22c55e20", color: "#22c55e" }}>
                        open
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: "var(--border)" }}>
                <GitCommit className="w-4 h-4" style={{ color: ACCENT }} />
                <h2 className="font-semibold text-sm" style={{ color: "var(--text)" }}>Recent Commits</h2>
              </div>
              {!gl.recent_commits?.length ? (
                <div className="px-5 py-8 text-center text-sm" style={{ color: "var(--text-3)" }}>
                  No recent commits
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                  {gl.recent_commits.map((c: any, i: number) => (
                    <div key={i} className="px-5 py-3">
                      <a href={c.url} target="_blank" rel="noopener noreferrer"
                        className="text-sm font-medium hover:underline truncate block"
                        style={{ color: "var(--text)" }}>
                        {c.message}
                      </a>
                      {c.repo && (
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>{c.repo}</p>
                      )}
                    </div>
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
