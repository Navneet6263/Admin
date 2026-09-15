import { IdCardPreview } from "../id-card/VisionIndiaIdCardPreview";
import { BusinessCardPreview } from "../business-card/BusinessCardPreview";
import type { IdCardDetails } from "../id-card/visionIndiaIdCard";
import type { BusinessCardDetails } from "../business-card/businessCardTemplates";

type Props = { kind: "id_card" | "visiting_card"; idDetails: IdCardDetails; visitingDetails: BusinessCardDetails };

export function SelectedCardPreview({ kind, idDetails, visitingDetails }: Props) {
  return <div className={`selected-card-preview selected-card-preview--${kind}`} aria-label="Selected card live preview">
    {kind === "id_card" ? <IdCardPreview details={idDetails} /> : <BusinessCardPreview details={visitingDetails} />}
    <p className="selected-card-preview-note">Updates as you fill in your details. Change the company using the form dropdown.</p>
  </div>;
}
