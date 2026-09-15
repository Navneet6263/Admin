import { useEffect, useMemo, useRef, useState } from "react";
import { typeLabels, type Priority, type RequestType, type StationeryPick } from "./models";
import { useInventory } from "./liveInventory";
import { RequestStudioShell } from "./request-studio/RequestStudioShell";
import { RequestExtrasForm } from "./request-studio/RequestExtrasForm";
import { RequestStudioFooter } from "./request-studio/RequestStudioFooter";
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

export function NewRequestDialog({ open, initialType, centers = [], homeCenter = "", employeeProfile, onClose, onSubmit }: Props) {
  const [type, setType] = useState<RequestType>("id_card");
  const [chosenDesigns, setChosenDesigns] = useState({ id: false, visiting: false });
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
      setChosenDesigns({ id: false, visiting: false });
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
    if (type === "visiting_card" || type === "id_card") return "";
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

  const updateId = (value: IdCardState) => { setIdCard(value); setChosenDesigns((chosen) => ({ ...chosen, id: true })); };
  const updateVisiting = (value: VCState) => { setVc(value); setChosenDesigns((chosen) => ({ ...chosen, visiting: true })); };
  return <RequestStudioShell type={type} onTypeChange={setType} title={titleText} subtitle={subtitleText}
    designSelected={isID ? chosenDesigns.id : isVC ? chosenDesigns.visiting : false}
    idDetails={idCardDetails(idCard, employeeProfile)} visitingDetails={vc}
    background={bgImage} idBrand={idCard.brand} visitingBrand={vc.brand} profile={employeeProfile}
    onIdSelect={(brand) => updateId({ ...idCard, brand, confirmed: false })}
    onVisitingSelect={(brand) => updateVisiting({ ...vc, brand, confirmed: false })}
    centers={centers} requestCenter={requestCenter} onCenterChange={setRequestCenter}
    submitting={submitting} onClose={onClose}
    footer={<RequestStudioFooter canSubmit={Boolean(canSubmit)} submitting={submitting} error={submitError}
      onClose={onClose} onSubmit={() => void submit()} />}>


            {isID && <IdCardForm value={idCard} onChange={updateId} profile={employeeProfile} inlinePreview={false} />}
            {isVC && <VisitingCardForm value={vc} onChange={updateVisiting} inlinePreview={false} />}
            {isTravel && <TravelForm value={travel} onChange={setTravel} />}
            {isCourier && <CourierForm value={courier} onChange={setCourier} />}
            {isMeeting && <MeetingForm value={meeting} onChange={setMeeting} />}
            {isFooding && <FoodingForm value={fooding} onChange={setFooding} />}

            {!isSpecialized && <RequestExtrasForm isStationery={isStationery} subject={subject} setSubject={setSubject}
              description={description} setDescription={setDescription} priority={priority} setPriority={setPriority}
              stationeryQuery={stationeryQuery} setStationeryQuery={setStationeryQuery} filteredInventory={filteredInventory}
              picks={picks} pickedCount={pickedList.length} bump={bump} />}

  </RequestStudioShell>;
}
