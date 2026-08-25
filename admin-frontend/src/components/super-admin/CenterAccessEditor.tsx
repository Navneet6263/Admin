import { useState } from "react";
import { Plus, X } from "lucide-react";
import { CenterCombobox, type CenterOption } from "@/components/CenterCombobox";
import { request } from "@/lib/api";

type AccessResponse = {
  home_center_code: string | null;
  additional_centers: Array<{ center_code: string; name: string; city: string }>;
};

export function CenterAccessEditor({ userId, homeCenter, centers, apiBase }: {
  userId: number; homeCenter?: string | null; centers: CenterOption[]; apiBase: string;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<AccessResponse["additional_centers"]>([]);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setBusy(true); setError("");
    try {
      const data = await request<AccessResponse>(`${apiBase}/${userId}/center-access`);
      setRows(data.additional_centers); setOpen(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Access could not be loaded"); }
    finally { setBusy(false); }
  };
  const grant = async () => {
    if (!selected) return;
    setBusy(true); setError("");
    try {
      await request(`${apiBase}/${userId}/center-access`, { method: "POST", body: { center_code: selected } });
      const center = centers.find((item) => item.code === selected);
      if (center) setRows((current) => [...current.filter((row) => row.center_code !== selected),
        { center_code: center.code, name: center.name, city: center.city }]);
      setSelected("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Access could not be granted"); }
    finally { setBusy(false); }
  };
  const revoke = async (centerCode: string) => {
    setBusy(true); setError("");
    try {
      await request(`${apiBase}/${userId}/center-access/${encodeURIComponent(centerCode)}`, { method: "DELETE" });
      setRows((current) => current.filter((row) => row.center_code !== centerCode));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Access could not be revoked"); }
    finally { setBusy(false); }
  };

  if (!open) return <button type="button" onClick={() => void load()} disabled={busy}
    className="mt-2 text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 disabled:opacity-50">
    {busy ? "Loading…" : "+ Manage additional centers"}
  </button>;

  const available = centers.filter((center) => center.code !== homeCenter
    && !rows.some((row) => row.center_code === center.code));
  return <div className="mt-2 min-w-72 rounded-lg border border-indigo-100 bg-indigo-50/50 p-2">
    <div className="mb-2 flex flex-wrap gap-1">
      {rows.map((row) => <span key={row.center_code}
        className="inline-flex items-center gap-1 rounded border border-indigo-200 bg-white px-2 py-1 text-[10px] font-semibold text-indigo-700">
        {row.center_code}<button type="button" disabled={busy} onClick={() => void revoke(row.center_code)}
          aria-label={`Revoke ${row.center_code}`}><X className="h-3 w-3" /></button>
      </span>)}
      {!rows.length && <span className="text-[10px] text-slate-500">Home center only</span>}
    </div>
    <div className="flex items-center gap-1">
      <CenterCombobox centers={available} value={selected} onChange={setSelected}
        disabled={busy} placeholder="Grant another center…" className="min-w-52 flex-1" />
      <button type="button" onClick={() => void grant()} disabled={!selected || busy}
        className="grid h-9 w-9 place-items-center rounded-md bg-indigo-600 text-white disabled:opacity-40"
        aria-label="Grant selected center"><Plus className="h-3.5 w-3.5" /></button>
    </div>
    {error && <p className="mt-1 text-[10px] text-rose-600">{error}</p>}
  </div>;
}
