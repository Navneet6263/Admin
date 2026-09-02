import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CenterCombobox } from "@/components/CenterCombobox";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Facebook, AlertCircle, Loader2, X } from "lucide-react";
import heroImage from "@/assets/hero-home-decor.jpg";
import { request, session } from "@/lib/api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Member Sign In — Admin @ Management." },
      { name: "description", content: "Admin @ Management. Console — Manage Department Requests, Approvals, Treasury & Inventory." },
    ],
  }),
  component: Home,
});

type Mode = "signin" | "register" | "forgot";
type CompanyOption = { id: number; code: string; name: string };
type TeamOption = { id: number; name: string; company: string };
type CenterOption = { id: number; code: string; name: string; city: string; company: string; is_active: boolean };
type RegisterOptions = { companies: CompanyOption[]; teams: TeamOption[]; centers: CenterOption[] };

const inputClass =
  "w-full border border-slate-300 rounded-sm px-3.5 py-2.5 text-sm bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all font-sans";
const labelClass = "block text-sm font-medium text-slate-900 mb-1.5";

function Home() {
  const navigate = useNavigate();
  const [showLoginCard, setShowLoginCard] = useState(false);
  const [mode, setMode] = useState<Mode>("signin");
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [companiesList, setCompaniesList] = useState<CompanyOption[]>([]);
  const [centers, setCenters] = useState<CenterOption[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    employee_code: "",
    email: "",
    password: "",
    company: "",
    department: "",
    center_code: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mastersLoading, setMastersLoading] = useState(false);
  const [mastersError, setMastersError] = useState("");

  const switchMode = (next: Mode) => {
    setMode(next);
    setSubmitted(false);
    setError("");
  };

  const loadRegisterOptions = useCallback(async () => {
    if (companiesList.length && teams.length && centers.length) return;
    setMastersLoading(true);
    setMastersError("");
    try {
      const { companies, teams: departments, centers: activeCenters } =
        await request<RegisterOptions>('/api/auth/register-options', {}, false);
      setCompaniesList(companies);
      setTeams(departments);
      setCenters(activeCenters);
      const defaultCompany = companies[0]?.name || "";
      setFormData((current) => current.company ? current : {
        ...current,
        company: defaultCompany,
        department: departments.find((team) => team.company === defaultCompany)?.name || "",
        center_code: activeCenters[0]?.code || "",
      });
    } catch (cause) {
      if (import.meta.env.DEV) console.error("Unable to load registration masters", cause);
      setMastersError("Registration details are temporarily unavailable.");
    } finally {
      setMastersLoading(false);
    }
  }, [centers.length, companiesList.length, teams.length]);

  useEffect(() => {
    if (showLoginCard && mode === "register") void loadRegisterOptions();
  }, [loadRegisterOptions, mode, showLoginCard]);

  const filteredTeams = useMemo(() => teams.filter((team) => team.company === formData.company), [formData.company, teams]);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (mode === "signin") {
      if (!formData.email.trim() || !formData.password.trim()) {
        setError("Please fill in both email and password.");
        return;
      }
      setLoading(true);
      try {
        const user = await session.login(formData.email.trim(), formData.password.trim());
        const routes: Record<string, string> = {
          super_admin: '/super-admin',
          center_admin: '/center-admin',
          finance_head: '/finance',
          hq_admin: '/admin',
        };
        const target = routes[user.role] ?? `/${user.role}`;
        void navigate({ to: target as '/admin' });
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Invalid credentials. Please check email & password.');
      } finally {
        setLoading(false);
      }
    } else if (mode === "register") {
      if (!formData.name.trim() || !formData.employee_code.trim() || !formData.email.trim() || !formData.password.trim()
        || !formData.company || !formData.department || !formData.center_code) {
        setError("Please fill in Name, Employee ID, Email, Password, Company, Department and Center.");
        return;
      }
      if (!/^[A-Za-z0-9_-]{2,40}$/.test(formData.employee_code.trim())) {
        setError("Employee ID may contain only letters, numbers, hyphen or underscore.");
        return;
      }
      setLoading(true);
      try {
        const user = await session.register({
          name: formData.name.trim(),
          email: formData.email.trim(),
          password: formData.password.trim(),
          company: formData.company,
          dept: formData.department,
          center_code: formData.center_code,
          employee_code: formData.employee_code.trim(),
        });
        const routes: Record<string, string> = {
          super_admin: '/super-admin',
          center_admin: '/center-admin',
          finance_head: '/finance',
          hq_admin: '/admin',
        };
        const target = routes[user.role] ?? `/${user.role}`;
        void navigate({ to: target as '/employee' });
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Registration failed. Please try again.');
      } finally {
        setLoading(false);
      }
    } else {
      setSubmitted(true);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-900 select-none">
      <div className="relative w-full min-h-screen overflow-x-hidden">
        {/* Full-Screen Wallpaper */}
        <img
          src={heroImage}
          alt="Admin @ Management. Wallpaper"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
        {/* Light Overlay matching reference screenshot */}
        <div className="absolute inset-0 bg-black/40" />

        {/* Header — Matched spacing from screenshot */}
        <header className="absolute top-0 left-0 right-0 z-50">
          <div className="flex items-center justify-between h-20 max-w-[1400px] mx-auto px-8 md:px-16">
            <span
              className="font-bold text-xl md:text-2xl text-white shrink-0 cursor-pointer tracking-tight"
              style={{ fontFamily: "'Nunito', sans-serif" }}
              onClick={() => setShowLoginCard(false)}
            >
              Admin @ Management.
            </span>

            <a
              href="https://facebook.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Visit us on Facebook"
              className="text-white/80 hover:text-white transition-colors duration-200"
            >
              <Facebook className="w-5 h-5" />
            </a>
          </div>
        </header>

        {/* Main Section — Matched exact spacing & positioning from screenshot */}
        <div className="relative min-h-screen flex items-center pt-20 pb-16">
          <div className="w-full max-w-[1400px] mx-auto px-8 md:px-16">
            <div className="grid md:grid-cols-[1fr_auto] gap-12 md:gap-24 items-center">
              
              {/* Left Column — Title & Paragraph (Spatial Layout Matched) */}
              <div className="flex flex-col justify-center max-w-xl">
                <p className="uppercase text-xs md:text-sm font-semibold tracking-[0.18em] text-white/90 mb-6 drop-shadow-sm font-sans">
                  10 JULY &nbsp;&bull;&nbsp; 9AM–6:30PM
                </p>

                <h1
                  className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white mb-6 leading-[1.08] drop-shadow-md"
                  style={{ fontFamily: "'Nunito', sans-serif" }}
                >
                  Member<br />
                  Sign In
                </h1>

                <p className="text-sm md:text-base leading-relaxed text-white/90 mb-8 drop-shadow-sm font-medium">
                  Welcome to Admin @ Management. Console — The unified enterprise workflow system. Sign in to manage department requests, track physical claim verifications, issue petty cash funds, and monitor real-time inventory.
                </p>
              </div>

              {/* Right Column — Matched exact positioning of address block & GET STARTED button */}
              {!showLoginCard ? (
                <div className="flex flex-col items-start md:items-end text-left md:text-right text-white space-y-4 max-w-xs justify-self-end">
                  <div className="space-y-1.5 drop-shadow-md">
                    <p className="font-bold text-lg text-white">742 Corporate Center</p>
                    <p className="font-semibold text-base text-white/95">Executive Wing, Building 4</p>
                  </div>

                  <div className="space-y-1 text-base text-white/90 drop-shadow-md pt-2">
                    <p className="font-medium text-sm">hello@company.com</p>
                    <p className="font-medium text-sm">(718) 555-9012</p>
                  </div>

                  <div className="pt-4">
                    <button
                      type="button"
                      onClick={() => { switchMode("signin"); setShowLoginCard(true); }}
                      className="px-10 py-4 text-xs font-bold tracking-[0.2em] uppercase bg-white text-slate-900 rounded-sm hover:bg-slate-100 transition-all duration-300 shadow-2xl hover:scale-105 cursor-pointer"
                    >
                      GET STARTED
                    </button>
                  </div>
                </div>
              ) : (
                /* Crisp White Login Card */
                <div className={`w-full bg-white rounded-sm shadow-2xl p-7 md:p-8 text-slate-900 animate-in fade-in slide-in-from-right-8 duration-300 relative justify-self-end ${mode === "register" ? "md:w-[620px] lg:w-[680px]" : "md:w-[380px]"}`}>
                  {/* Close Button */}
                  <button
                    type="button"
                    onClick={() => setShowLoginCard(false)}
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-900 transition-colors p-1"
                    title="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  {submitted ? (
                    <div className="text-center py-6">
                      <h2
                        className="text-2xl font-bold text-slate-900 mb-3"
                        style={{ fontFamily: "'Nunito', sans-serif" }}
                      >
                        {mode === "signin"
                          ? "Welcome Back"
                          : mode === "register"
                          ? "Account Created"
                          : "Check Your Email"}
                      </h2>
                      <p className="text-slate-600 text-sm leading-relaxed mb-6">
                        {mode === "forgot" ? (
                          <>
                            A reset link has been sent to{" "}
                            <span className="font-medium text-slate-900">{formData.email}</span>.
                          </>
                        ) : (
                          <>
                            {mode === "signin" ? "Signed in as " : "Registered as "}
                            <span className="font-medium text-slate-900">{formData.email}</span>
                            {mode === "register" && (
                              <>
                                {" "}in <span className="font-medium text-slate-900">{formData.department}</span>
                              </>
                            )}
                            .
                          </>
                        )}
                      </p>
                      <button
                        type="button"
                        onClick={() => switchMode("signin")}
                        className="inline-block px-8 py-3 text-sm font-semibold tracking-[0.1em] uppercase bg-slate-900 text-white rounded-sm hover:opacity-90 transition-all duration-200"
                      >
                        Back to Sign In
                      </button>
                    </div>
                  ) : (
                    <>
                      <h2
                        className="text-2xl font-bold text-slate-900 mb-1"
                        style={{ fontFamily: "'Nunito', sans-serif" }}
                      >
                        {mode === "signin" ? "Sign In" : mode === "register" ? "Register" : "Reset Password"}
                      </h2>
                      <p className={`text-sm text-slate-500 ${mode === "register" ? "mb-4" : "mb-6"}`}>
                        {mode === "signin"
                          ? "Access your department request dashboard"
                          : mode === "register"
                          ? "Create an employee account with your company center"
                          : "We'll email you a secure reset link"}
                      </p>

                      <form onSubmit={handleSubmit} className={mode === "register" ? "grid grid-cols-1 sm:grid-cols-2 gap-3" : "space-y-4"}>
                        {mode === "register" && (
                          <>
                            <div>
                              <label htmlFor="reg-name" className={labelClass}>
                                Full Name
                              </label>
                              <input
                                id="reg-name"
                                type="text"
                                required
                                autoComplete="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className={inputClass}
                                placeholder="Jane Doe"
                              />
                            </div>
                            <div>
                              <label htmlFor="reg-employee-id" className={labelClass}>
                                Employee ID
                              </label>
                              <input
                                id="reg-employee-id"
                                type="text"
                                required
                                value={formData.employee_code}
                                onChange={(e) => setFormData({ ...formData, employee_code: e.target.value.toUpperCase() })}
                                className={inputClass}
                                placeholder="EMP-0003"
                              />
                            </div>
                          </>
                        )}

                        <div>
                          <label htmlFor="login-email" className={labelClass}>
                            Work Email
                          </label>
                          <input
                            id="login-email"
                            type="email"
                            required
                            autoComplete="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className={inputClass}
                            placeholder="you@company.com"
                          />
                        </div>

                        {mode === "register" && (
                          <>
                            {mastersLoading && (
                              <div className="sm:col-span-2 rounded-sm border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                                Loading company, center and department lists...
                              </div>
                            )}
                            {mastersError && (
                              <div className="sm:col-span-2 flex items-center justify-between gap-3 rounded-sm border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                                <span>{mastersError}</span>
                                <button
                                  type="button"
                                  onClick={() => void loadRegisterOptions()}
                                  className="shrink-0 font-semibold text-slate-900 underline underline-offset-2"
                                >
                                  Try again
                                </button>
                              </div>
                            )}
                            <div>
                              <label htmlFor="login-company" className={labelClass}>
                                Company / Brand
                              </label>
                              <select
                                id="login-company"
                                required
                                value={formData.company}
                                onChange={(e) => {
                                  const company = e.target.value;
                                  setFormData({
                                    ...formData,
                                    company,
                                    department: teams.find((team) => team.company === company)?.name || "",
                                    center_code: formData.center_code || centers[0]?.code || "",
                                  });
                                }}
                                className={inputClass}
                                disabled={mastersLoading || Boolean(mastersError)}
                              >
                                <option value="" disabled>Select company</option>
                                {companiesList.map((c) => (
                                  <option key={c.id} value={c.name}>
                                    {c.name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label htmlFor="login-center" className={labelClass}>Your Home Center</label>
                              <CenterCombobox centers={centers} value={formData.center_code}
                                disabled={mastersLoading || Boolean(mastersError)}
                                showCompany
                                onChange={(center_code) => setFormData({ ...formData, center_code })}
                                placeholder="Search by center, city, company or code…" required />
                            </div>

                            <div>
                              <label htmlFor="login-department" className={labelClass}>
                                Department
                              </label>
                              <select
                                id="login-department"
                                required
                                value={formData.department}
                                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                className={inputClass}
                                disabled={mastersLoading || Boolean(mastersError)}
                              >
                                {filteredTeams.length > 0 ? (
                                  filteredTeams.map((t) => (
                                    <option key={t.id} value={t.name}>
                                      {t.name}
                                    </option>
                                  ))
                                ) : (
                                  <option value="" disabled>
                                    No departments available
                                  </option>
                                )}
                              </select>
                            </div>
                          </>
                        )}

                        {mode !== "forgot" && (
                          <div>
                            <label htmlFor="login-password" className={labelClass}>
                              Password
                            </label>
                            <input
                              id="login-password"
                              type="password"
                              required
                              autoComplete={mode === "register" ? "new-password" : "current-password"}
                              value={formData.password}
                              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                              className={inputClass}
                              placeholder="••••••••"
                            />
                          </div>
                        )}

                        {error && (
                          <div className={`flex items-center gap-2 p-3 rounded-sm bg-rose-50 border border-rose-200 text-rose-700 text-xs ${mode === "register" ? "sm:col-span-2" : ""}`}>
                            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                            <span>{error}</span>
                          </div>
                        )}

                        {mode === "signin" && (
                          <div className="flex items-center justify-between text-sm pt-1">
                            <label className="flex items-center gap-2 text-slate-600 cursor-pointer">
                              <input type="checkbox" defaultChecked className="rounded-sm border-slate-300 text-slate-900 focus:ring-slate-900" />
                              Remember me
                            </label>
                            <button
                              type="button"
                              onClick={() => switchMode("forgot")}
                              className="text-slate-900 underline underline-offset-2 hover:opacity-80"
                            >
                              Forgot password?
                            </button>
                          </div>
                        )}

                        <button
                          type="submit"
                          disabled={loading || (mode === "register" && (mastersLoading || Boolean(mastersError)))}
                          className={`w-full mt-2 px-6 py-3 text-sm font-semibold tracking-[0.1em] uppercase bg-slate-900 text-white rounded-sm hover:bg-slate-800 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer ${mode === "register" ? "sm:col-span-2" : ""}`}
                        >
                          {loading ? (
                            <Loader2 className="w-4 h-4 animate-spin text-white" />
                          ) : mode === "signin" ? (
                            "Sign In to Console"
                          ) : mode === "register" ? (
                            "Create Account"
                          ) : (
                            "Send Reset Link"
                          )}
                        </button>
                      </form>

                      <p className="text-sm text-slate-500 mt-6 text-center">
                        {mode === "forgot" ? (
                          <>
                            Return to{" "}
                            <button
                              type="button"
                              onClick={() => switchMode("signin")}
                              className="text-slate-900 underline underline-offset-2 font-medium"
                            >
                              Sign In
                            </button>
                          </>
                        ) : mode === "register" ? (
                          <>
                            Already have an account?{" "}
                            <button
                              type="button"
                              onClick={() => switchMode("signin")}
                              className="text-slate-900 underline underline-offset-2 font-medium"
                            >
                              Sign In
                            </button>
                          </>
                        ) : (
                          <>
                            New employee?{" "}
                            <button
                              type="button"
                              onClick={() => switchMode("register")}
                              className="text-slate-900 underline underline-offset-2 font-medium"
                            >
                              Register here
                            </button>
                            <span className="mt-1 block text-[11px]">
                              Admin and finance roles are created by authorized administrators.
                            </span>
                          </>
                        )}
                      </p>
                    </>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
