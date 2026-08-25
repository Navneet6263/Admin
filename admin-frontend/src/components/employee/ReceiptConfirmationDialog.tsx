import { CheckCircle2, Loader2, PackageCheck, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

export interface ReceiptPrompt {
  id: number;
  ref_id: string;
  subject: string;
  type: string;
  fulfilled_at: string;
  fulfilled_by_name?: string;
}

type Feedback = "very_easy" | "easy" | "needs_improvement";

export function ReceiptConfirmationDialog({ prompt, remaining, onSubmit }: {
  prompt: ReceiptPrompt;
  remaining: number;
  onSubmit: (answer: { received: boolean; feedback?: Feedback; note: string }) => Promise<void>;
}) {
  const [received, setReceived] = useState<boolean | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setReceived(null); setFeedback(null); setNote(""); setError("");
  }, [prompt.id]);

  const noteRequired = received === false || feedback === "needs_improvement";
  const valid = received === false ? note.trim().length >= 5
    : received === true ? Boolean(feedback) && (!noteRequired || note.trim().length >= 5) : false;
  const submit = async () => {
    if (!valid || received === null) return;
    setBusy(true); setError("");
    try { await onSubmit({ received, feedback: received ? feedback! : undefined, note: note.trim() }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Confirmation could not be saved"); }
    finally { setBusy(false); }
  };

  return <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/65 p-4 backdrop-blur-sm"
    role="dialog" aria-modal="true" aria-labelledby="receipt-title">
    <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
      <div className="border-b border-slate-100 bg-gradient-to-br from-cyan-50 to-white px-6 py-5">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cyan-600 text-white"><PackageCheck className="h-5 w-5" /></span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-700">Delivery verification</p>
            <h2 id="receipt-title" className="mt-1 text-lg font-semibold text-slate-900">Did you receive this item?</h2>
            <p className="mt-1 font-mono text-[10px] text-slate-500">{prompt.ref_id}{remaining > 1 ? ` · ${remaining} confirmations pending` : ""}</p>
          </div>
        </div>
      </div>
      <div className="space-y-4 p-6">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
          <p className="text-sm font-semibold text-slate-800">{prompt.subject}</p>
          <p className="mt-1 text-[11px] text-slate-500">Marked handed over by {prompt.fulfilled_by_name || "Admin"} · {new Date(prompt.fulfilled_at).toLocaleString("en-IN")}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={() => { setReceived(true); setError(""); }}
            className={`rounded-xl border p-3 text-left transition ${received === true ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100" : "border-slate-200 hover:border-emerald-300"}`}>
            <CheckCircle2 className="h-5 w-5 text-emerald-600" /><b className="mt-2 block text-sm text-slate-900">Yes, received</b>
          </button>
          <button type="button" onClick={() => { setReceived(false); setFeedback(null); setError(""); }}
            className={`rounded-xl border p-3 text-left transition ${received === false ? "border-rose-500 bg-rose-50 ring-2 ring-rose-100" : "border-slate-200 hover:border-rose-300"}`}>
            <XCircle className="h-5 w-5 text-rose-600" /><b className="mt-2 block text-sm text-slate-900">No, not received</b>
          </button>
        </div>
        {received === true && <div>
          <p className="mb-2 text-xs font-semibold text-slate-700">How easy was this process?</p>
          <div className="grid grid-cols-3 gap-2">{([
            ["very_easy", "Very easy"], ["easy", "Easy"], ["needs_improvement", "Needs improvement"],
          ] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setFeedback(value)}
            className={`rounded-lg border px-2 py-2 text-[11px] font-semibold ${feedback === value ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{label}</button>)}</div>
        </div>}
        {received !== null && <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-700">
            {received === false ? "Tell us what happened" : feedback === "needs_improvement" ? "What should we improve?" : "Additional feedback (optional)"}
          </label>
          <textarea rows={3} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)}
            placeholder={noteRequired ? "Please enter at least 5 characters…" : "Share any suggestion…"}
            className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
        </div>}
        {received === false && <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-700">Your note will be sent only to HQ Admin and Super Admin for resolution.</p>}
        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
        <button type="button" disabled={!valid || busy} onClick={() => void submit()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-xs font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-40">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Submit confirmation
        </button>
      </div>
    </div>
  </div>;
}
