import { useState } from "react";
import { CheckCircle2, Clock3, ReceiptIndianRupee } from "lucide-react";
import { request } from "@/lib/api";

export interface PaymentRow {
  request_id: number;
  ref_id: string;
  type: string;
  subject: string;
  employee_name: string;
  estimated_amount: number | null;
  actual_amount: number | null;
  vendor_name: string | null;
  invoice_number: string | null;
  payment_method: string | null;
  transaction_ref: string | null;
  status: string;
  due_at: string | null;
  charge_center_code: string;
  approval_center_code: string;
}
export function PaymentCard({ row, onDone }: { row: PaymentRow; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    actual_amount: String(row.actual_amount ?? row.estimated_amount ?? ""),
    vendor_name: row.vendor_name || "",
    invoice_number: row.invoice_number || "",
    payment_method: row.payment_method || "UPI",
    transaction_ref: row.transaction_ref || "",
    notes: "",
  });
  const update = async () => {
    setBusy(true); setError("");
    try {
      await request(`/api/payments/${row.request_id}/update`, {
        method: "POST",
        body: { ...form, actual_amount: Number(form.actual_amount) },
      });
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Payment update failed");
    } finally {
      setBusy(false);
    }
  };
  const verify = async () => {
    setBusy(true); setError("");
    try {
      await request(`/api/payments/${row.request_id}/verify`, { method: "POST" });
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Payment verification failed");
    } finally {
      setBusy(false);
    }
  };
  const overdue =
    row.due_at && new Date(row.due_at) < new Date() && row.status === "awaiting_update";
  return (
    <article className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
      <div className="flex gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 grid place-items-center">
          <ReceiptIndianRupee className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between gap-3">
            <div>
              <p className="text-[10px] font-mono text-slate-400">
                {row.ref_id} · {row.type}
              </p>
              <h3 className="font-semibold text-sm truncate">{row.subject}</h3>
            </div>
            <b className="font-mono text-sm">
              ₹{Number(row.actual_amount ?? row.estimated_amount ?? 0).toLocaleString("en-IN")}
            </b>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {row.employee_name} · Charge {row.charge_center_code} · Handled{" "}
            {row.approval_center_code}
          </p>
          <div className="flex items-center gap-2 mt-3">
            <span
              className={`text-[10px] px-2 py-1 rounded-full ${row.status === "paid" ? "bg-emerald-50 text-emerald-700" : overdue ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}
            >
              {row.status.replaceAll("_", " ")}
            </span>
            {overdue && (
              <span className="text-[10px] text-rose-600 flex gap-1">
                <Clock3 className="w-3 h-3" />
                Overdue
              </span>
            )}
            {row.status !== "paid" && (
              <button
                onClick={() => setOpen(!open)}
                className="ml-auto text-xs font-semibold text-indigo-600"
              >
                {open ? "Close" : "Open action"}
              </button>
            )}
          </div>
        </div>
      </div>
      {open && (
        <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-100">
          {row.status === "awaiting_update" ? (
            <>
              <input
                className="border rounded-lg px-3 py-2 text-xs"
                type="number"
                placeholder="Final amount"
                value={form.actual_amount}
                onChange={(e) => setForm({ ...form, actual_amount: e.target.value })}
              />
              <input
                className="border rounded-lg px-3 py-2 text-xs"
                placeholder="Vendor"
                value={form.vendor_name}
                onChange={(e) => setForm({ ...form, vendor_name: e.target.value })}
              />
              <input
                className="border rounded-lg px-3 py-2 text-xs"
                placeholder="Invoice number"
                value={form.invoice_number}
                onChange={(e) => setForm({ ...form, invoice_number: e.target.value })}
              />
              <select
                className="border rounded-lg px-3 py-2 text-xs"
                value={form.payment_method}
                onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
              >
                <option>UPI</option>
                <option>Bank Transfer</option>
                <option>Card</option>
                <option>Cash</option>
                <option>Corporate Account</option>
              </select>
              <input
                className="border rounded-lg px-3 py-2 text-xs col-span-2"
                placeholder="Transaction reference"
                value={form.transaction_ref}
                onChange={(e) => setForm({ ...form, transaction_ref: e.target.value })}
              />
              <button
                disabled={busy}
                onClick={() => void update()}
                className="col-span-2 bg-slate-900 text-white rounded-lg py-2 text-xs font-semibold"
              >
                Submit for finance verification
              </button>
            </>
          ) : (
            <button
              disabled={busy}
              onClick={() => void verify()}
              className="col-span-2 bg-emerald-600 text-white rounded-lg py-2 text-xs font-semibold inline-flex justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Verify payment & close
            </button>
          )}
        </div>
      )}
      {error && <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] text-rose-700">{error}</p>}
    </article>
  );
}
