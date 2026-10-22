import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, ShieldAlert } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { apiBaseUrl, session } from "@/lib/api";

export const Route = createFileRoute("/sso")({
  head: () => ({ meta: [{ title: "Signing you in · Admin @ Management" }, { name: "robots", content: "noindex" }] }),
  component: SsoLanding,
});

const homeByRole: Record<string, string> = { employee: "/employee" };

/** Landing page for the one-time link issued to the HRMS. Exchanges the ticket for a session. */
function SsoLanding() {
  const [state, setState] = useState<{ kind: "working" } | { kind: "error"; code: string; message: string }>({ kind: "working" });
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const ticket = new URLSearchParams(window.location.search).get("ticket") || "";
    // Remove the ticket from the address bar and history straight away.
    window.history.replaceState(null, "", "/sso");
    void (async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/sso/exchange`, { method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticket }) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) { setState({ kind: "error", code: data.error || "ERROR", message: data.message || "Sign-in failed." }); return; }
        session.clear();
        await session.me(true);
        window.location.replace(homeByRole[data.role] || "/");
      } catch {
        setState({ kind: "error", code: "NETWORK", message: "The server could not be reached. Please try again." });
      }
    })();
  }, []);

  return <div className="grid min-h-screen place-items-center bg-slate-50 p-4">
    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-xl">
      <div className="mb-6 flex justify-center"><BrandLogo size={40} /></div>
      {state.kind === "working" ? <>
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-600" />
        <p className="mt-4 text-sm font-semibold text-slate-900">Signing you in from Green HR…</p>
        <p className="mt-1 text-xs text-slate-500">This takes just a moment.</p>
      </> : <>
        {state.code === "ADMIN_ACCOUNT"
          ? <ShieldAlert className="mx-auto h-10 w-10 text-amber-500" /> : <AlertTriangle className="mx-auto h-10 w-10 text-rose-500" />}
        <p className="mt-4 text-base font-bold text-slate-900">
          {state.code === "ADMIN_ACCOUNT" ? "You already have an admin account" : state.code === "LINK_EXPIRED" ? "This link has expired" : "We couldn't sign you in"}</p>
        <p className="mt-2 text-sm leading-6 text-slate-600">{state.message}</p>
        <div className="mt-6 flex flex-col gap-2">
          <a href="/" className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black">
            {state.code === "ADMIN_ACCOUNT" ? "Go to admin sign in" : "Go to sign in page"}</a>
          {state.code !== "ADMIN_ACCOUNT" && <p className="text-[11px] text-slate-400">You can also open “Admin Portal” again from Green HR.</p>}
        </div>
      </>}
    </div>
  </div>;
}
