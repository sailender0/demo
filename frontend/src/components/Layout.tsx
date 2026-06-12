import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Plug, Users, Activity, Shield, LogOut, GitBranch } from "lucide-react";
import type { User } from "../types";

interface LayoutProps {
  user: User;
  children: React.ReactNode;
  onLogout: () => void;
}

const adminNav = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/integrations", label: "Integrations", icon: Plug },
  { to: "/admin/identity", label: "Identity", icon: Shield },
  { to: "/admin/sync", label: "Sync Health", icon: Activity },
  { to: "/admin/users", label: "Users", icon: Users },
];

const employeeNav = [
  { to: "/dashboard", label: "My Activity", icon: Activity },
  { to: "/dashboard/team", label: "Team", icon: Users },
];

export function Layout({ user, children, onLogout }: LayoutProps) {
  const location = useLocation();
  const isAdmin = user.role === "admin";
  const nav = isAdmin ? adminNav : employeeNav;

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <GitBranch className="w-6 h-6 text-brand-600" />
            <span className="font-semibold text-gray-900 text-sm">Enterprise Platform</span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {nav.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to || (to !== "/admin" && to !== "/dashboard" && location.pathname.startsWith(to));
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                  ${active ? "bg-brand-50 text-brand-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"}`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-gray-100">
          <div className="flex items-center gap-3 px-3 py-2 mb-1">
            <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 text-sm font-semibold">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
              <p className="text-xs text-gray-500 capitalize">{user.role}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
