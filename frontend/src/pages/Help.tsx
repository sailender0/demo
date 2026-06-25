import {
  LayoutDashboard, CalendarDays, FileText, Sparkles,
  Github, GitlabIcon, MessageSquare, HelpCircle,
  ExternalLink, Keyboard, Moon, Zap,
} from "lucide-react";

const SECTIONS = [
  {
    id: "pages",
    title: "Navigation",
    icon: <LayoutDashboard className="w-4 h-4" />,
    items: [
      { label: "Overview",  icon: <LayoutDashboard className="w-3.5 h-3.5" />, desc: "Cross-source KPI cards, weekly activity chart, and live event feed" },
      { label: "My Day",    icon: <CalendarDays className="w-3.5 h-3.5" />,    desc: "Daily breakdown with calendar nav, AI summary, stats, and full timeline" },
      { label: "Digest",    icon: <FileText className="w-3.5 h-3.5" />,        desc: "Weekly AI-generated summaries with activity breakdowns and PDF export" },
      { label: "Ask AI",    icon: <Sparkles className="w-3.5 h-3.5" />,        desc: "Chat interface to query your activity in natural language" },
    ],
  },
  {
    id: "connectors",
    title: "Connectors",
    icon: <Github className="w-4 h-4" />,
    items: [
      { label: "GitHub",  icon: <Github className="w-3.5 h-3.5" />,       desc: "Tracks commits, pull requests, and code reviews. Connected via org SAML SSO or public email." },
      { label: "GitLab",  icon: <GitlabIcon className="w-3.5 h-3.5" />,   desc: "Tracks commits, merge requests, issues, and pipelines. Coming soon." },
      { label: "Jira",    icon: <JiraIcon />,                              desc: "Tracks open and resolved issues using your organization's Jira API token." },
      { label: "Teams",   icon: <MessageSquare className="w-3.5 h-3.5" />,desc: "Tracks presence, joined teams, and meetings via Microsoft Graph API (client credentials)." },
    ],
  },
  {
    id: "theme",
    title: "Theme & appearance",
    icon: <Moon className="w-4 h-4" />,
    items: [
      { label: "Light mode",  icon: <span className="w-3.5 h-3.5 text-sm">☀️</span>, desc: "Classic light interface" },
      { label: "Dark mode",   icon: <span className="w-3.5 h-3.5 text-sm">🌙</span>, desc: "Easy on the eyes in low-light environments" },
      { label: "System mode", icon: <span className="w-3.5 h-3.5 text-sm">💻</span>, desc: "Follows your OS dark/light preference automatically" },
    ],
  },
  {
    id: "shortcuts",
    title: "Keyboard shortcuts",
    icon: <Keyboard className="w-4 h-4" />,
    items: [
      { label: "Ask AI", icon: <Sparkles className="w-3.5 h-3.5" />, desc: "Press Enter to send a message · Shift+Enter for a new line" },
      { label: "Sidebar", icon: <LayoutDashboard className="w-3.5 h-3.5" />, desc: "Click the collapse arrow to switch to icon-only sidebar mode" },
    ],
  },
];

function SectionCard({ section }: { section: typeof SECTIONS[0] }) {
  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: "var(--border)" }}>
        <span style={{ color: "var(--accent)" }}>{section.icon}</span>
        <h2 className="text-sm font-semibold" style={{ color: "var(--text)" }}>{section.title}</h2>
      </div>
      <div className="divide-y" style={{ borderColor: "var(--border)" }}>
        {section.items.map(({ label, icon, desc }) => (
          <div key={label} className="flex items-start gap-3 px-5 py-4">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
            >
              {icon}
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--text)" }}>{label}</p>
              <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--text-2)" }}>{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HelpPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: "var(--accent-soft)" }}
        >
          <HelpCircle className="w-6 h-6" style={{ color: "var(--accent)" }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>Help & Documentation</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-2)" }}>
            Everything you need to know about DevTracker
          </p>
        </div>
      </div>

      {/* Quick links */}
      <div
        className="rounded-xl border p-5"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4" style={{ color: "var(--accent)" }} />
          <h2 className="text-sm font-semibold" style={{ color: "var(--text)" }}>Quick start</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: "1. Log in",          desc: "Sign in with your Microsoft account (Entra ID / Azure AD)" },
            { label: "2. Check Overview",  desc: "See your cross-tool KPI summary and weekly activity chart" },
            { label: "3. Ask AI",          desc: "Use the Ask AI page to query your activity in plain English" },
          ].map(({ label, desc }) => (
            <div
              key={label}
              className="p-4 rounded-xl border"
              style={{ background: "var(--accent-soft)", borderColor: "var(--accent)" + "33" }}
            >
              <p className="text-sm font-semibold mb-1" style={{ color: "var(--accent)" }}>{label}</p>
              <p className="text-xs leading-relaxed" style={{ color: "var(--text-2)" }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {SECTIONS.map((s) => (
          <SectionCard key={s.id} section={s} />
        ))}
      </div>

      {/* Footer */}
      <div
        className="rounded-xl border p-5 flex items-center justify-between"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>Need more help?</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>
            Contact your admin or file an issue on GitHub
          </p>
        </div>
        <a
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors hover:bg-[var(--surface-2)]"
          style={{ borderColor: "var(--border)", color: "var(--text-2)" }}
        >
          <Github className="w-4 h-4" /> Open issue <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}

function JiraIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2L2 12l4 4 6-6 6 6 4-4L12 2z" opacity="0.4" />
      <path d="M12 6.5L7 12l5 5 5-5-5-5.5z" />
    </svg>
  );
}
