import { Minus, Plus } from "lucide-react";
import type { Priority } from "../models";
import type { InventoryItem } from "../liveInventory";

type Props = {
  isStationery: boolean; subject: string; setSubject: (value: string) => void;
  description: string; setDescription: (value: string) => void;
  priority: Priority; setPriority: (value: Priority) => void;
  stationeryQuery: string; setStationeryQuery: (value: string) => void;
  filteredInventory: InventoryItem[]; picks: Record<string, number>; pickedCount: number;
  bump: (sku: string, delta: number, max: number) => void;
};
const priorities: Priority[] = ["low", "normal", "high", "urgent"];
const lightInput = "w-full text-sm font-medium border border-white/15 rounded-xl px-3.5 py-2.5 text-slate-100 bg-slate-900/55 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/35";
export function RequestExtrasForm({ isStationery, subject, setSubject, description, setDescription, priority,
  setPriority, stationeryQuery, setStationeryQuery, filteredInventory, picks, pickedCount, bump }: Props) {
  return (<>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 block">Subject *</label>
                  <input value={subject} onChange={e => setSubject(e.target.value)} maxLength={120}
                    placeholder={isStationery ? "e.g. Monthly stationery restock" : "Short summary of your request…"}
                    className={lightInput} />
                </div>

                {isStationery ? (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Pick items</p>
                      <input value={stationeryQuery} onChange={e => setStationeryQuery(e.target.value)} placeholder="Search…"
                        className="text-xs bg-slate-900/55 border border-white/15 rounded-lg px-2.5 py-1.5 text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/35 w-28" />
                    </div>
                    <div className="border border-white/10 rounded-xl max-h-44 overflow-y-auto divide-y divide-white/5 bg-black/20 backdrop-blur-sm">
                      {filteredInventory.map(i => {
                        const picked = picks[i.sku] ?? 0;
                        return (
                          <div key={i.sku} className={`flex items-center gap-2.5 px-3 py-2 ${picked > 0 ? "bg-indigo-600/15" : ""}`}>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-white truncate">{i.name}</p>
                              <p className="mt-0.5 text-[10px] text-slate-400">Select required quantity</p>
                            </div>
                            <div className="flex items-center gap-1">
                              <button disabled={picked === 0} onClick={() => bump(i.sku, -1, i.qty)} className="w-6 h-6 grid place-items-center rounded-lg border border-white/15 bg-white/8 text-slate-300 hover:bg-white/15 disabled:opacity-30 cursor-pointer"><Minus className="w-3 h-3" /></button>
                              <span className="w-6 text-center text-xs font-mono font-bold text-white">{picked}</span>
                              <button disabled={picked >= 99} onClick={() => bump(i.sku, +1, 99)} className="w-6 h-6 grid place-items-center rounded-lg border border-white/15 bg-white/8 text-slate-300 hover:bg-white/15 disabled:opacity-30 cursor-pointer"><Plus className="w-3 h-3" /></button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-xs text-slate-400">{pickedCount} items selected · availability will be verified by Admin</p>
                  </div>
                ) : (
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 block">Details for approver</label>
                    <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
                      placeholder="Why is this needed? Any context…" className={lightInput} />
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 block">Priority</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {priorities.map(p => (
                      <button key={p} onClick={() => setPriority(p)}
                        className={`py-2 text-[10px] font-bold rounded-xl border capitalize transition-all cursor-pointer ${
                          priority === p
                                ? "bg-indigo-500/80 border-indigo-400/60 text-white shadow-md shadow-indigo-500/30"
                                : "border-white/20 bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
                        }`}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </>);
}
