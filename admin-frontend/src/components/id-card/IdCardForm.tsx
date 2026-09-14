import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { IdCardPreview } from "./VisionIndiaIdCardPreview";
import { PhotoCropper } from "./PhotoCropper";
import { IdCardDownloadButton } from "./IdCardDownloadButton";
import { ID_CARD_NAMES, ID_CARD_BLOOD_GROUPS, idCardFields, type IdCardTemplateBrand } from "./idCardTemplates";
import { IndianMobileField } from "./IndianMobileField";
import { TextField, SelectField, inputCls, labelCls } from "./idCardFields";
import { idCardDetails, idCardReady, ID_CARD_REASONS, type IdCardState, type RequesterProfile } from "./idCardFormState";

const readIdPhoto = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error("Photo could not be read"));
  reader.onload = () => resolve(String(reader.result));
  reader.readAsDataURL(file);
});

export function IdCardForm({ value, onChange, profile }: { value: IdCardState; onChange: (value: IdCardState) => void; profile?: RequesterProfile }) {
  const [cropSource, setCropSource] = useState("");
  const details = idCardDetails(value, profile);
  const fields = idCardFields(value.brand);
  const set = <K extends keyof IdCardState>(key: K, next: IdCardState[K]) =>
    onChange({ ...value, confirmed: false, [key]: next });
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3.5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-300">Employee profile · automatic</p>
        <p className="mt-1 text-sm font-semibold text-white">{profile?.name || "Authenticated employee"}</p>
        <p className="mt-1 text-xs text-slate-300">{profile?.company || "Company from profile"} · {profile?.dept || "Department"}</p>
        <p className="mt-0.5 text-[10px] text-slate-400">{profile?.email || "Work email"} · Center {profile?.center_code || "Unassigned"}</p>
      </div>

      <label className="block rounded-xl border border-white/15 bg-white/5 p-3">
        <span className={labelCls}>ID-card format</span>
        <select value={value.brand} onChange={(event) => set("brand", event.target.value as IdCardTemplateBrand)} className={inputCls}>
          {Object.entries(ID_CARD_NAMES).map(([brand, name]) => <option key={brand} value={brand}>{name}</option>)}
        </select>
        <span className="mt-2 block text-xs text-slate-400">Choose your company or client format. Your employee profile remains unchanged.</span>
      </label>

      <div className="grid grid-cols-2 gap-3">
        {fields.designation && <TextField label="Designation *" value={value.designation} onChange={(next) => set("designation", next)} placeholder={profile?.dept || "Designation"} />}
        {fields.phone && <IndianMobileField label="Contact number" value={value.phone} onChange={(next) => set("phone", next)} />}
        {fields.bloodGroup && <SelectField label="Blood group *" value={value.bloodGroup} onChange={(next) => set("bloodGroup", next)} options={["", ...ID_CARD_BLOOD_GROUPS]} />}
        {fields.emergencyPhone && <IndianMobileField label="Emergency number" value={value.emergencyPhone} onChange={(next) => set("emergencyPhone", next)} />}
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
                if (!file) return;
                if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
                  toast.error("Choose a JPG, PNG or WebP photo smaller than 5 MB."); return;
                }
                void readIdPhoto(file).then(setCropSource).catch(() => toast.error("Photo could not be read. Please try again.")); }} />
          </label>
        </div>
      </div>
      {cropSource && <PhotoCropper source={cropSource} onCancel={() => setCropSource("")}
        onApply={(photo) => { set("photoDataUrl", photo); setCropSource(""); }} />}

      <div className="rounded-xl border border-white/10 bg-slate-950/35 p-3">
        <IdCardPreview details={details} />
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
          <IdCardDownloadButton details={details} disabled={!idCardReady(value, profile)} />
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
