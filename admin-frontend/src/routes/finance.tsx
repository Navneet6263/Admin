import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PaymentCard, type PaymentRow } from "@/components/payments/PaymentCard";
import { request, type Paged } from "@/lib/api";
import { useSessionUser } from "@/lib/useSessionUser";
import { CheckCircle2, Clock3, Landmark } from "lucide-react";

export const Route = createFileRoute("/finance")({
  head: () => ({ meta: [{ title: "Finance · RequestHub" }] }),
  component: FinanceConsole,
});
function FinanceConsole() {
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [requestedId, setRequestedId] = useState("");
  const user = useSessionUser();
  useEffect(() => { setRequestedId(new URLSearchParams(window.location.search).get("request") || ""); }, []);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await request<Paged<PaymentRow>>(
        `/api/payments?status=${status}&page=${page}&page_size=25${requestedId ? `&request_id=${encodeURIComponent(requestedId)}` : ""}`,
      );
      setRows(result.data);
      setTotal(result.total);
    } finally {
      setLoading(false);
    }
  }, [page, requestedId, status]);
  useEffect(() => {
    void load();
  }, [load]);
  const metrics = useMemo(
    () => ({
      pending: rows.filter((r) => r.status !== "paid").length,
      paid: rows.filter((r) => r.status === "paid").length,
      value: rows.reduce((n, r) => n + Number(r.actual_amount ?? r.estimated_amount ?? 0), 0),
    }),
    [rows],
  );
  return (
    <DashboardLayout
      workspace="Finance Operations"
      currentUser={user?.name || "Finance"}
      role={user?.role === "finance_head" ? "Head Finance" : "Finance Executive"}
    >
      <div className="max-w-7xl mx-auto px-5 py-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-indigo-500">
              Controlled fund operations
            </p>
            <h1 className="text-2xl font-semibold flex gap-2">
              <Landmark className="w-6 h-6" />
              Payment Control
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Your limits and capabilities are enforced by Super Admin policy.
            </p>
          </div>
          <div className="flex gap-2">
            <Metric icon={Clock3} label="Open on page" value={metrics.pending} />
            <Metric icon={CheckCircle2} label="Paid on page" value={metrics.paid} />
            <Metric
              icon={Landmark}
              label="Page value"
              value={`₹${metrics.value.toLocaleString("en-IN")}`}
            />
          </div>
        </div>
        <div className="flex gap-2 my-5 border-b">
          {[
            ["all", "All"],
            ["awaiting_update", "Need update"],
            ["awaiting_verification", "Verify"],
            ["paid", "Paid"],
          ].map(([v, l]) => (
            <button
              key={v}
              onClick={() => {
                setStatus(v);
                setPage(1);
              }}
              className={`px-3 py-2 text-xs border-b-2 ${status === v ? "border-slate-900 font-semibold" : "border-transparent text-slate-500"}`}
            >
              {l}
            </button>
          ))}
        </div>
        {loading ? (
          <div className="py-20 text-center text-slate-400">Loading secure payment queue…</div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-3">
            {rows.map((r) => (
              <PaymentCard key={r.request_id} row={r} onDone={() => void load()} />
            ))}
          </div>
        )}
        {!loading && !rows.length && (
          <div className="py-20 text-center text-slate-400">No payments in this queue.</div>
        )}
        <div className="flex justify-between items-center mt-5 text-xs text-slate-500">
          <span>{total} records</span>
          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="border rounded px-3 py-1.5 disabled:opacity-30"
            >
              Previous
            </button>
            <span className="px-2 py-1.5">Page {page}</span>
            <button
              disabled={page * 25 >= total}
              onClick={() => setPage((p) => p + 1)}
              className="border rounded px-3 py-1.5 disabled:opacity-30"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock3;
  label: string;
  value: string | number;
}) {
  return (
    <div className="bg-white border rounded-xl px-3 py-2 min-w-28">
      <p className="text-[9px] uppercase text-slate-400 flex gap-1">
        <Icon className="w-3 h-3" />
        {label}
      </p>
      <b className="text-sm">{value}</b>
    </div>
  );
}
