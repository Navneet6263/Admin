import { memo } from "react";
import { ID_CARD_NAMES, type IdCardTemplateBrand } from "../id-card/idCardTemplates";
import { idCardSvg } from "../id-card/idCardSvg";
import { emptyIdCard, idCardDetails, type RequesterProfile } from "../id-card/idCardFormState";
import { BUSINESS_CARD_TEMPLATES, type BusinessCardBrand } from "../business-card/businessCardTemplates";
import { BusinessCardFace } from "../business-card/BusinessCardPreview";

type Props = {
  kind: "id_card" | "visiting_card";
  selected: string;
  profile?: RequesterProfile;
  disabled?: boolean;
  onIdSelect: (brand: IdCardTemplateBrand) => void;
  onVisitingSelect: (brand: BusinessCardBrand) => void;
};

// Actual production templates, composed in the browser. No fictional brand,
// flattened screenshot or decorative sample data is sent with a request.
export const CompanyCardGallery = memo(function CompanyCardGallery({ kind, selected, profile, disabled, onIdSelect, onVisitingSelect }: Props) {
  if (kind === "id_card") return <div className="request-card-gallery request-card-gallery--id" aria-label="Available ID-card designs">
    {(Object.entries(ID_CARD_NAMES) as [IdCardTemplateBrand, string][]).map(([brand, name]) => {
      const details = idCardDetails({ ...emptyIdCard(), brand }, profile);
      return <button key={brand} type="button" disabled={disabled} className="request-card-choice" aria-pressed={selected === brand}
        aria-label={`Choose ${name} ID card`} onClick={() => onIdSelect(brand)}>
        <div className="request-card-art" aria-hidden="true" dangerouslySetInnerHTML={{ __html: idCardSvg("front", details) }} />
        <span className="request-card-caption">{name}</span>
      </button>;
    })}
  </div>;

  return <div className="request-card-gallery request-card-gallery--visiting" aria-label="Available visiting-card designs">
    {Object.values(BUSINESS_CARD_TEMPLATES).map((template) => {
      const details = { brand: template.id, name: profile?.name || "Your name", designation: profile?.dept || "Designation",
        phone: "Your number", email: profile?.email || "Work email", address: "", qty: 100 };
      return <button key={template.id} type="button" disabled={disabled} className="request-card-choice request-card-pair" aria-pressed={selected === template.id}
        aria-label={`Choose ${template.name} visiting card`} onClick={() => onVisitingSelect(template.id)}>
        <span className="request-card-pair-title">{template.name}<span>Front &amp; back</span></span>
        <div className="request-card-pair-faces" aria-hidden="true">
          {template.sides.map((side) => <BusinessCardFace key={side.id} side={side} details={details}
            image={side.image || template.image} sourceWidth={template.sourceWidth} sourceHeight={template.sourceHeight} />)}
        </div>
      </button>;
    })}
  </div>;
});
