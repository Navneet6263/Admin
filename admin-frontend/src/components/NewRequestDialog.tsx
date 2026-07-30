import { useEffect, useMemo, useState } from "react";
import { X, Minus, Plus, AlertTriangle } from "lucide-react";
import { typeLabels, type Priority, type RequestType, type StationeryPick } from "./models";
import { typeIcon, fmtINR } from "./requestMeta";
import { useInventory, isLow } from "./liveInventory";
import {
  VisitingCardForm, emptyVC, vcValid, summarizeVC, type VCState,
  TravelForm, emptyTravel, travelValid, summarizeTravel, type TravelState,
  CourierForm, emptyCourier, courierValid, summarizeCourier, type CourierState,
  MeetingForm, emptyMeeting, meetingValid, summarizeMeeting, type MeetingState,
  FoodingForm, emptyFooding, foodingValid, summarizeFooding, type FoodingState,
} from "./RequestForms";

interface Props {
  open: boolean;
  initialType?: RequestType | null;
  onClose: () => void;
  onSubmit: (draft: {
    type: RequestType; subject: string; description: string;
    amount: number | null; priority: Priority;
    items?: StationeryPick[]; details?: Record<string, unknown>;
  }) => void;
}

const priorities: Priority[] = ["low", "normal", "high", "urgent"];
const amountRequired: RequestType[] = [];

export function NewRequestDialog({ open, initialType, onClose, onSubmit }: Props) {
  const inventory = useInventory();
  const [type, setType] = useState<RequestType>("id_card");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [priority, setPriority] = useState<Priority>("normal");
  const [picks, setPicks] = useState<Record<string, number>>({});
  const [stationeryQuery, setStationeryQuery] = useState("");

  // specialized state
  const [vc, setVc] = useState<VCState>(emptyVC());
  const [travel, setTravel] = useState<TravelState>(emptyTravel());
  const [courier, setCourier] = useState<CourierState>(emptyCourier());
  const [meeting, setMeeting] = useState<MeetingState>(emptyMeeting());
  const [fooding, setFooding] = useState<FoodingState>(emptyFooding());

  useEffect(() => {
    if (open) {
      setType(initialType ?? "id_card");
      setSubject(""); setDescription(""); setAmount(""); setPriority("normal");
      setPicks({}); setStationeryQuery("");
      setVc(emptyVC()); setTravel(emptyTravel()); setCourier(emptyCourier());
      setMeeting(emptyMeeting()); setFooding(emptyFooding());
    }
  }, [open, initialType]);

  const isStationery = type === "stationery";
  const isVC = type === "visiting_card";
  const isTravel = type === "travel";
  const isCourier = type === "courier";
  const isMeeting = type === "meeting_room";
  const isFooding = type === "fooding";
  const isSpecialized = isVC || isTravel || isCourier || isMeeting || isFooding;

  const pickedList = useMemo<StationeryPick[]>(() => {
    return inventory
      .filter((i) => (picks[i.sku] ?? 0) > 0)
      .map((i) => ({ sku: i.sku, name: i.name, qty: picks[i.sku], price: i.price }));
  }, [inventory, picks]);
  const stationeryTotal = pickedList.reduce((s, p) => s + p.qty * p.price, 0);

  const filteredInventory = useMemo(() => {
    const q = stationeryQuery.trim().toLowerCase();
    return inventory.filter((i) => !q || i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q));
  }, [inventory, stationeryQuery]);

  if (!open) return null;

  const bump = (sku: string, delta: number, max: number) =>
    setPicks((p) => {
      const cur = p[sku] ?? 0;
      const next = Math.max(0, Math.min(max, cur + delta));
      const copy = { ...p };
      if (next === 0) delete copy[sku]; else copy[sku] = next;
      return copy;
    });

  const needsAmount = amountRequired.includes(type);
  const canSubmit =
    isVC ? vcValid(vc) :
    isTravel ? travelValid(travel) :
    isCourier ? courierValid(courier) :
    isMeeting ? meetingValid(meeting) :
    isFooding ? foodingValid(fooding) :
    isStationery ? pickedList.length > 0 :
    (subject.trim().length > 3 && description.trim().length > 5 && (!needsAmount || Number(amount) > 0));

  const submit = () => {
    if (!canSubmit) return;
    if (isVC) {
      const { subject: s, description: d } = summarizeVC(vc);
      onSubmit({ type, subject: s, description: d, amount: null, priority, details: vc as unknown as Record<string, unknown> });
      return;
    }
    if (isTravel) {
      const { subject: s, description: d } = summarizeTravel(travel);
      onSubmit({ type, subject: s, description: d, amount: null, priority, details: travel as unknown as Record<string, unknown> });
      return;
    }
    if (isCourier) {
      const { subject: s, description: d } = summarizeCourier(courier);
      onSubmit({ type, subject: s, description: d, amount: courier.declaredValue ? Number(courier.declaredValue) : null, priority, details: courier as unknown as Record<string, unknown> });
      return;
    }
    if (isMeeting) {
      const { subject: s, description: d } = summarizeMeeting(meeting);
      onSubmit({ type, subject: s, description: d, amount: null, priority, details: meeting as unknown as Record<string, unknown> });
      return;
    }
    if (isFooding) {
      const { subject: s, description: d, amount: est } = summarizeFooding(fooding);
      onSubmit({ type, subject: s, description: d, amount: est || null, priority, details: fooding as unknown as Record<string, unknown> });
      return;
    }
    if (isStationery) {
      const summary = pickedList.map((p) => `${p.qty}× ${p.name}`).join(", ");
      const autoSubject = subject.trim() || `Stationery — ${pickedList.length} item${pickedList.length === 1 ? "" : "s"}`;
      onSubmit({
        type, subject: autoSubject,
        description: `Stationery request:\n${summary}\n\nEstimated total: ${fmtINR(stationeryTotal)}${description.trim() ? `\n\nNote: ${description.trim()}` : ""}`,
        amount: stationeryTotal, priority, items: pickedList,
      });
      return;
    }
    onSubmit({
      type, subject: subject.trim(), description: description.trim(),
      amount: needsAmount ? Number(amount) : null, priority,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-400">New Submission</p>
            <h2 className="font-display text-lg font-semibold text-slate-900">Raise a request</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 grid place-items-center rounded-md hover:bg-slate-100 text-slate-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Category</p>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
              {(Object.keys(typeLabels) as RequestType[]).map((t) => {
                const Icon = typeIcon[t];
                const active = t === type;
                return (
                  <button key={t} onClick={() => setType(t)}
                    className={`flex flex-col items-center gap-1.5 p-2.5 rounded-lg border text-[10px] text-center transition-colors ${
                      active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-600 hover:border-slate-400 hover:bg-slate-50"
                    }`}>
                    <Icon className="w-4 h-4" strokeWidth={1.75} />
                    <span className="leading-tight">{typeLabels[t]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {isVC && <VisitingCardForm value={vc} onChange={setVc} />}
          {isTravel && <TravelForm value={travel} onChange={setTravel} />}
          {isCourier && <CourierForm value={courier} onChange={setCourier} />}
          {isMeeting && <MeetingForm value={meeting} onChange={setMeeting} />}
          {isFooding && <FoodingForm value={fooding} onChange={setFooding} />}

          {!isSpecialized && (
            <>
              <Field label="Subject">
                <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120}
                  placeholder={isStationery ? "e.g. Monthly stationery restock — design pod" : "Short summary (e.g. Replacement ID card — lost)"}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300" />
              </Field>

              {isStationery ? (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Pick items from stock</p>
                    <input value={stationeryQuery} onChange={(e) => setStationeryQuery(e.target.value)} placeholder="Search…"
                      className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 w-40 focus:outline-none focus:ring-2 focus:ring-slate-300" />
                  </div>
                  <div className="border border-slate-200 rounded-lg max-h-64 overflow-y-auto divide-y divide-slate-50">
                    {filteredInventory.map((i) => {
                      const picked = picks[i.sku] ?? 0;
                      const low = isLow(i);
                      const out = i.qty === 0;
                      return (
                        <div key={i.sku} className={`flex items-center gap-3 px-3 py-2 ${picked > 0 ? "bg-slate-50" : ""}`}>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-slate-800 truncate">{i.name}</p>
                            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500">
                              <span className="font-mono">{i.sku}</span>
                              <span>·</span>
                              <span>{i.unit}</span>
                              <span>·</span>
                              <span className="font-mono">{fmtINR(i.price)}</span>
                              <span className={`ml-1 inline-flex items-center gap-1 ${low ? "text-rose-600 font-semibold" : ""}`}>
                                {low && <AlertTriangle className="w-2.5 h-2.5" />}
                                {out ? "Out of stock" : `${i.qty} in stock`}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button disabled={picked === 0} onClick={() => bump(i.sku, -1, i.qty)}
                              className="w-6 h-6 grid place-items-center rounded border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30"><Minus className="w-3 h-3" /></button>
                            <span className="w-8 text-center text-xs font-mono tabular-nums font-semibold">{picked}</span>
                            <button disabled={out || picked >= i.qty} onClick={() => bump(i.sku, +1, i.qty)}
                              className="w-6 h-6 grid place-items-center rounded border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30"><Plus className="w-3 h-3" /></button>
                          </div>
                        </div>
                      );
                    })}
                    {filteredInventory.length === 0 && (
                      <div className="p-6 text-center text-xs text-slate-400">No items match.</div>
                    )}
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-slate-500">{pickedList.length} item{pickedList.length === 1 ? "" : "s"} selected</span>
                    <span className="font-mono font-semibold text-slate-900">Total {fmtINR(stationeryTotal)}</span>
                  </div>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
                    placeholder="Optional note for admin…"
                    className="mt-3 w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300" />
                </div>
              ) : (
                <Field label="Details for approver">
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4}
                    placeholder="Why is this needed? Any dates, vendors, or context…"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300" />
                </Field>
              )}

              {!isStationery && needsAmount && (
                <Field label="Amount (₹)">
                  <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
                    inputMode="numeric" placeholder="0"
                    className="w-full text-sm font-mono tabular-nums border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300" />
                </Field>
              )}
            </>
          )}

          <Field label="Priority">
            <div className="flex gap-1">
              {priorities.map((p) => (
                <button key={p} onClick={() => setPriority(p)}
                  className={`flex-1 py-1.5 text-[11px] font-medium rounded border capitalize transition-colors ${
                    priority === p ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                  }`}>{p}</button>
              ))}
            </div>
          </Field>
        </div>

        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <p className="text-[11px] text-slate-500">Request routes to Admin → Super Admin (if needed).</p>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900">Cancel</button>
            <button onClick={submit} disabled={!canSubmit}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed">
              Submit request
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">{label}</p>
      {children}
    </div>
  );
}
