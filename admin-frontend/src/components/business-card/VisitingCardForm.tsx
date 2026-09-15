import { useState } from "react";
import { toast } from "sonner";
import { BusinessCardPreview } from "./BusinessCardPreview";
import { downloadBusinessCardPdf } from "./businessCardPdf";
import { BUSINESS_CARD_TEMPLATES, type BusinessCardDetails, type BusinessCardBrand } from "./businessCardTemplates";

export type VCState = BusinessCardDetails;
export const emptyVC = (): VCState => ({ brand: "vision_india", name: "", designation: "", phone: "", email: "", address: "", qty: 100, confirmed: false });
export const vcDetailsReady = (v: VCState) => v.name.trim().length > 1 && v.designation.trim().length > 1 && v.phone.trim().length >= 7 && v.email.includes("@");
export const vcValid = (v: VCState) => vcDetailsReady(v) && Boolean(v.confirmed);

export function VisitingCardForm({ value, onChange, inlinePreview = true }: { value: VCState; onChange: (v: VCState) => void; inlinePreview?: boolean }) {
  const [downloading, setDownloading] = useState(false);
  const set = <K extends keyof VCState>(key: K, next: VCState[K]) => onChange({ ...value, confirmed: false, [key]: next });
  const download = async () => {
    setDownloading(true);
    try { await downloadBusinessCardPdf(value); }
    catch { toast.error("Card preview could not be downloaded. Please try again."); }
    finally { setDownloading(false); }
  };
  return <div className="card-request-form">
      <div className="card-form-heading"><h3>Your visiting card</h3><p>Choose a company and enter the details to print.</p></div>
      <div className="card-form-grid">
        <label>Company card<select aria-label="Company card" value={value.brand} onChange={(e) => set("brand", e.target.value as BusinessCardBrand)}>
          {Object.values(BUSINESS_CARD_TEMPLATES).map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
        </select></label>
        <label>Quantity<select aria-label="Quantity" value={value.qty} onChange={(e) => set("qty", Number(e.target.value))}>
          {[100, 250, 500, 1000].map((qty) => <option key={qty} value={qty}>{qty} cards</option>)}
        </select></label>
        <label>Full name<input value={value.name} onChange={(e) => set("name", e.target.value)} placeholder="Name to print on card" /></label>
        <label>Designation<input value={value.designation} onChange={(e) => set("designation", e.target.value)} placeholder="Your job title" /></label>
        <label>Phone<input type="tel" value={value.phone} onChange={(e) => set("phone", e.target.value)} placeholder="Your contact number" /></label>
        <label>Work email<input type="email" value={value.email} onChange={(e) => set("email", e.target.value)} placeholder="you@company.com" /></label>
      </div>
      <p className="card-form-note">Company address and logo are already included in your selected design.</p>
    <div className="card-review card-review--visiting">
      {inlinePreview && <BusinessCardPreview details={value} />}
      <div className="card-review-actions">
        {inlinePreview && <button type="button" disabled={downloading} onClick={() => void download()}>{downloading ? "Preparing PDF…" : "Download PDF preview"}</button>}
        <label><input type="checkbox" checked={Boolean(value.confirmed)} onChange={(e) => set("confirmed", e.target.checked)} /> I verified all card details</label>
      </div>
    </div>
  </div>;
}
