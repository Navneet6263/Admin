import { useEffect, useMemo, useRef, useState } from "react";
import { X, Minus, Plus, Sparkles, CheckCircle2, ArrowRight, Loader2 } from "lucide-react";
import { typeLabels, type Priority, type RequestType, type StationeryPick } from "./models";
import { typeIcon } from "./requestMeta";
import { useInventory } from "./liveInventory";
import { CenterCombobox } from "./CenterCombobox";
import {
  IdCardForm, emptyIdCard, idCardValid, idCardDetails, summarizeIdCard, type IdCardState, type RequesterProfile,
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
  centers?: Array<{ code: string; name: string; city: string }>;
  homeCenter?: string;
  employeeProfile?: RequesterProfile;
  onClose: () => void;
  onSubmit: (draft: {
    type: RequestType; subject: string; description: string;
    amount: number | null; priority: Priority;
    items?: StationeryPick[]; details?: Record<string, unknown>;
    request_center_code: string;
    client_request_id: string;
  }) => Promise<void>;
}

const priorities: Priority[] = ["low", "normal", "high", "urgent"];

export function NewRequestDialog({ open, initialType, centers = [], homeCenter = "", employeeProfile, onClose, onSubmit }: Props) {
  const [type, setType] = useState<RequestType>("id_card");
  const inventory = useInventory(open && type === "stationery");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [priority, setPriority] = useState<Priority>("normal");
  const [picks, setPicks] = useState<Record<string, number>>({});
  const [stationeryQuery, setStationeryQuery] = useState("");
  const [requestCenter, setRequestCenter] = useState(homeCenter);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const submitLock = useRef(false);
  const submissionKey = useRef("");

  const [idCard, setIdCard] = useState<IdCardState>(emptyIdCard());
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
      setSubmitting(false); setSubmitError(""); submitLock.current = false;
      submissionKey.current = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
      setRequestCenter(homeCenter || centers[0]?.code || "");
      setIdCard(emptyIdCard()); setVc(emptyVC()); setTravel(emptyTravel()); setCourier(emptyCourier());
      setMeeting(emptyMeeting()); setFooding(emptyFooding());
    }
  }, [open, initialType, homeCenter, centers]);

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
  const isID = type === "id_card";
  const isVC = type === "visiting_card";
  const isTravel = type === "travel";
  const isCourier = type === "courier";
  const isMeeting = type === "meeting_room";
  const isFooding = type === "fooding";
  const isSpecialized = isID || isVC || isTravel || isCourier || isMeeting || isFooding;

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
    isID ? idCardValid(idCard, employeeProfile) : isVC ? vcValid(vc) : isTravel ? travelValid(travel) : isCourier ? courierValid(courier) :
    isMeeting ? meetingValid(meeting) : isFooding ? foodingValid(fooding) :
    isStationery ? pickedList.length > 0 : subject.trim().length > 3 && description.trim().length > 5;

  const submit = async () => {
    if (!canSubmit || submitLock.current) return;
    submitLock.current = true; setSubmitting(true); setSubmitError("");
    const base = { type, priority, client_request_id: submissionKey.current, request_center_code: requestCenter };
    let draft: Parameters<Props["onSubmit"]>[0];
    if (isID) {
      const summary = summarizeIdCard(idCard);
      draft = { ...base, ...summary, amount: null, details: { ...idCardDetails(idCard, employeeProfile),
        issueType: idCard.issueType, reason: idCard.reason, profileCompany: employeeProfile?.company,
        profileCenter: employeeProfile?.center_code, profileEmail: employeeProfile?.email } };
    } else if (isVC) draft = { ...base, ...summarizeVC(vc), amount: null, details: vc as unknown as Record<string, unknown> };
    else if (isTravel) draft = { ...base, ...summarizeTravel(travel), amount: null, details: travel as unknown as Record<string, unknown> };
    else if (isCourier) draft = { ...base, ...summarizeCourier(courier), amount: courier.declaredValue ? Number(courier.declaredValue) : null, details: courier as unknown as Record<string, unknown> };
    else if (isMeeting) draft = { ...base, ...summarizeMeeting(meeting), amount: null, details: meeting as unknown as Record<string, unknown> };
    else if (isFooding) { const summary = summarizeFooding(fooding); draft = { ...base, subject: summary.subject, description: summary.description, amount: summary.amount || null, details: fooding as unknown as Record<string, unknown> }; }
    else if (isStationery) draft = { ...base, subject: subject.trim() || `Stationery order — ${pickedList.length} items`,
      description: pickedList.map(p => `• ${p.name} (${p.sku}) × ${p.qty}`).join("\n") + (description ? `\n\nNote: ${description}` : ""), amount: stationeryTotal, items: pickedList };
    else draft = { ...base, subject: subject.trim(), description: description.trim(), amount: amount ? Number(amount) : null };
    try { await onSubmit(draft); }
    catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Request could not be submitted. Please retry.");
      submitLock.current = false; setSubmitting(false);
    }
  };

  const titleText =
    type === "travel" ? (travel.mode === "train" ? "High-Speed Train Booking" : travel.mode === "flight" ? "Executive Flight Desk" : "Express Taxi Booking")
    : type === "fooding" ? "Corporate Gourmet Catering"
    : type === "visiting_card" ? "Visiting Card Print Studio"
    : type === "id_card" ? "Smart Employee ID Card"
    : type === "stationery" ? "Stationery Request"
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
  const lightInput = "w-full text-sm font-medium border border-white/15 rounded-xl px-3.5 py-2.5 text-slate-100 bg-slate-900/55 placeholder:text-slate-400 focus:outline-none focus:bg-slate-900/75 focus:ring-2 focus:ring-indigo-400/35 focus:border-indigo-300/50 transition-all [color-scheme:dark]";

  return (
    <>
      {/* Blurred backdrop */}
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md animate-in fade-in duration-300" onClick={() => { if (!submitting) onClose(); }} />

      {/* Full-width drawer panel — photo fills entire background */}
      <div
        className="fixed inset-y-0 right-0 z-50 w-full max-w-6xl overflow-hidden animate-in slide-in-from-right duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Full-bleed AI Photo Background ── */}
        <img key={bgImage} src={bgImage} alt="" className="absolute inset-0 w-full h-full object-cover transition-all duration-700" />

        {/* Light left-side vignette so left text pops */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/20 to-black/10" />
        {/* Bottom vignette */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

        {/* ── Close button — top right floating ── */}
        <button onClick={onClose} disabled={submitting} aria-label="Close new request" className="absolute top-6 right-6 z-30 w-9 h-9 grid place-items-center rounded-full bg-black/40 backdrop-blur-md border border-white/20 text-white hover:bg-black/60 transition-all shadow-lg cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
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
        <div className="absolute inset-y-4 right-4 w-[560px] max-w-[calc(100%-2rem)] flex flex-col rounded-3xl overflow-hidden border border-white/20 shadow-2xl bg-white/12 backdrop-blur-2xl">

          {/* Card Header */}
          <div className="px-4 py-3 pr-14 border-b border-white/15 shrink-0">
            <div className="flex items-center gap-2">
              <p className="text-xs font-bold text-white shrink-0">New Request</p>
              <span className="text-[10px] text-white/45 truncate">Inventory · {homeCenter || "Unassigned"}</span>
              <CenterCombobox centers={centers} value={requestCenter} onChange={setRequestCenter} dark className="ml-auto w-48 max-w-[55%]" />
            </div>
          </div>

          {/* Category selector pills */}
          <div className="request-scrollbar px-4 py-2 border-b border-white/10 shrink-0 overflow-x-auto">
            <div className="flex gap-1.5 min-w-max">
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
          <div className="request-scrollbar flex-1 overflow-y-auto px-5 py-4 space-y-4">

            {isID && <IdCardForm value={idCard} onChange={setIdCard} profile={employeeProfile} />}
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
                    <p className="mt-2 text-xs text-slate-400">{pickedList.length} items selected · availability will be verified by Admin</p>
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
            <p className="text-[10px] text-white/40 mb-3">{isVC ? "You → Center Admin · HQ Admin · Super Admin" : "You → Center Admin → Super Admin"}</p>
            {submitError && <p role="alert" className="mb-3 text-xs font-medium text-rose-300">{submitError}</p>}
            <div className="flex items-center gap-2">
              <button onClick={onClose} disabled={submitting} className="flex-1 py-2.5 text-xs font-semibold text-white/60 hover:text-white border border-white/15 hover:border-white/30 rounded-xl transition-all bg-white/8 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                Cancel
              </button>
              <button onClick={() => void submit()} disabled={!canSubmit || submitting}
                className="flex-1 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-600/40 disabled:opacity-35 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer">
                {submitting ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Submitting…</> : <>Submit <ArrowRight className="w-3.5 h-3.5" /></>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
