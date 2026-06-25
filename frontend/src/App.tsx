import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/Login";
import { Overview } from "./pages/Overview";
import { MyDayPage } from "./pages/MyDay";
import { DigestPage } from "./pages/Digest";
import { AskAIPage } from "./pages/AskAI";
import { GitHubPage } from "./pages/apps/GitHub";
import { GitLabPage } from "./pages/apps/GitLab";
import { JiraPage } from "./pages/apps/Jira";
import { TeamsPage } from "./pages/apps/Teams";
import { HelpPage } from "./pages/Help";

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
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--bg)" }}
      >
        <div
          className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: "var(--accent)" }}
        />
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

  return (
    <Layout user={user} onLogout={logout}>
      <Routes>
        <Route path="/" element={<Overview />} />
        <Route path="/my-day" element={<MyDayPage />} />
        <Route path="/digest" element={<DigestPage />} />
        <Route path="/ask-ai" element={<AskAIPage />} />
        <Route path="/apps/github" element={<GitHubPage />} />
        <Route path="/apps/gitlab" element={<GitLabPage />} />
        <Route path="/apps/jira" element={<JiraPage />} />
        <Route path="/apps/teams" element={<TeamsPage />} />
        <Route path="/help" element={<HelpPage />} />
        <Route path="/auth/success" element={<AuthSuccess />} />
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
