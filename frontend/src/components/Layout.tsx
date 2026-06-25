import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Sun, Cloud, CalendarDays, FileText,
  Sparkles, Github, GitlabIcon, LogOut, HelpCircle,
  ChevronLeft, ChevronRight, Monitor,
} from "lucide-react";
import type { User } from "../types";

/* ── theme ───────────────────────────────────────── */
type Theme = "light" | "dark" | "system";

function applyTheme(t: Theme) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = t === "dark" || (t === "system" && prefersDark);
  document.documentElement.classList.toggle("dark", dark);
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem("theme") as Theme) ?? "system";
  });

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  return { theme, setTheme };
}

/* ── nav config ───────────────────────────────────── */
const PRIMARY_NAV = [
  { to: "/", label: "Overview",   icon: LayoutDashboard },
  { to: "/my-day", label: "My Day",    icon: CalendarDays },
  { to: "/digest", label: "Digest",    icon: FileText },
  { to: "/ask-ai", label: "Ask AI",    icon: Sparkles },
];

const CONNECTOR_NAV = [
  { to: "/apps/github", label: "GitHub",  icon: Github,      accent: "var(--gh)" },
  { to: "/apps/gitlab", label: "GitLab",  icon: GitlabIcon,  accent: "var(--gl)" },
  { to: "/apps/jira",   label: "Jira",    icon: JiraIcon2,   accent: "var(--jira)" },
  { to: "/apps/teams",  label: "Teams",   icon: TeamsIcon2,  accent: "var(--teams)" },
];

/* ── props ────────────────────────────────────────── */
interface LayoutProps {
  user: User;
  children: React.ReactNode;
  onLogout: () => void;
}

/* ── Layout ───────────────────────────────────────── */
export function Layout({ user, children, onLogout }: LayoutProps) {
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(() =>
    localStorage.getItem("sidebar-collapsed") === "true"
  );

  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", String(collapsed));
  }, [collapsed]);

  function isActive(to: string) {
    if (to === "/") return location.pathname === "/";
    return location.pathname.startsWith(to);
  }

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg)" }}>
      {/* ── Sidebar ── */}
      <aside
        className="flex flex-col flex-shrink-0 border-r transition-all duration-200"
        style={{
          width: collapsed ? "var(--sidebar-collapsed)" : "var(--sidebar-w)",
          background: "var(--surface)",
          borderColor: "var(--border)",
        }}
      >
        {/* Logo + collapse toggle */}
        <div
          className="flex items-center border-b px-3 h-14 flex-shrink-0"
          style={{ borderColor: "var(--border)" }}
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "var(--accent)" }}
          >
            <span className="text-white text-xs font-bold">D</span>
          </div>
          {!collapsed && (
            <span
              className="ml-2.5 font-semibold text-sm truncate flex-1"
              style={{ color: "var(--text)" }}
            >
              DevTracker
            </span>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="ml-auto p-1 rounded-md transition-colors hover:bg-[var(--surface-2)]"
            style={{ color: "var(--text-3)" }}
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? (
              <ChevronRight className="w-3.5 h-3.5" />
            ) : (
              <ChevronLeft className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* Primary nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {PRIMARY_NAV.map(({ to, label, icon: Icon }) => {
            const active = isActive(to);
            return (
              <Link
                key={to}
                to={to}
                title={collapsed ? label : undefined}
                className="flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm font-medium transition-all duration-100"
                style={{
                  background: active ? "var(--accent-soft)" : "transparent",
                  color: active ? "var(--accent)" : "var(--text-2)",
                }}
                onMouseEnter={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = "var(--surface-2)";
                }}
                onMouseLeave={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {!collapsed && <span className="truncate">{label}</span>}
              </Link>
            );
          })}

          {/* Connectors section */}
          {!collapsed && (
            <p
              className="px-2.5 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: "var(--text-3)" }}
            >
              Connectors
            </p>
          )}
          {collapsed && (
            <div className="my-2 mx-2 h-px" style={{ background: "var(--border)" }} />
          )}

          {CONNECTOR_NAV.map(({ to, label, icon: Icon, accent }) => {
            const active = isActive(to);
            return (
              <Link
                key={to}
                to={to}
                title={collapsed ? label : undefined}
                className="flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm font-medium transition-all duration-100"
                style={{
                  background: active ? "var(--surface-2)" : "transparent",
                  color: active ? accent : "var(--text-2)",
                }}
                onMouseEnter={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = "var(--surface-2)";
                }}
                onMouseLeave={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                <Icon
                  className="w-4 h-4 flex-shrink-0"
                  style={{ color: active ? accent : undefined }}
                />
                {!collapsed && <span className="truncate">{label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Bottom: theme + help + user */}
        <div
          className="border-t px-2 py-3 space-y-1 flex-shrink-0"
          style={{ borderColor: "var(--border)" }}
        >
          {/* Theme toggle */}
          {!collapsed ? (
            <div
              className="flex items-center gap-1 p-1 rounded-lg mb-1"
              style={{ background: "var(--surface-2)" }}
            >
              {(["light", "system", "dark"] as Theme[]).map((t) => {
                const Icon = t === "light" ? Sun : t === "system" ? Monitor : Cloud;
                return (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    className="flex-1 flex items-center justify-center py-1 rounded-md text-xs transition-all"
                    style={{
                      background: theme === t ? "var(--surface)" : "transparent",
                      color: theme === t ? "var(--text)" : "var(--text-3)",
                      boxShadow: theme === t ? "var(--shadow)" : "none",
                    }}
                    title={t.charAt(0).toUpperCase() + t.slice(1)}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </button>
                );
              })}
            </div>
          ) : (
            <button
              onClick={() =>
                setTheme((p) =>
                  p === "light" ? "dark" : p === "dark" ? "system" : "light"
                )
              }
              className="w-full flex items-center justify-center py-2 rounded-lg transition-colors hover:bg-[var(--surface-2)]"
              style={{ color: "var(--text-3)" }}
              title={`Theme: ${theme}`}
            >
              {theme === "light" ? (
                <Sun className="w-4 h-4" />
              ) : theme === "dark" ? (
                <Cloud className="w-4 h-4" />
              ) : (
                <Monitor className="w-4 h-4" />
              )}
            </button>
          )}

          {/* Help */}
          <Link
            to="/help"
            title={collapsed ? "Help" : undefined}
            className="flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm transition-colors hover:bg-[var(--surface-2)]"
            style={{ color: "var(--text-2)" }}
          >
            <HelpCircle className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Help</span>}
          </Link>

          {/* User */}
          <div
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg"
            style={{ color: "var(--text-2)" }}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 text-white"
              style={{ background: "var(--accent)" }}
            >
              {initials}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p
                  className="text-xs font-medium truncate"
                  style={{ color: "var(--text)" }}
                >
                  {user.name}
                </p>
                <p className="text-[10px] truncate" style={{ color: "var(--text-3)" }}>
                  {user.email}
                </p>
              </div>
            )}
            {!collapsed && (
              <button
                onClick={onLogout}
                className="p-1 rounded-md transition-colors hover:bg-[var(--surface-2)]"
                style={{ color: "var(--text-3)" }}
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main
        className="flex-1 overflow-y-auto"
        style={{ background: "var(--bg)" }}
      >
        {children}
      </main>
    </div>
  );
}

/* ── icon stubs ───────────────────────────────────── */
function JiraIcon2({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2L2 12l4 4 6-6 6 6 4-4L12 2z" opacity="0.4" />
      <path d="M12 6.5L7 12l5 5 5-5-5-5.5z" />
    </svg>
  );
}

function TeamsIcon2({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor">
      <path d="M15 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
      <path d="M16.5 10.5h3a1.5 1.5 0 011.5 1.5v4h-2.5V13H16.5v-2.5z" opacity="0.6" />
      <path d="M8.5 10a3 3 0 100-6 3 3 0 000 6z" />
      <path d="M2 21v-2.5A6.5 6.5 0 0115 18.5V21H2z" />
    </svg>
  );
}
