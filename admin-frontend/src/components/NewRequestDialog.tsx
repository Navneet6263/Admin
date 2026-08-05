import { useEffect, useMemo, useState } from "react";
import { X, Minus, Plus, AlertTriangle, Sparkles, CheckCircle2, ArrowRight } from "lucide-react";
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

import bgTrain from "@/assets/category-bg/travel_train.jpg";
import bgFlight from "@/assets/category-bg/travel_flight.jpg";
import bgTaxi from "@/assets/category-bg/travel_taxi.jpg";
import bgFooding from "@/assets/category-bg/fooding.jpg";
import bgVC from "@/assets/category-bg/visiting_card.jpg";
import bgStationery from "@/assets/category-bg/stationery.jpg";
import bgCourier from "@/assets/category-bg/courier.jpg";
import bgMeeting from "@/assets/category-bg/meeting.jpg";

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

export function NewRequestDialog({ open, initialType, onClose, onSubmit }: Props) {
  const inventory = useInventory();
  const [type, setType] = useState<RequestType>("id_card");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [priority, setPriority] = useState<Priority>("normal");
  const [picks, setPicks] = useState<Record<string, number>>({});
  const [stationeryQuery, setStationeryQuery] = useState("");

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

  const bgImage = useMemo(() => {
    if (type === "travel") {
      if (travel.mode === "train") return bgTrain;
      if (travel.mode === "flight") return bgFlight;
      return bgTaxi;
    }
    if (type === "fooding") return bgFooding;
    if (type === "visiting_card" || type === "id_card") return bgVC;
    if (type === "stationery") return bgStationery;
    if (type === "courier") return bgCourier;
    if (type === "meeting_room") return bgMeeting;
    return bgStationery;
  }, [type, travel.mode]);

  const isStationery = type === "stationery";
  const isVC = type === "visiting_card";
  const isTravel = type === "travel";
  const isCourier = type === "courier";
  const isMeeting = type === "meeting_room";
  const isFooding = type === "fooding";
  const isSpecialized = isVC || isTravel || isCourier || isMeeting || isFooding;

  const pickedList = useMemo<StationeryPick[]>(() =>
    inventory.filter(i => (picks[i.sku] ?? 0) > 0)
      .map(i => ({ sku: i.sku, name: i.name, qty: picks[i.sku], price: i.price }))
  , [inventory, picks]);
  const stationeryTotal = pickedList.reduce((s, p) => s + p.qty * p.price, 0);
  const filteredInventory = useMemo(() => {
    const q = stationeryQuery.trim().toLowerCase();
    return inventory.filter(i => !q || i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q));
  }, [inventory, stationeryQuery]);

  if (!open) return null;

  const bump = (sku: string, delta: number, max: number) =>
    setPicks(p => {
      const cur = p[sku] ?? 0; const next = Math.max(0, Math.min(max, cur + delta));
      const copy = { ...p }; if (next === 0) delete copy[sku]; else copy[sku] = next; return copy;
    });

  const canSubmit =
    isVC ? vcValid(vc) : isTravel ? travelValid(travel) : isCourier ? courierValid(courier) :
    isMeeting ? meetingValid(meeting) : isFooding ? foodingValid(fooding) :
    isStationery ? pickedList.length > 0 : subject.trim().length > 3 && description.trim().length > 5;

  const submit = () => {
    if (!canSubmit) return;
    if (isVC) { const { subject: s, description: d } = summarizeVC(vc); onSubmit({ type, subject: s, description: d, amount: null, priority, details: vc as unknown as Record<string, unknown> }); return; }
    if (isTravel) { const { subject: s, description: d } = summarizeTravel(travel); onSubmit({ type, subject: s, description: d, amount: null, priority, details: travel as unknown as Record<string, unknown> }); return; }
    if (isCourier) { const { subject: s, description: d } = summarizeCourier(courier); onSubmit({ type, subject: s, description: d, amount: courier.declaredValue ? Number(courier.declaredValue) : null, priority, details: courier as unknown as Record<string, unknown> }); return; }
    if (isMeeting) { const { subject: s, description: d } = summarizeMeeting(meeting); onSubmit({ type, subject: s, description: d, amount: null, priority, details: meeting as unknown as Record<string, unknown> }); return; }
    if (isFooding) { const { subject: s, description: d, amount: est } = summarizeFooding(fooding); onSubmit({ type, subject: s, description: d, amount: est || null, priority, details: fooding as unknown as Record<string, unknown> }); return; }
    if (isStationery) {
      const s = subject.trim() || `Stationery order — ${pickedList.length} items (${fmtINR(stationeryTotal)})`;
      const d = pickedList.map(p => `• ${p.name} (${p.sku}) × ${p.qty}`).join("\n") + (description ? `\n\nNote: ${description}` : "");
      onSubmit({ type, subject: s, description: d, amount: stationeryTotal, priority, items: pickedList }); return;
    }
    onSubmit({ type, subject: subject.trim(), description: description.trim(), amount: amount ? Number(amount) : null, priority });
  };

  const titleText =
    type === "travel" ? (travel.mode === "train" ? "High-Speed Train Booking" : travel.mode === "flight" ? "Executive Flight Desk" : "Express Taxi Booking")
    : type === "fooding" ? "Corporate Gourmet Catering"
    : type === "visiting_card" ? "Visiting Card Print Studio"
    : type === "id_card" ? "Smart Employee ID Card"
    : type === "stationery" ? "Office Supplies Catalog"
    : type === "courier" ? "Express Package Dispatch"
    : type === "meeting_room" ? "Executive Boardroom Desk"
    : typeLabels[type];

  const subtitleText =
    type === "travel" ? "IRCTC / Aviation / Ground transport"
    : type === "fooding" ? "Catering & office meal ordering"
    : type === "stationery" ? "Live inventory catalog"
    : type === "courier" ? "Shiprocket-integrated dispatch"
    : type === "meeting_room" ? "Room booking & AV setup"
    : "Policy verified · Auto-routed";

  // Light input style for use inside the dark card
  const lightInput = "w-full text-sm font-semibold border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 bg-white/95 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/70 focus:border-indigo-300 shadow-sm transition-all";

  return (
    <>
      {/* Blurred backdrop */}
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose} />

      {/* Full-width drawer panel — photo fills entire background */}
      <div
        className="fixed inset-y-0 right-0 z-50 w-full max-w-5xl overflow-hidden animate-in slide-in-from-right duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Full-bleed AI Photo Background ── */}
        <img key={bgImage} src={bgImage} alt="" className="absolute inset-0 w-full h-full object-cover transition-all duration-700" />

        {/* Light left-side vignette so left text pops */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/20 to-black/10" />
        {/* Bottom vignette */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

        {/* ── Close button — top right floating ── */}
        <button onClick={onClose} className="absolute top-5 right-[405px] z-30 w-9 h-9 grid place-items-center rounded-full bg-black/40 backdrop-blur-md border border-white/20 text-white hover:bg-black/60 transition-all shadow-lg cursor-pointer">
          <X className="w-4 h-4" />
        </button>

        {/* ── Left: Big hero title over photo ── */}
        <div className="absolute left-8 bottom-12 z-10 max-w-xs space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-[10px] font-bold uppercase tracking-widest text-white/90">
            <Sparkles className="w-3 h-3 text-indigo-300" /> Quick Raise AI Studio
          </div>
          <h1 className="text-4xl font-black text-white drop-shadow-2xl leading-tight tracking-tight">
            {titleText}
          </h1>
          <p className="text-sm text-white/70 font-medium">{subtitleText}</p>
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" /> Policy verified · Auto-routed to Admin
          </div>
        </div>

        {/* ── RIGHT: Floating Dark Glass Form Card ── */}
        <div className="absolute inset-y-4 right-4 w-[390px] flex flex-col rounded-3xl overflow-hidden border border-white/20 shadow-2xl bg-white/12 backdrop-blur-2xl">

          {/* Card Header */}
          <div className="px-5 pt-5 pb-3 border-b border-white/15 shrink-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-1">New Request</p>
            <p className="text-base font-bold text-white leading-snug">{titleText}</p>
          </div>

          {/* Category selector pills */}
          <div className="px-4 py-3 border-b border-white/10 shrink-0">
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(typeLabels) as RequestType[]).map(t => {
                const Icon = typeIcon[t];
                const active = t === type;
                return (
                  <button key={t} onClick={() => setType(t)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-bold transition-all cursor-pointer ${
                        active
                            ? "border-indigo-400 bg-indigo-500/80 text-white shadow-md shadow-indigo-500/40"
                            : "border-white/20 bg-white/10 text-white/80 hover:bg-white/20 hover:border-white/40 hover:text-white"
                    }`}>
                    <Icon className="w-3 h-3" strokeWidth={2.5} />
                    {typeLabels[t]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scrollable form area */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10">

            {isVC && <VisitingCardForm value={vc} onChange={setVc} />}
            {isTravel && <TravelForm value={travel} onChange={setTravel} />}
            {isCourier && <CourierForm value={courier} onChange={setCourier} />}
            {isMeeting && <MeetingForm value={meeting} onChange={setMeeting} />}
            {isFooding && <FoodingForm value={fooding} onChange={setFooding} />}

            {!isSpecialized && (
              <>
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
                        className="text-xs bg-white/95 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/70 shadow-sm w-28" />
                    </div>
                    <div className="border border-white/10 rounded-xl max-h-44 overflow-y-auto divide-y divide-white/5 bg-black/20 backdrop-blur-sm">
                      {filteredInventory.map(i => {
                        const picked = picks[i.sku] ?? 0; const low = isLow(i); const out = i.qty === 0;
                        return (
                          <div key={i.sku} className={`flex items-center gap-2.5 px-3 py-2 ${picked > 0 ? "bg-indigo-600/15" : ""}`}>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-white truncate">{i.name}</p>
                              <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-400">
                                <span className="font-mono text-indigo-300 font-bold">{fmtINR(i.price)}</span>
                                <span className={`${low ? "text-rose-400 font-bold" : ""}`}>
                                  {low && <AlertTriangle className="w-2.5 h-2.5 inline mr-0.5" />}
                                  {out ? "Out" : `${i.qty} left`}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <button disabled={picked === 0} onClick={() => bump(i.sku, -1, i.qty)} className="w-6 h-6 grid place-items-center rounded-lg border border-white/15 bg-white/8 text-slate-300 hover:bg-white/15 disabled:opacity-30 cursor-pointer"><Minus className="w-3 h-3" /></button>
                              <span className="w-6 text-center text-xs font-mono font-bold text-white">{picked}</span>
                              <button disabled={out || picked >= i.qty} onClick={() => bump(i.sku, +1, i.qty)} className="w-6 h-6 grid place-items-center rounded-lg border border-white/15 bg-white/8 text-slate-300 hover:bg-white/15 disabled:opacity-30 cursor-pointer"><Plus className="w-3 h-3" /></button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="text-slate-400">{pickedList.length} items</span>
                      <span className="font-mono font-bold text-indigo-300">Total {fmtINR(stationeryTotal)}</span>
                    </div>
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
              </>
            )}
          </div>

          {/* Card Footer */}
          <div className="px-5 py-4 border-t border-white/15 bg-white/5 shrink-0">
            <p className="text-[10px] text-white/40 mb-3">You → Center Admin → Super Admin</p>
            <div className="flex items-center gap-2">
              <button onClick={onClose} className="flex-1 py-2.5 text-xs font-semibold text-white/60 hover:text-white border border-white/15 hover:border-white/30 rounded-xl transition-all bg-white/8 cursor-pointer">
                Cancel
              </button>
              <button onClick={submit} disabled={!canSubmit}
                className="flex-1 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-600/40 disabled:opacity-35 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer">
                Submit <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
