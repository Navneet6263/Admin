import { useEffect, useState } from "react";
import { AlertCircle, ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { request, session } from "@/lib/api";

const inputClass =
  "w-full border border-slate-300 rounded-sm px-3.5 py-2.5 text-sm bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-all";
const labelClass = "block text-sm font-medium text-slate-900 mb-1.5";

/** Employee sign-in with Employee ID + one-time code sent to their registered email. */
export function EmployeeOtpLogin({ onBack, onSignedIn }: { onBack: () => void; onSignedIn: (role: string) => void }) {
  const [employeeCode, setEmployeeCode] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"code" | "otp">("code");
  const [destination, setDestination] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (!resendIn) return;
    const timer = window.setTimeout(() => setResendIn((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  const sendCode = async () => {
    if (!employeeCode.trim()) { setError("Enter your Employee ID"); return; }
    setLoading(true); setError(""); setNotice("");
    try {
      const result = await request<{ destination: string; cooldown: boolean }>("/api/auth/otp/request",
        { method: "POST", body: { employee_code: employeeCode.trim() } }, false);
      setDestination(result.destination); setStep("otp"); setResendIn(45);
      setNotice(result.cooldown ? `A code was sent recently to ${result.destination}. Please check your inbox.` : `We sent a 6-digit code to ${result.destination}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The code could not be sent"); }
    finally { setLoading(false); }
  };
  const verify = async () => {
    if (!/^\d{6}$/.test(otp)) { setError("Enter the 6-digit code"); return; }
    setLoading(true); setError("");
    try {
      const result = await request<{ role: string }>("/api/auth/otp/verify",
        { method: "POST", body: { employee_code: employeeCode.trim(), otp } }, false);
      await session.me(true);
      onSignedIn(result.role);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Sign-in failed"); setLoading(false); }
  };

  return <div>
    <h2 className="text-2xl font-bold text-slate-900 mb-1" style={{ fontFamily: "'Nunito', sans-serif" }}>Employee sign in</h2>
    <p className="text-sm text-slate-500 mb-6">Use your Green HR Employee ID. We'll email you a one-time code.</p>
    <form onSubmit={(event) => { event.preventDefault(); void (step === "code" ? sendCode() : verify()); }} className="space-y-4">
      <div>
        <label htmlFor="otp-employee" className={labelClass}>Employee ID</label>
        <input id="otp-employee" required autoComplete="username" value={employeeCode} disabled={step === "otp"}
          onChange={(event) => setEmployeeCode(event.target.value.toUpperCase())} className={`${inputClass} disabled:bg-slate-100`} placeholder="GC-1042" autoFocus />
      </div>
      {step === "otp" && <div>
        <label htmlFor="otp-code" className={labelClass}>6-digit code</label>
        <input id="otp-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp}
          onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
          className={`${inputClass} text-center font-mono text-lg tracking-[0.5em]`} placeholder="••••••" autoFocus />
        <div className="mt-2 flex items-center justify-between text-xs">
          <button type="button" onClick={() => { setStep("code"); setOtp(""); setNotice(""); setError(""); }} className="text-slate-600 underline underline-offset-2">Change Employee ID</button>
          <button type="button" disabled={resendIn > 0 || loading} onClick={() => void sendCode()} className="font-semibold text-slate-900 underline underline-offset-2 disabled:no-underline disabled:opacity-50">
            {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}</button>
        </div>
      </div>}
      {notice && <div className="flex items-center gap-2 rounded-sm border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800"><MailCheck className="h-4 w-4 shrink-0" />{notice}</div>}
      {error && <div className="flex items-center gap-2 rounded-sm border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700"><AlertCircle className="h-4 w-4 shrink-0 text-rose-600" /><span>{error}</span></div>}
      <button type="submit" disabled={loading}
        className="w-full mt-2 px-6 py-3 text-sm font-semibold tracking-[0.1em] uppercase bg-slate-900 text-white rounded-sm hover:bg-slate-800 transition-all duration-200 disabled:opacity-60 flex items-center justify-center">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : step === "code" ? "Send code" : "Verify & sign in"}
      </button>
    </form>
    <p className="text-sm text-slate-500 mt-6 text-center">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-slate-900 underline underline-offset-2 font-medium">
        <ArrowLeft className="h-3.5 w-3.5" /> Admin sign in (email & password)</button>
      {destination && step === "otp" && <span className="mt-2 block text-[11px]">Didn't get it? Check spam, or open Admin Portal from Green HR.</span>}
    </p>
  </div>;
}
