import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { GitBranch, Shield, Zap, Users } from "lucide-react";
import { authApi } from "../api/client";

export function LoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  useEffect(() => {
    const token = params.get("token");
    if (token) {
      localStorage.setItem("access_token", token);
      navigate("/", { replace: true });
    }
  }, [params, navigate]);

  const handleLogin = () => {
    window.location.href = authApi.getLoginUrl();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 mb-4">
            <GitBranch className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Enterprise Platform</h1>
          <p className="text-slate-400 mt-2 text-sm">Organization-level integration hub</p>
        </div>

        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-8 mb-6">
          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 bg-white text-slate-900 font-semibold py-3 px-4 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <img src="https://authjs.dev/img/providers/microsoft.svg" alt="" className="w-5 h-5" />
            Continue with Microsoft
          </button>
          <p className="text-center text-slate-500 text-xs mt-4">
            Sign in with your company Microsoft account
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4 text-center">
          {[
            { icon: Shield, label: "SSO only" },
            { icon: Zap, label: "Zero setup" },
            { icon: Users, label: "Team-wide" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="text-slate-400">
              <Icon className="w-5 h-5 mx-auto mb-1 text-blue-400" />
              <span className="text-xs">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
