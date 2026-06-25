import { useRef, MouseEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { authApi } from "../../api/client";
import {
  Users, CheckCircle, MessageSquare, Calendar, Video, TrendingUp,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";

const ACCENT = "var(--teams)";

const WEEK = ["Mon","Tue","Wed","Thu","Fri"];
const CHART_DATA = WEEK.map((day) => ({
  day,
  messages:  Math.floor(Math.random() * 20 + 5),
  meetings:  Math.floor(Math.random() * 3),
}));

const PRESENCE_STYLES: Record<string, { dot: string; label: string; bg: string }> = {
  Available:    { dot: "#22c55e", label: "Available",      bg: "#22c55e20" },
  Busy:         { dot: "#ef4444", label: "Busy",           bg: "#ef444420" },
  DoNotDisturb: { dot: "#ef4444", label: "Do Not Disturb", bg: "#ef444420" },
  Away:         { dot: "#f59e0b", label: "Away",           bg: "#f59e0b20" },
  BeRightBack:  { dot: "#f59e0b", label: "Be Right Back",  bg: "#f59e0b20" },
  Offline:      { dot: "#6b7280", label: "Offline",        bg: "#6b728020" },
};

/* ── mock meetings ────────────────────────────────── */
const MOCK_MEETINGS = [
  { title: "Daily standup",          channel: "Engineering", time: "10:00", duration: "30m", type: "recurring" },
  { title: "Sprint planning",        channel: "Engineering", time: "14:00", duration: "90m", type: "one-time" },
  { title: "Product sync",           channel: "Product",     time: "11:30", duration: "45m", type: "recurring" },
  { title: "1:1 with manager",       channel: "Direct",      time: "16:00", duration: "30m", type: "recurring" },
];

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
      style={{ background: "var(--teams-bg)", borderColor: ACCENT + "33" }}
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

export function TeamsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["my-profile"],
    queryFn: authApi.getMyProfile,
  });

  const teams = data?.apps?.teams;

  if (isLoading) {
    return (
      <div className="p-6 grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 rounded-xl animate-pulse" style={{ background: "var(--surface)" }} />
        ))}
      </div>
    );
  }

  const presenceKey = teams?.presence?.availability ?? "Offline";
  const presenceStyle = PRESENCE_STYLES[presenceKey] ?? PRESENCE_STYLES.Offline;
  const totalMessages = CHART_DATA.reduce((a, d) => a + d.messages, 0);
  const totalMeetings = CHART_DATA.reduce((a, d) => a + d.meetings, 0);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--teams-bg)" }}>
          <TeamsIcon className="w-5 h-5" style={{ color: ACCENT }} />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>Microsoft Teams</h1>
          <p className="text-xs" style={{ color: "var(--text-3)" }}>Collaboration & meetings</p>
        </div>
        <span
          className="ml-auto text-xs px-3 py-1 rounded-full font-semibold"
          style={
            teams?.connected
              ? { background: "#22c55e20", color: "#22c55e" }
              : { background: "var(--surface-2)", color: "var(--text-3)" }
          }
        >
          {teams?.connected ? "● Connected" : "Not connected"}
        </span>
      </div>

      {!teams?.connected && (
        <div className="rounded-xl border p-8 text-center" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <TeamsIcon className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--text-3)" }} />
          <p className="font-semibold mb-1" style={{ color: "var(--text)" }}>Teams not connected</p>
          <p className="text-sm" style={{ color: "var(--text-3)" }}>
            Ask your admin to grant Microsoft Teams permissions in Azure Portal.
          </p>
        </div>
      )}

      {teams?.connected && (
        <>
          {/* Profile + Presence */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 rounded-xl border p-5 flex items-start gap-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold text-white flex-shrink-0"
                style={{ background: ACCENT }}
              >
                {(teams.profile?.display_name ?? "U").charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold" style={{ color: "var(--text)" }}>{teams.profile?.display_name}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>{teams.profile?.job_title}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>{teams.profile?.department}</p>
                {teams.profile?.email && (
                  <p className="text-xs mt-1" style={{ color: "var(--text-2)" }}>{teams.profile.email}</p>
                )}
              </div>
              <div className="ml-auto flex items-center gap-1.5 text-xs" style={{ color: "#22c55e" }}>
                <CheckCircle className="w-4 h-4" /> Linked via SSO
              </div>
            </div>

            {/* Presence */}
            <div className="rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-3)" }}>Current Presence</p>
              <div className="flex items-center gap-3 mb-4">
                <span
                  className="w-4 h-4 rounded-full pulse-green flex-shrink-0"
                  style={{ background: presenceStyle.dot, animation: presenceKey === "Available" ? undefined : "none" }}
                />
                <span
                  className="text-sm font-semibold px-2.5 py-1 rounded-lg"
                  style={{ background: presenceStyle.bg, color: presenceStyle.dot }}
                >
                  {presenceStyle.label}
                </span>
              </div>
              {teams.presence?.activity && (
                <p className="text-xs" style={{ color: "var(--text-3)" }}>
                  Activity: {teams.presence.activity}
                </p>
              )}
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard label="Teams"    value={teams.teams?.length ?? 0} sub="joined"        icon={<Users className="w-3.5 h-3.5" />} />
            <KpiCard label="Messages" value={totalMessages}            sub="this week"     icon={<MessageSquare className="w-3.5 h-3.5" />} />
            <KpiCard label="Meetings" value={totalMeetings}            sub="this week"     icon={<Video className="w-3.5 h-3.5" />} />
            <KpiCard label="Trend"    value={`+${Math.floor(Math.random() * 20 + 5)}%`}   sub="vs last week" icon={<TrendingUp className="w-3.5 h-3.5" />} />
          </div>

          {/* Activity chart */}
          <div className="rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text)" }}>Activity trend this week</h2>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={CHART_DATA}>
                <defs>
                  <linearGradient id="msgsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#7c3aed" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="mtgGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="4 2" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--text-3)" }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip content={<ChartTooltip />} />
                <Area dataKey="messages" stroke="#7c3aed" fill="url(#msgsGrad)" strokeWidth={2} dot={false} />
                <Area dataKey="meetings" stroke="#22c55e" fill="url(#mtgGrad)"  strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Teams list + meetings */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Teams */}
            <div className="rounded-xl border overflow-hidden" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: "var(--border)" }}>
                <Users className="w-4 h-4" style={{ color: ACCENT }} />
                <h2 className="text-sm font-semibold" style={{ color: "var(--text)" }}>Joined Teams</h2>
                <span
                  className="ml-auto text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ background: ACCENT + "20", color: ACCENT }}
                >
                  {teams.teams?.length ?? 0}
                </span>
              </div>
              {!teams.teams?.length ? (
                <div className="px-5 py-8 text-center">
                  <p className="text-sm" style={{ color: "var(--text-3)" }}>No teams found</p>
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                  {teams.teams.map((t: any, i: number) => (
                    <div key={i} className="flex items-start gap-3 px-5 py-3.5">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                        style={{ background: ACCENT }}
                      >
                        {t.name?.charAt(0).toUpperCase() ?? "T"}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium" style={{ color: "var(--text)" }}>{t.name}</p>
                        {t.description && (
                          <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-3)" }}>{t.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Mock meetings */}
            <div className="rounded-xl border overflow-hidden" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: "var(--border)" }}>
                <Calendar className="w-4 h-4" style={{ color: ACCENT }} />
                <h2 className="text-sm font-semibold" style={{ color: "var(--text)" }}>Today's meetings</h2>
              </div>
              <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                {MOCK_MEETINGS.map((m, i) => (
                  <div key={i} className="flex items-start gap-3 px-5 py-3.5">
                    <div className="text-xs tabular-nums w-10 pt-0.5 flex-shrink-0" style={{ color: "var(--text-3)" }}>
                      {m.time}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium" style={{ color: "var(--text)" }}>{m.title}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>#{m.channel} · {m.duration}</p>
                    </div>
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: ACCENT + "20", color: ACCENT }}
                    >
                      {m.type}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function TeamsIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor">
      <path d="M15 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
      <path d="M16.5 10.5h3a1.5 1.5 0 011.5 1.5v4h-2.5V13H16.5v-2.5z" opacity="0.6" />
      <path d="M8.5 10a3 3 0 100-6 3 3 0 000 6z" />
      <path d="M2 21v-2.5A6.5 6.5 0 0115 18.5V21H2z" />
    </svg>
  );
}
