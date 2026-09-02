// Specialized sub-forms for the New Request dialog.
// Each form owns its own local UI + returns a `details` payload the admin can review.

import { useState } from "react";
import { Train, Plane, Car, Package, Utensils, Download, CheckCircle2, Clock3 } from "lucide-react";
import { fmtINR } from "./requestMeta";
import { BusinessCardPreview } from "./business-card/BusinessCardPreview";
import { downloadBusinessCardPdf } from "./business-card/businessCardPdf";
import { businessCardTemplate, type BusinessCardBrand, type BusinessCardDetails } from "./business-card/businessCardTemplates";
import { VisionIndiaIdCardPreview } from "./id-card/VisionIndiaIdCardPreview";
import { PhotoCropper } from "./id-card/PhotoCropper";
import { downloadIdCardPdf } from "./id-card/idCardPdf";
import type { IdCardDetails } from "./id-card/visionIndiaIdCard";
import { IndianMobileField, isValidIndianMobile } from "./id-card/IndianMobileField";

/* ---------- shared field helpers ---------- */
const inputCls =
  "w-full text-sm font-medium border border-white/15 rounded-xl px-3.5 py-2.5 text-slate-100 bg-slate-900/55 placeholder:text-slate-400 focus:outline-none focus:bg-slate-900/75 focus:ring-2 focus:ring-indigo-400/35 focus:border-indigo-300/50 transition-all [color-scheme:dark]";
const labelCls = "text-[10px] font-bold uppercase tracking-widest text-slate-300 mb-1.5 block";
const sectionCls = "p-3.5 rounded-2xl border border-white/15 bg-white/8 space-y-3";

export function TextField({
  label, value, onChange, placeholder, type = "text", min, max,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; min?: string; max?: string }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <input type={type} value={value} min={min} max={max} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={inputCls} />
    </div>
  );
}

export function SelectField({
  label, value, onChange, options,
}: { label: string; value: string; onChange: (v: string) => void; options: readonly string[] }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

/* ---------- Visiting card — templates + live preview ---------- */
export type VCState = BusinessCardDetails;
export const emptyVC = (): VCState => ({ brand: "vision_india", name: "", designation: "", phone: "", email: "", address: "", qty: 100, confirmed: false });
export const vcValid = (v: VCState) => v.name.trim().length > 1 && v.designation.trim().length > 1 && v.phone.trim().length >= 7 && v.email.includes("@") && Boolean(v.confirmed);

export function VisitingCardForm({ value, onChange }: { value: VCState; onChange: (v: VCState) => void }) {
  const set = <K extends keyof VCState>(key: K, next: VCState[K]) => onChange({ ...value, [key]: next });
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-indigo-400/25 bg-indigo-500/10 p-3.5">
        <label className={labelCls}>Which company card do you need?</label>
        <div className="grid grid-cols-2 gap-2">
          {(["vision_india", "talent_foundation", "green_call", "green_hr"] as BusinessCardBrand[]).map((brand) => (
            <button key={brand} type="button" onClick={() => set("brand", brand)}
              className={`rounded-xl border px-3 py-3 text-left transition-colors ${value.brand === brand ? "border-indigo-300 bg-indigo-400/20 text-white ring-2 ring-indigo-300/20" : "border-white/15 bg-slate-900/30 text-slate-300 hover:bg-slate-800/60"}`}>
              <span className="block text-[9px] font-bold uppercase tracking-widest text-slate-400">Official template</span>
              <span className="mt-1 block text-sm font-semibold">{businessCardTemplate(brand).name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <TextField label="Full name" value={value.name} onChange={(next) => set("name", next)} placeholder="e.g. Priya Sharma" />
        <TextField label="Designation" value={value.designation} onChange={(next) => set("designation", next)} placeholder="Senior Account Executive" />
        <TextField label="Phone" value={value.phone} onChange={(next) => set("phone", next)} placeholder="+91 98xxxxxx" />
        <TextField label="Email" type="email" value={value.email} onChange={(next) => set("email", next)} placeholder="priya@company.com" />
        <div className="col-span-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs text-slate-400">Company address and branding are locked in the selected official template.</div>
        <div>
          <label className={labelCls}>Quantity</label>
          <select value={value.qty} onChange={(event) => set("qty", Number(event.target.value))} className={inputCls}>
            {[100, 250, 500, 1000].map((quantity) => <option key={quantity} value={quantity}>{quantity} cards</option>)}
          </select>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-slate-900/35 p-4">
        <BusinessCardPreview details={value} />
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
          <button type="button" onClick={() => void downloadBusinessCardPdf(value)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/15">
            <Download className="h-3.5 w-3.5" /> Download PDF preview
          </button>
          <label className="ml-auto inline-flex cursor-pointer items-center gap-2 text-xs text-slate-300">
            <input type="checkbox" checked={Boolean(value.confirmed)} onChange={(event) => set("confirmed", event.target.checked)} className="h-4 w-4 accent-indigo-500" />
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> I verified all card details
          </label>
        </div>
      </div>
    </div>
  );
}

/* ---------- Travel — train / flight / taxi ---------- */
/* ---------- ID card — profile-driven request ---------- */
export interface IdCardState {
  issueType: "new" | "lost" | "damaged" | "details_changed" | "expired";
  reason: string;
  designation: string;
  phone: string;
  bloodGroup: string;
  emergencyPhone: string;
  photoDataUrl: string;
  confirmed: boolean;
}
export interface RequesterProfile {
  id?: number;
  name: string;
  email: string;
  company: string;
  dept: string;
  employee_code?: string | null;
  center_code?: string | null;
}
export const emptyIdCard = (): IdCardState => ({ issueType: "new", reason: "", designation: "", phone: "",
  bloodGroup: "", emergencyPhone: "", photoDataUrl: "", confirmed: false });
export const idCardDetails = (value: IdCardState, profile?: RequesterProfile): IdCardDetails => ({
  brand: "vision_india", name: profile?.name || "Authenticated employee",
  employeeCode: profile?.employee_code || (profile?.id ? `EMP-${String(profile.id).padStart(4, "0")}` : "EMP-PENDING"),
  designation: value.designation.trim() || profile?.dept || "—", department: profile?.dept || "—",
  phone: value.phone, bloodGroup: value.bloodGroup, emergencyPhone: value.emergencyPhone, photoDataUrl: value.photoDataUrl,
});
const idCardReady = (value: IdCardState, profile?: RequesterProfile) => Boolean(value.photoDataUrl &&
  isValidIndianMobile(value.phone) && isValidIndianMobile(value.emergencyPhone) &&
  value.bloodGroup && (value.designation.trim() || profile?.dept));
export const idCardValid = (value: IdCardState, profile?: RequesterProfile) =>
  value.reason.trim().length >= 5 && idCardReady(value, profile) && value.confirmed;

const readIdPhoto = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error("Photo could not be read"));
  reader.onload = () => resolve(String(reader.result));
  reader.readAsDataURL(file);
});

const ID_CARD_REASONS: Array<{ id: IdCardState["issueType"]; label: string; hint: string }> = [
  { id: "new", label: "New / first card", hint: "New joining or first ID card" },
  { id: "lost", label: "Lost card", hint: "Card was lost and needs replacement" },
  { id: "damaged", label: "Damaged card", hint: "Card is broken or unreadable" },
  { id: "details_changed", label: "Details changed", hint: "Name, role or office details changed" },
  { id: "expired", label: "Expired card", hint: "Renew an expired ID card" },
];

export function IdCardForm({ value, onChange, profile }: { value: IdCardState; onChange: (value: IdCardState) => void; profile?: RequesterProfile }) {
  const [cropSource, setCropSource] = useState("");
  const details = idCardDetails(value, profile);
  const set = <K extends keyof IdCardState>(key: K, next: IdCardState[K]) => onChange({ ...value, [key]: next });
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3.5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-300">Employee profile · automatic</p>
        <p className="mt-1 text-sm font-semibold text-white">{profile?.name || "Authenticated employee"}</p>
        <p className="mt-1 text-xs text-slate-300">{profile?.company || "Company from profile"} · {profile?.dept || "Department"}</p>
        <p className="mt-0.5 text-[10px] text-slate-400">{profile?.email || "Work email"} · Center {profile?.center_code || "Unassigned"}</p>
        {profile?.company && profile.company.trim().toLowerCase() !== "vision india" && <p className="mt-2 text-[10px] font-semibold text-indigo-200">Selected ID-card template: Vision India · additional company templates can be added next.</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <TextField label="Designation" value={value.designation} onChange={(next) => set("designation", next)} placeholder={profile?.dept || "Designation"} />
        <IndianMobileField label="Contact number" value={value.phone} onChange={(next) => set("phone", next)} />
        <SelectField label="Blood group" value={value.bloodGroup} onChange={(next) => set("bloodGroup", next)} options={["", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]} />
        <IndianMobileField label="Emergency number" value={value.emergencyPhone} onChange={(next) => set("emergencyPhone", next)} />
      </div>

      <div className="rounded-xl border border-white/15 bg-white/5 p-3">
        <div className="flex items-center gap-3">
          <div className="h-16 w-14 overflow-hidden rounded-lg border border-white/20 bg-slate-100">
            {value.photoDataUrl ? <img src={value.photoDataUrl} alt="ID preview" className="h-full w-full object-contain" /> : <span className="grid h-full place-items-center text-[9px] text-slate-400">PHOTO</span>}
          </div>
          <div className="min-w-0 flex-1"><p className="text-xs font-semibold text-white">Employee photograph *</p><p className="mt-0.5 text-[10px] text-slate-400">Upload a clear front-facing passport photo.</p></div>
          <label className="cursor-pointer rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-[10px] font-semibold text-white hover:bg-white/15">
            {value.photoDataUrl ? "Change" : "Upload"}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only"
              onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = "";
                if (file) void readIdPhoto(file).then(setCropSource); }} />
          </label>
        </div>
      </div>
      {cropSource && <PhotoCropper source={cropSource} onCancel={() => setCropSource("")}
        onApply={(photo) => { set("photoDataUrl", photo); setCropSource(""); }} />}

      <div className="rounded-xl border border-white/10 bg-slate-950/35 p-3">
        <VisionIndiaIdCardPreview details={details} />
        <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3">
          <button type="button" disabled={!idCardReady(value, profile)} onClick={() => void downloadIdCardPdf(details)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40">
            <Download className="h-3.5 w-3.5" /> Download PDF preview
          </button>
          <label className="ml-auto inline-flex cursor-pointer items-center gap-2 text-xs text-slate-300">
            <input type="checkbox" checked={value.confirmed} onChange={(event) => set("confirmed", event.target.checked)} className="h-4 w-4 accent-indigo-500" />
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Details verified
          </label>
        </div>
      </div>

      <div>
        <label className={labelCls}>Why do you need an ID card?</label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {ID_CARD_REASONS.map((reason) => (
            <button key={reason.id} type="button" onClick={() => onChange({ ...value, issueType: reason.id })}
              className={`rounded-xl border p-3 text-left transition-colors ${value.issueType === reason.id ? "border-indigo-300 bg-indigo-400/20 text-white ring-2 ring-indigo-300/20" : "border-white/15 bg-slate-900/30 text-slate-300 hover:bg-slate-800/60"}`}>
              <span className="block text-xs font-semibold">{reason.label}</span>
              <span className="mt-0.5 block text-[10px] text-slate-400">{reason.hint}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className={labelCls}>Reason / explanation *</label>
        <textarea value={value.reason} onChange={(event) => set("reason", event.target.value)} rows={4}
          placeholder={value.issueType === "lost" ? "Where and how was the card lost?" : "Briefly explain why a new ID card is required…"}
          className={inputCls} maxLength={500} />
        <p className="mt-1 text-[10px] text-slate-400">Name, company, department and center will be taken from your employee profile.</p>
      </div>
    </div>
  );
}

export function summarizeIdCard(value: IdCardState) {
  const label = ID_CARD_REASONS.find((reason) => reason.id === value.issueType)?.label || "ID card";
  return { subject: `Vision India ID Card — ${label}`, description: value.reason.trim() };
}

export type TravelMode = "train" | "flight" | "taxi";
export interface Pax { name: string; age: string; gender: "Male" | "Female" | "Other"; }
export interface TravelState {
  mode: TravelMode;
  purpose: string;
  from: string; to: string; date: string; returnDate: string;
  klass: string; meal: "Veg" | "Non-Veg" | "None";
  pax: Pax[]; contactMob: string; seatPref: string;
  taxiType: "Sedan" | "SUV" | "Hatchback"; pickupTime: string;
}
export const emptyTravel = (): TravelState => ({
  mode: "train", purpose: "", from: "", to: "", date: "", returnDate: "",
  klass: "3A", meal: "Veg",
  pax: [{ name: "", age: "", gender: "Male" }],
  contactMob: "", seatPref: "No preference",
  taxiType: "Sedan", pickupTime: "",
});
export const travelValid = (t: TravelState) => {
  if (!t.from.trim() || !t.to.trim() || !t.date || !t.purpose.trim()) return false;
  if (t.mode === "taxi") return !!t.pickupTime && !!t.taxiType;
  return t.pax.length > 0 && t.pax.every((p) => p.name.trim() && p.age.trim()) && t.contactMob.trim().length >= 7;
};

export function TravelForm({ value, onChange }: { value: TravelState; onChange: (v: TravelState) => void }) {
  const set = <K extends keyof TravelState>(k: K, v: TravelState[K]) => onChange({ ...value, [k]: v });
  const modes: { id: TravelMode; label: string; icon: typeof Train }[] = [
    { id: "train", label: "Train (IRCTC)", icon: Train },
    { id: "flight", label: "Flight", icon: Plane },
    { id: "taxi", label: "Taxi", icon: Car },
  ];
  const trainClasses = ["1A", "2A", "3A", "SL", "CC", "EC"] as const;
  const flightClasses = ["Economy", "Premium Economy", "Business"] as const;

  const addPax = () => set("pax", [...value.pax, { name: "", age: "", gender: "Male" }]);
  const updPax = (i: number, patch: Partial<Pax>) => set("pax", value.pax.map((p, idx) => idx === i ? { ...p, ...patch } : p));
  const rmPax = (i: number) => set("pax", value.pax.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {modes.map((m) => {
          const active = value.mode === m.id;
          return (
            <button key={m.id} type="button" onClick={() => set("mode", m.id)}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                active
                  ? "border-indigo-500 bg-indigo-600 text-white shadow-md shadow-indigo-500/40"
                  : "border-white/10 bg-white/8 text-slate-300 hover:bg-white/15 hover:border-white/25 hover:text-white"
              }`}>
              <m.icon className="w-4 h-4" /> {m.label}
            </button>
          );
        })}
      </div>

      <div>
        <TextField label="Purpose of travel / Reason *" value={value.purpose} onChange={(v) => set("purpose", v)} placeholder="e.g. Client site audit & quarterly meeting at Patna office" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <TextField label={value.mode === "taxi" ? "Pickup point" : "From"} value={value.from} onChange={(v) => set("from", v)} placeholder="e.g. New Delhi" />
        <TextField label={value.mode === "taxi" ? "Drop point" : "To"} value={value.to} onChange={(v) => set("to", v)} placeholder="e.g. Patna" />
        <TextField label={value.mode === "taxi" ? "Date" : "Onward date"} type="date" value={value.date} onChange={(v) => set("date", v)} />
        {value.mode !== "taxi" && (
          <TextField label="Return date (optional)" type="date" value={value.returnDate} onChange={(v) => set("returnDate", v)} />
        )}
      </div>

      {value.mode === "train" && (
        <div className="grid grid-cols-3 gap-3">
          <SelectField label="Class" value={value.klass} onChange={(v) => set("klass", v)} options={trainClasses} />
          <SelectField label="Meal" value={value.meal} onChange={(v) => set("meal", v as TravelState["meal"])} options={["Veg", "Non-Veg", "None"]} />
          <SelectField label="Seat preference" value={value.seatPref} onChange={(v) => set("seatPref", v)} options={["No preference", "Lower", "Middle", "Upper", "Window", "Aisle"]} />
        </div>
      )}
      {value.mode === "flight" && (
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Cabin class" value={value.klass} onChange={(v) => set("klass", v)} options={flightClasses} />
          <SelectField label="Meal" value={value.meal} onChange={(v) => set("meal", v as TravelState["meal"])} options={["Veg", "Non-Veg", "None"]} />
        </div>
      )}
      {value.mode === "taxi" && (
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Vehicle" value={value.taxiType} onChange={(v) => set("taxiType", v as TravelState["taxiType"])} options={["Sedan", "SUV", "Hatchback"]} />
          <TextField label="Pickup time" type="time" value={value.pickupTime} onChange={(v) => set("pickupTime", v)} />
        </div>
      )}

      {value.mode !== "taxi" && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className={labelCls + " mb-0"}>Passengers</label>
            <button type="button" onClick={addPax} className="text-[11px] font-semibold text-slate-900 hover:underline cursor-pointer">+ Add passenger</button>
          </div>
          <div className="space-y-2">
            {value.pax.map((p, i) => (
              <div key={i} className="grid grid-cols-[1fr_70px_100px_28px] gap-2">
                <input value={p.name} onChange={(e) => updPax(i, { name: e.target.value })} placeholder={`Passenger ${i + 1} name`} className={inputCls} />
                <input value={p.age} onChange={(e) => updPax(i, { age: e.target.value.replace(/[^0-9]/g, "") })} placeholder="Age" className={inputCls} />
                <select value={p.gender} onChange={(e) => updPax(i, { gender: e.target.value as Pax["gender"] })} className={inputCls}>
                  <option>Male</option><option>Female</option><option>Other</option>
                </select>
                <button type="button" disabled={value.pax.length === 1} onClick={() => rmPax(i)}
                  className="text-slate-400 hover:text-rose-600 disabled:opacity-30 text-lg">×</button>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <TextField label="Contact mobile" value={value.contactMob} onChange={(v) => set("contactMob", v)} placeholder="+91 …" />
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Courier — Shiprocket-style ---------- */
export interface CourierState {
  senderName: string; senderPhone: string; senderAddress: string; senderPin: string;
  receiverName: string; receiverPhone: string; receiverAddress: string; receiverPin: string;
  weightKg: string; lengthCm: string; widthCm: string; heightCm: string;
  mode: "Surface" | "Air" | "Express";
  contents: string; declaredValue: string;
}
export const emptyCourier = (): CourierState => ({
  senderName: "", senderPhone: "", senderAddress: "", senderPin: "",
  receiverName: "", receiverPhone: "", receiverAddress: "", receiverPin: "",
  weightKg: "", lengthCm: "", widthCm: "", heightCm: "",
  mode: "Surface", contents: "", declaredValue: "",
});
export const courierValid = (c: CourierState) =>
  c.senderName.trim() && c.senderPhone.trim() && c.senderPin.trim() &&
  c.receiverName.trim() && c.receiverPhone.trim() && c.receiverPin.trim() &&
  c.weightKg && c.contents.trim().length > 1;

export function CourierForm({ value, onChange }: { value: CourierState; onChange: (v: CourierState) => void }) {
  const set = <K extends keyof CourierState>(k: K, v: CourierState[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="space-y-4">
      <div className={sectionCls}>
        <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 flex items-center gap-1.5">
          <Package className="w-3.5 h-3.5" /> Sender (Pickup)
        </p>
        <div className="grid grid-cols-2 gap-2">
          <TextField label="Name" value={value.senderName} onChange={(v) => set("senderName", v)} />
          <TextField label="Phone" value={value.senderPhone} onChange={(v) => set("senderPhone", v)} />
          <div className="col-span-2"><TextField label="Address" value={value.senderAddress} onChange={(v) => set("senderAddress", v)} /></div>
          <TextField label="PIN code" value={value.senderPin} onChange={(v) => set("senderPin", v.replace(/[^0-9]/g, ""))} />
        </div>
      </div>

      <div className={sectionCls}>
        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 flex items-center gap-1.5">
          <Package className="w-3.5 h-3.5" /> Receiver (Drop)
        </p>
        <div className="grid grid-cols-2 gap-2">
          <TextField label="Name" value={value.receiverName} onChange={(v) => set("receiverName", v)} />
          <TextField label="Phone" value={value.receiverPhone} onChange={(v) => set("receiverPhone", v)} />
          <div className="col-span-2"><TextField label="Address" value={value.receiverAddress} onChange={(v) => set("receiverAddress", v)} /></div>
          <TextField label="PIN code" value={value.receiverPin} onChange={(v) => set("receiverPin", v.replace(/[^0-9]/g, ""))} />
        </div>
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 mb-2">Package</p>
        <div className="grid grid-cols-4 gap-2">
          <TextField label="Weight (kg)" value={value.weightKg} onChange={(v) => set("weightKg", v)} placeholder="0.5" />
          <TextField label="L (cm)" value={value.lengthCm} onChange={(v) => set("lengthCm", v)} />
          <TextField label="W (cm)" value={value.widthCm} onChange={(v) => set("widthCm", v)} />
          <TextField label="H (cm)" value={value.heightCm} onChange={(v) => set("heightCm", v)} />
        </div>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <SelectField label="Mode" value={value.mode} onChange={(v) => set("mode", v as CourierState["mode"])} options={["Surface", "Air", "Express"]} />
          <TextField label="Declared value (₹)" value={value.declaredValue} onChange={(v) => set("declaredValue", v.replace(/[^0-9]/g, ""))} />
        </div>
        <div className="mt-2"><TextField label="Contents" value={value.contents} onChange={(v) => set("contents", v)} placeholder="Signed contracts, documents…" /></div>
      </div>
    </div>
  );
}

/* ---------- Meeting room ---------- */
export interface MeetingState {
  room: string; date: string; startTime: string; durationHrs: string;
  hostName: string; hostPhone: string; attendees: string;
  reason: string; needsAV: boolean; needsRefreshments: boolean;
}
export const emptyMeeting = (): MeetingState => ({
  room: "Board Room A", date: "", startTime: "", durationHrs: "1",
  hostName: "", hostPhone: "", attendees: "",
  reason: "", needsAV: false, needsRefreshments: false,
});
export const meetingValid = (m: MeetingState) =>
  m.room && m.date && m.startTime && m.hostName.trim() && m.hostPhone.trim() && m.reason.trim().length > 3;

export function MeetingForm({ value, onChange }: { value: MeetingState; onChange: (v: MeetingState) => void }) {
  const set = <K extends keyof MeetingState>(k: K, v: MeetingState[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Room" value={value.room} onChange={(v) => set("room", v)}
          options={["Board Room A", "Board Room B", "Huddle 1", "Huddle 2", "Training Hall", "Client Lounge"]} />
        <TextField label="Date" type="date" value={value.date} onChange={(v) => set("date", v)} />
        <TextField label="Start time" type="time" value={value.startTime} onChange={(v) => set("startTime", v)} />
        <SelectField label="Duration" value={value.durationHrs} onChange={(v) => set("durationHrs", v)}
          options={["0.5", "1", "1.5", "2", "3", "4", "8"]} />
        <TextField label="Host / meeting leader" value={value.hostName} onChange={(v) => set("hostName", v)} />
        <TextField label="Host phone" value={value.hostPhone} onChange={(v) => set("hostPhone", v)} />
      </div>
      <TextField label="Attendee count / list" value={value.attendees} onChange={(v) => set("attendees", v)} placeholder="e.g. 12 people or names…" />
      <div>
        <label className={labelCls}>Reason for booking</label>
        <textarea value={value.reason} onChange={(e) => set("reason", e.target.value)} rows={2}
          placeholder="e.g. Q3 review with leadership"
          className={inputCls} />
      </div>
      <div className="flex gap-3">
        {[
          { key: "needsAV", label: "AV setup", val: value.needsAV },
          { key: "needsRefreshments", label: "Refreshments", val: value.needsRefreshments },
        ].map(({ key, label, val }) => (
          <button key={key} type="button"
            onClick={() => set(key as keyof MeetingState, !val as never)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
              val
                ? "border-indigo-500 bg-indigo-600 text-white shadow-md shadow-indigo-500/30"
                : "border-white/15 bg-slate-900/40 text-slate-300 hover:bg-slate-800/60 hover:border-indigo-300/40"
            }`}>
            <span className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0 ${
              val ? "border-white bg-white" : "border-slate-500 bg-slate-800/70"
            }`}>
              {val && <span className="w-2 h-2 rounded-sm bg-indigo-600 block" />}
            </span>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- Fooding ---------- */
export interface FoodingState {
  occasion: string; date: string; time: string;
  vegCount: string; nonVegCount: string;
  menuPref: string; specialNotes: string;
  perHeadBudget: string;
}
export const emptyFooding = (): FoodingState => ({
  occasion: "Team lunch", date: "", time: "13:00",
  vegCount: "", nonVegCount: "0",
  menuPref: "Standard combo", specialNotes: "", perHeadBudget: "300",
});
const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export function foodingBookingInfo(f: FoodingState, now = new Date()) {
  const today = localDate(now);
  const isToday = f.date === today;
  const inServiceTime = f.time >= "10:00" && f.time <= "20:00";
  const bookingOpen = now.getHours() >= 10 && now.getHours() < 20;
  const fmt = (date: Date) => date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  if (!f.date) return { valid: false, message: "Select a date to see the estimated fulfilment time." };
  if (f.date < today) return { valid: false, message: "Past dates cannot be booked." };
  if (!inServiceTime) return { valid: false, message: "Food service time must be between 10:00 AM and 8:00 PM." };
  if (isToday && !bookingOpen) return { valid: false, message: now.getHours() < 10
    ? "Today's booking opens at 10:00 AM. Expected fulfilment after booking: 12:00–12:30 PM."
    : "Today's booking is closed after 8:00 PM. Please select a future date." };
  if (isToday) {
    const from = new Date(now.getTime() + 120 * 60_000); const to = new Date(now.getTime() + 150 * 60_000);
    return { valid: true, message: `Estimated fulfilment: ${fmt(from)}–${fmt(to)} (approximately 2–2.5 hours).` };
  }
  return { valid: true, message: "Advance booking selected · expected preparation time is approximately 2–2.5 hours." };
}
export const foodingValid = (f: FoodingState) => foodingBookingInfo(f).valid &&
  (Number(f.vegCount) + Number(f.nonVegCount)) > 0;

export function FoodingForm({ value, onChange }: { value: FoodingState; onChange: (v: FoodingState) => void }) {
  const set = <K extends keyof FoodingState>(k: K, v: FoodingState[K]) => onChange({ ...value, [k]: v });
  const total = Number(value.vegCount || 0) + Number(value.nonVegCount || 0);
  const estimate = total * Number(value.perHeadBudget || 0);
  const booking = foodingBookingInfo(value);
  const today = localDate(new Date());
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Occasion" value={value.occasion} onChange={(v) => set("occasion", v)}
          options={["Team lunch", "Client meeting", "Training / workshop", "Event / offsite", "Birthday / celebration", "Overtime dinner"]} />
        <SelectField label="Menu preference" value={value.menuPref} onChange={(v) => set("menuPref", v)}
          options={["Standard combo", "North Indian thali", "South Indian", "Continental", "Snacks + tea", "Custom (mention below)"]} />
        <TextField label="Date" type="date" min={today} value={value.date} onChange={(v) => set("date", v)} />
        <TextField label="Service time (10 AM–8 PM)" type="time" min="10:00" max="20:00" value={value.time} onChange={(v) => set("time", v)} />
        <TextField label="Veg count" value={value.vegCount} onChange={(v) => set("vegCount", v.replace(/[^0-9]/g, ""))} />
        <TextField label="Non-veg count" value={value.nonVegCount} onChange={(v) => set("nonVegCount", v.replace(/[^0-9]/g, ""))} />
        <TextField label="Per-head budget (₹)" value={value.perHeadBudget} onChange={(v) => set("perHeadBudget", v.replace(/[^0-9]/g, ""))} />
        <div className="flex items-end">
          <div className="w-full p-3 rounded-xl border border-indigo-500/20 bg-indigo-600/15 backdrop-blur-sm text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 mb-0.5">Estimate</p>
            <p className="text-base font-mono font-bold text-indigo-300 tabular-nums">
              <Utensils className="w-3.5 h-3.5 inline mr-1 text-indigo-400" />
              {total} pax · {fmtINR(estimate)}
            </p>
          </div>
        </div>
      </div>
      <div className={`flex gap-2 rounded-xl border px-3 py-2.5 text-xs ${booking.valid
        ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-200"
        : "border-amber-400/25 bg-amber-500/10 text-amber-200"}`}>
        <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <div><p className="font-semibold">Booking hours: 10:00 AM–8:00 PM</p><p className="mt-0.5 opacity-85">{booking.message}</p></div>
      </div>
      <div>
        <label className={labelCls}>Special notes (allergies, jain, halal…)</label>
        <textarea value={value.specialNotes} onChange={(e) => set("specialNotes", e.target.value)} rows={2} className={inputCls} />
      </div>
    </div>
  );
}

/* ---------- helpers to derive subject/description/amount ---------- */
export function summarizeVC(v: VCState) {
  return {
    subject: `${businessCardTemplate(v.brand).name} visiting card — ${v.name}, ${v.qty} qty`,
    description: `Print-ready visiting card request for ${v.name} (${v.designation}) using the locked ${businessCardTemplate(v.brand).name} template`,
  };
}
export function summarizeTravel(t: TravelState) {
  const modeLabel = t.mode === "train" ? "Train (IRCTC)" : t.mode === "flight" ? "Flight" : `Taxi (${t.taxiType})`;
  return {
    subject: `${modeLabel} — ${t.from} → ${t.to}, ${t.date}`,
    description: t.purpose.trim() || `Official business travel from ${t.from} to ${t.to}`,
  };
}
export function summarizeCourier(c: CourierState) {
  return {
    subject: `Courier (${c.mode}) — ${c.senderPin || "?"} → ${c.receiverPin || "?"}, ${c.weightKg}kg`,
    description: c.contents.trim() || `Package dispatch request from ${c.senderName} to ${c.receiverName}`,
  };
}
export function summarizeMeeting(m: MeetingState) {
  const extras = [m.needsAV && "AV setup", m.needsRefreshments && "Refreshments"].filter(Boolean).join(" + ");
  return {
    subject: `${m.room} — ${m.date} ${m.startTime}, ${m.durationHrs} hr`,
    description: `${m.reason.trim() || "Executive meeting"}${extras ? ` (${extras})` : ""}`,
  };
}
export function summarizeFooding(f: FoodingState) {
  const total = Number(f.vegCount || 0) + Number(f.nonVegCount || 0);
  const estimate = total * Number(f.perHeadBudget || 0);
  return {
    subject: `${f.occasion} — ${total} pax on ${f.date} ${f.time}`,
    description: f.specialNotes.trim() || `${f.occasion} catering order for ${total} team members (${f.menuPref})`,
    amount: estimate,
  };
}

/** Structured rows for the RequestDetail "Details" section. */
export function detailRows(type: string, details: Record<string, unknown> | undefined): { label: string; value: string }[] {
  if (!details) return [];
  const d = details as Record<string, string | number | boolean | undefined | unknown>;
  const s = (v: unknown) => (v === undefined || v === null || v === "") ? "—" : String(v);
  switch (type) {
    case "id_card":
      return [
        { label: "Issue type", value: s(ID_CARD_REASONS.find((reason) => reason.id === d.issueType)?.label ?? d.issueType) },
        { label: "Reason", value: s(d.reason) },
        { label: "Employee code", value: s(d.employeeCode) },
        { label: "Designation", value: s(d.designation) },
        { label: "Department", value: s(d.department) },
        { label: "Contact", value: s(d.phone) },
        { label: "Blood group", value: s(d.bloodGroup) },
        { label: "Emergency no.", value: s(d.emergencyPhone) },
        { label: "Company / center", value: `${s(d.profileCompany)} · ${s(d.profileCenter)}` },
      ];
    case "visiting_card":
      return [
        { label: "Company template", value: s(d.brand ? businessCardTemplate(d.brand as BusinessCardBrand).name : d.template) },
        { label: "Name", value: s(d.name) },
        { label: "Designation", value: s(d.designation) },
        { label: "Phone", value: s(d.phone) },
        { label: "Email", value: s(d.email) },
        { label: "Quantity", value: s(d.qty) },
      ];
    case "travel": {
      const t = d as unknown as TravelState;
      const rows = [
        { label: "Mode", value: t.mode === "train" ? "Train (IRCTC)" : t.mode === "flight" ? "Flight" : `Taxi (${t.taxiType})` },
        { label: "From → To", value: `${s(t.from)} → ${s(t.to)}` },
        { label: "Date", value: s(t.date) + (t.returnDate ? ` (rtn ${t.returnDate})` : "") },
      ];
      if (t.mode !== "taxi") {
        rows.push({ label: "Class / meal", value: `${s(t.klass)} · ${s(t.meal)}` });
        rows.push({ label: "Passengers", value: (t.pax ?? []).map(p => `${p.name} (${p.age}/${p.gender})`).join(", ") || "—" });
        rows.push({ label: "Contact", value: s(t.contactMob) });
      } else {
        rows.push({ label: "Pickup time", value: s(t.pickupTime) });
      }
      return rows;
    }
    case "courier": {
      const c = d as unknown as CourierState;
      return [
        { label: "Mode", value: s(c.mode) },
        { label: "Sender", value: `${s(c.senderName)} · ${s(c.senderPhone)} · PIN ${s(c.senderPin)}` },
        { label: "Receiver", value: `${s(c.receiverName)} · ${s(c.receiverPhone)} · PIN ${s(c.receiverPin)}` },
        { label: "Weight", value: `${s(c.weightKg)} kg` },
        { label: "Dimensions", value: c.lengthCm ? `${c.lengthCm}×${c.widthCm}×${c.heightCm} cm` : "—" },
        { label: "Contents", value: s(c.contents) },
      ];
    }
    case "meeting_room": {
      const m = d as unknown as MeetingState;
      return [
        { label: "Room", value: s(m.room) },
        { label: "When", value: `${s(m.date)} at ${s(m.startTime)} (${s(m.durationHrs)}h)` },
        { label: "Host", value: `${s(m.hostName)} · ${s(m.hostPhone)}` },
        { label: "Attendees", value: s(m.attendees) },
        { label: "Extras", value: [m.needsAV && "AV", m.needsRefreshments && "Refreshments"].filter(Boolean).join(", ") || "—" },
      ];
    }
    case "fooding": {
      const f = d as unknown as FoodingState;
      return [
        { label: "Occasion", value: s(f.occasion) },
        { label: "When", value: `${s(f.date)} at ${s(f.time)}` },
        { label: "Headcount", value: `Veg ${s(f.vegCount)} · Non-veg ${s(f.nonVegCount)}` },
        { label: "Menu", value: s(f.menuPref) },
        { label: "Per-head", value: `₹${s(f.perHeadBudget)}` },
        { label: "Notes", value: s(f.specialNotes) },
      ];
    }
    default:
      return [];
  }
}
