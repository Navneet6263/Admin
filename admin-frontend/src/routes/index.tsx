import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { LayoutDashboard, Users, Wallet, BarChart3, ShieldCheck, ArrowRight, Command, Building2 } from "lucide-react";
import { companies, GROUP } from "@/components/company";
import { session } from "@/lib/api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in — RequestHub · Vision India" },
      { name: "description", content: "Choose your role to enter the RequestHub console — Admin, Employee, Finance, Verifier, or Super Admin." },
    ],
  }),
  component: Home,
});

const roles = [
  {
    to: "/admin" as const,
    label: "Admin Console",
    persona: "John Admin",
    id: "ADM-001",
    desc: "Approve, reject, escalate. Stage-1 gatekeeper for every request.",
    icon: LayoutDashboard,
    accent: "from-slate-800 to-slate-950",
  },
  {
    to: "/employee" as const,
    label: "Employee",
    persona: "Rahul Kumar",
    id: "EMP-1428",
    desc: "Raise requests — ID card, stationery, travel, meeting rooms.",
    icon: Users,
    accent: "from-sky-700 to-sky-900",
  },
  {
    to: "/verifier" as const,
    label: "Verifier",
    persona: "Sneha Iyer",
    id: "VER-007",
    desc: "Stage-2 claim check. Verify bills & delivery before closure.",
    icon: ShieldCheck,
    accent: "from-violet-700 to-violet-900",
  },
  {
    to: "/finance" as const,
    label: "Finance",
    persona: "Anjali Mehta",
    id: "FIN-014",
    desc: "Verify and release funds for approved financial requests.",
    icon: Wallet,
    accent: "from-emerald-700 to-emerald-900",
  },
  {
    to: "/super-admin" as const,
    label: "Super Admin",
    persona: "Vikram Rathore",
    id: "SA-001",
    desc: "Group insights across every sub-company — spend, people, anomalies.",
    icon: BarChart3,
    accent: "from-indigo-700 to-indigo-900",
  },
];

function Home() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@company.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const signIn = async (event: React.FormEvent) => {
    event.preventDefault(); setError("");
    try {
      const user = await session.login(email, password);
      const target = user.role === 'super_admin' ? '/super-admin' : `/${user.role}`;
      void navigate({ to: target as '/admin' });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Sign in failed'); }
  };
  return (
    <div className="min-h-screen bg-[#0b1220] text-slate-100 font-sans flex flex-col relative overflow-hidden">
      {/* Decorative gradient blobs */}
      <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-3xl" />

      <header className="relative z-10 px-6 py-5 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-white grid place-items-center">
            <Command className="w-4 h-4 text-slate-900" strokeWidth={2.5} />
          </div>
          <div>
            <p className="font-display font-semibold text-sm leading-none">RequestHub</p>
            <p className="text-[9px] uppercase tracking-widest text-slate-400 mt-1">Enterprise · v2.6</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Secure workspace · Vision India Pvt. Ltd.
        </div>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-6xl">
          <div className="text-center mb-8">
            <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400 mb-3">Choose your workspace</p>
            <h1 className="font-display text-3xl sm:text-4xl font-semibold">Sign in to continue</h1>
            <p className="text-slate-400 mt-3 text-sm max-w-md mx-auto">
              Each role opens its own console — no shared views, no clutter.
            </p>
          </div>

          <form onSubmit={signIn} className="max-w-md mx-auto mb-8 grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 rounded-xl border border-white/10 bg-white/5 p-3">
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" aria-label="Email" placeholder="Work email" className="rounded-md bg-white/10 border border-white/10 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-white/30" />
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" aria-label="Password" placeholder="Password" className="rounded-md bg-white/10 border border-white/10 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-white/30" />
            <button className="rounded-md bg-white px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-200">Sign in</button>
            {error && <p className="sm:col-span-3 text-[11px] text-rose-300">{error}</p>}
          </form>

          {/* Vision India Group entities */}
          <div className="max-w-3xl mx-auto mb-8">
            <div className="flex items-center gap-2 justify-center mb-3 text-[10px] uppercase tracking-widest text-slate-500">
              <Building2 className="w-3 h-3" /> {GROUP.name} · Sub-entities
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {companies.map((c) => (
                <div key={c.code} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-center">
                  <p className="font-mono text-[10px] text-slate-400">{c.code}</p>
                  <p className="text-xs font-semibold text-white truncate">{c.name}</p>
                  <p className="text-[9px] text-slate-500 mt-0.5">{c.teams.length} teams</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {roles.map(({ to, label, persona, id, desc, icon: Icon, accent }) => (
              <Link
                key={to}
                to={to}
                className="group relative bg-white/5 backdrop-blur border border-white/10 rounded-xl p-5 hover:bg-white/10 hover:border-white/20 transition-all hover:-translate-y-0.5"
              >
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${accent} grid place-items-center mb-4 shadow-lg`}>
                  <Icon className="w-5 h-5 text-white" strokeWidth={1.75} />
                </div>
                <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">{label}</p>
                <p className="font-display font-semibold text-white text-base">{persona}</p>
                <p className="text-[10px] font-mono text-slate-400 mt-0.5">{id}</p>
                <p className="text-xs text-slate-400 mt-3 leading-relaxed">{desc}</p>
                <div className="flex items-center gap-1 mt-4 text-xs font-semibold text-white group-hover:gap-2 transition-all">
                  Enter <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </Link>
            ))}
          </div>

          <p className="text-center text-[10px] text-slate-500 mt-8">
            Mock console · Every action is signed with your role ID and logged to the audit trail.
          </p>
        </div>
      </main>
    </div>
  );
}
