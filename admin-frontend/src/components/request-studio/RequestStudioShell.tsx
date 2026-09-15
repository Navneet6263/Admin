import { type ReactNode, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { CenterCombobox } from "../CenterCombobox";
import { typeLabels, type RequestType } from "../models";
import { typeIcon } from "../requestMeta";
import { CompanyCardGallery } from "./CompanyCardGallery";
import { SelectedCardPreview } from "./SelectedCardPreview";
import type { IdCardDetails } from "../id-card/visionIndiaIdCard";
import type { BusinessCardDetails } from "../business-card/businessCardTemplates";
import type { IdCardTemplateBrand } from "../id-card/idCardTemplates";
import type { BusinessCardBrand } from "../business-card/businessCardTemplates";
import type { RequesterProfile } from "../id-card/idCardFormState";
import "./requestStudio.css";
import "./cardRequestForm.css";
import "./selectedCardPreview.css";
import "./requestStudioDensity.css";

type Props = {
  type: RequestType; onTypeChange: (type: RequestType) => void;
  title: string; subtitle: string; background: string;
  idBrand: IdCardTemplateBrand; visitingBrand: BusinessCardBrand;
  onIdSelect: (brand: IdCardTemplateBrand) => void; onVisitingSelect: (brand: BusinessCardBrand) => void;
  profile?: RequesterProfile;
  centers: Array<{ code: string; name: string; city: string }>;
  requestCenter: string; onCenterChange: (center: string) => void;
  submitting: boolean; onClose: () => void;
  designSelected: boolean; idDetails: IdCardDetails; visitingDetails: BusinessCardDetails;
  children: ReactNode; footer: ReactNode;
};

export function RequestStudioShell(props: Props) {
  const body = useRef<HTMLDivElement>(null);
  const story = useRef<HTMLElement>(null);
  const isCard = props.type === "id_card" || props.type === "visiting_card";
  useEffect(() => { body.current?.scrollTo({ top: 0 }); }, [props.type]);
  useEffect(() => { story.current?.scrollTo({ top: 0 }); }, [props.type, props.designSelected, props.idBrand, props.visitingBrand]);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, []);
  return <>
    <div className="request-studio-overlay" onClick={() => { if (!props.submitting) props.onClose(); }} />
    <section className={`request-studio ${isCard ? "request-studio--cards" : ""}`} aria-label="New request workspace">
      <aside ref={story} className="request-studio-story">
        {!isCard && <img src={props.background} alt="" className="request-studio-photo" />}
        <div className="request-studio-heading">
          <span className="request-studio-eyebrow">{isCard ? "YOUR COMPANY · YOUR IDENTITY" : "EMPLOYEE REQUESTS"}</span>
          <h1>{props.title}</h1>
          <p>{isCard ? props.designSelected ? "Your selected design. Your details, live." : "Choose your company design to get started." : props.subtitle}</p>
        </div>
        {isCard && (props.designSelected ? <SelectedCardPreview kind={props.type as "id_card" | "visiting_card"}
          idDetails={props.idDetails} visitingDetails={props.visitingDetails} /> : <CompanyCardGallery kind={props.type as "id_card" | "visiting_card"}
          selected={props.type === "id_card" ? props.idBrand : props.visitingBrand} profile={props.profile} disabled={props.submitting}
          onIdSelect={props.onIdSelect} onVisitingSelect={props.onVisitingSelect} />)}
        {!props.designSelected && <p className="request-studio-story-note">{isCard ? "Select a design to use it in your request →" : "Choose your details. Track every update in your portal."}</p>}
      </aside>
      <div className="request-studio-panel">
        <header className="request-studio-header">
          <div><h2>New Request</h2><p>Choose a service and fill in your details</p></div>
          <CenterCombobox centers={props.centers} value={props.requestCenter} onChange={props.onCenterChange}
            dark disabled={props.submitting} className="request-studio-center" />
          <button type="button" onClick={props.onClose} disabled={props.submitting} aria-label="Close new request" className="request-studio-close"><X size={20} /></button>
        </header>
        <nav className="request-studio-tabs" aria-label="Request categories">
          {(Object.keys(typeLabels) as RequestType[]).map((type) => {
            const Icon = typeIcon[type];
            return <button type="button" key={type} aria-pressed={props.type === type} disabled={props.submitting}
              onClick={() => props.onTypeChange(type)}><Icon size={15} /><span>{typeLabels[type]}</span></button>;
          })}
        </nav>
        <div ref={body} className="request-studio-body request-scrollbar space-y-5" aria-busy={props.submitting}>
          {props.children}
          {isCard && props.designSelected && <div className="selected-card-mobile"><SelectedCardPreview
            kind={props.type as "id_card" | "visiting_card"} idDetails={props.idDetails} visitingDetails={props.visitingDetails} /></div>}
        </div>
        <footer className="request-studio-footer">{props.footer}</footer>
      </div>
    </section>
  </>;
}
