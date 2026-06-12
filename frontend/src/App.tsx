import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/Login";
import { AdminDashboard } from "./pages/admin/Dashboard";
import { IntegrationsPage } from "./pages/admin/Integrations";
import { IdentityPage } from "./pages/admin/Identity";
import { SyncHealthPage } from "./pages/admin/SyncHealth";
import { UsersPage } from "./pages/admin/Users";
import { EmployeeDashboard } from "./pages/employee/Dashboard";

function AuthSuccess() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  if (token) localStorage.setItem("access_token", token);
  return <Navigate to="/" replace />;
}

function AppRoutes() {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/success" element={<AuthSuccess />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  const isAdmin = user.role === "admin";

  return (
    <Layout user={user} onLogout={logout}>
      <Routes>
        <Route path="/" element={<Navigate to={isAdmin ? "/admin" : "/dashboard"} replace />} />
        <Route path="/auth/success" element={<AuthSuccess />} />

        {/* Admin routes */}
        {isAdmin && (
          <>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/integrations" element={<IntegrationsPage />} />
            <Route path="/admin/identity" element={<IdentityPage />} />
            <Route path="/admin/sync" element={<SyncHealthPage />} />
            <Route path="/admin/users" element={<UsersPage />} />
          </>
        )}

        {/* Employee routes */}
        <Route path="/dashboard" element={<EmployeeDashboard />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
