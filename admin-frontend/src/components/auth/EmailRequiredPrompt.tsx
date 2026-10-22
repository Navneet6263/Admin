import { useState } from "react";
import { Loader2, Mail, X } from "lucide-react";
import { request, session } from "@/lib/api";
import { useSessionUser } from "@/lib/useSessionUser";

/** Shown to SSO users who arrived without an email: they add one and confirm it with a code. */
export function EmailRequiredPrompt() {
  const user = useSessionUser();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"email" | "otp" | "done">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  if (!user?.needs_email || dismissed && !open) return null;

  const send = async () => {
    setBusy(true); setError("");
    try {
      const result = await request<{ destination: string }>("/api/auth/email/request", { method: "POST", body: { email: email.trim() } });
      setInfo(`We sent a 6-digit code to ${result.destination}.`); setStep("otp");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Code could not be sent"); }
    finally { setBusy(false); }
  };
  const verify = async () => {
    setBusy(true); setError("");
    try {
      await request("/api/auth/email/verify", { method: "POST", body: { otp } });
      await session.me(true);
      setStep("done");
      window.setTimeout(() => window.location.reload(), 900);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Code could not be verified"); }
    finally { setBusy(false); }
  };
  const input = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200";

  return <>
    <div className="flex flex-wrap items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900 sm:px-6">
      <Mail className="h-4 w-4 shrink-0" />
      <span className="flex-1">Please add your email address — approvals, receipts and sign-in codes are sent there.</span>
      <button type="button" onClick={() => setOpen(true)} className="rounded-md bg-amber-600 px-3 py-1 font-semibold text-white hover:bg-amber-700">Add email</button>
      <button type="button" onClick={() => setDismissed(true)} className="text-amber-700 hover:text-amber-900" title="Remind me later"><X className="h-4 w-4" /></button>
    </div>
    {open && <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm" onClick={() => !busy && setOpen(false)}>
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <p className="text-base font-bold text-slate-900">Add your email</p>
        <p className="mt-1 text-xs text-slate-500">We'll send a code to confirm it belongs to you.</p>
        <form className="mt-4 space-y-3" onSubmit={(event) => { event.preventDefault(); void (step === "email" ? send() : verify()); }}>
          <input type="email" required value={email} disabled={step !== "email"} onChange={(event) => setEmail(event.target.value)}
            className={`${input} disabled:bg-slate-100`} placeholder="you@company.com" autoFocus />
          {step !== "email" && <input inputMode="numeric" maxLength={6} value={otp} disabled={step === "done"}
            onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
            className={`${input} text-center font-mono tracking-[0.4em]`} placeholder="6-digit code" autoFocus />}
          {info && step === "otp" && <p className="text-xs text-emerald-700">{info}</p>}
          {step === "done" && <p className="text-xs font-semibold text-emerald-700">Email saved. Thank you!</p>}
          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            {step === "otp" && <button type="button" disabled={busy} onClick={() => { setStep("email"); setOtp(""); }} className="mr-auto text-xs text-slate-500 underline">Change email</button>}
            <button type="button" disabled={busy} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100">Later</button>
            <button type="submit" disabled={busy || step === "done" || (step === "otp" && otp.length !== 6)} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-black disabled:opacity-40">
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{step === "email" ? "Send code" : "Verify"}</button>
          </div>
        </form>
      </div>
    </div>}
  </>;
}
