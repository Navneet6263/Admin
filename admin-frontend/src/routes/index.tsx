import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  Command, Building2, Lock, Mail, Eye, EyeOff, Sparkles, CheckCircle2,
  AlertCircle, ArrowRight, ShieldCheck
} from "lucide-react";
import { companies, GROUP } from "@/components/company";
import { session } from "@/lib/api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in — RequestHub · Vision India Enterprise" },
      { name: "description", content: "Enterprise Login Console for RequestHub — Manage Approvals, Finance, Inventory & Operations." },
    ],
  }),
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("spoken.3764@gmail.com");
  const [password, setPassword] = useState("navneet");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Please fill in both work email and password.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const user = await session.login(email.trim(), password.trim());
      const target = user.role === 'super_admin' ? '/super-admin' : `/${user.role}`;
      void navigate({ to: target as '/admin' });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070c14] text-slate-100 font-sans flex flex-col relative overflow-hidden select-none">
      {/* Dynamic ambient background glow */}
      <div className="absolute -top-48 -left-48 w-[650px] h-[650px] bg-gradient-to-br from-indigo-600/20 via-purple-600/10 to-transparent rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute -bottom-48 -right-48 w-[700px] h-[700px] bg-gradient-to-tl from-emerald-600/15 via-teal-600/10 to-transparent rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 px-6 sm:px-10 py-5 flex items-center justify-between border-b border-white/10 backdrop-blur-md bg-slate-950/40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 p-0.5 shadow-lg shadow-indigo-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[10px] grid place-items-center">
              <Command className="w-4 h-4 text-indigo-400" strokeWidth={2.5} />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-base tracking-tight text-white">RequestHub</span>
              <span className="px-2 py-0.5 text-[9px] font-mono font-medium rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                v2.6 Enterprise
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">Vision India Group · Enterprise Management Console</p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-4 text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" /> SQL Server Online
          </span>
          <span className="flex items-center gap-1.5 text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" /> 256-bit Encrypted
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-6 py-12">
        <div className="w-full max-w-5xl">
          {/* Headline */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-4 text-xs font-medium text-slate-300 shadow-inner">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" style={{ animationDuration: '6s' }} />
              <span>Unified Enterprise Workflow System</span>
            </div>
            <h1 className="font-display text-3xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
              Sign in to RequestHub
            </h1>
            <p className="text-slate-400 mt-3 text-sm max-w-lg mx-auto leading-relaxed">
              Enterprise credentials login for Super Admin, Admin, Finance, Verifier, and Employee.
            </p>
          </div>

          {/* Pure Credentials Login Card */}
          <div className="max-w-md mx-auto">
            <div className="bg-slate-900/70 border border-white/10 backdrop-blur-xl rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500" />
              
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-white font-display">Account Login</h2>
                <p className="text-xs text-slate-400 mt-1">Enter your registered work email and password</p>
              </div>

              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1.5 uppercase tracking-wider">Work Email</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. spoken.3764@gmail.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-950/60 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1.5 uppercase tracking-wider">Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-950/60 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-3 text-slate-400 hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 text-white font-semibold text-xs shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      Sign In to Console <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400">
                <span>SQL Server Authenticated</span>
                <span className="text-slate-500 font-mono text-[10px]">Vision India Enterprise</span>
              </div>
            </div>
          </div>

          {/* Group Entities Footer */}
          <div className="mt-12 max-w-3xl mx-auto">
            <div className="flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest text-slate-500 mb-3">
              <Building2 className="w-3.5 h-3.5" /> {GROUP.name} · Sub-Entities
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {companies.map((c) => (
                <div key={c.code} className="bg-slate-900/40 border border-white/5 rounded-xl p-3 text-center backdrop-blur-md">
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">{c.code}</span>
                  <p className="text-xs font-semibold text-white mt-1 truncate">{c.name}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{c.teams.length} Teams Configured</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
