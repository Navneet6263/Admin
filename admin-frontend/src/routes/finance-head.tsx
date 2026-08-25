import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { protectedRoute } from "@/components/ProtectedRoute";

export const Route = createFileRoute("/finance-head")({
  head: () => ({ meta: [{ title: "Finance Head · RequestHub" }] }),
  component: protectedRoute(FinanceHeadAlias, ["finance_head"]),
});

function FinanceHeadAlias() {
  useEffect(() => { window.location.replace("/finance"); }, []);
  return <div className="grid min-h-screen place-items-center bg-slate-50 text-sm text-slate-500">
    Opening Finance Head dashboard…
  </div>;
}
