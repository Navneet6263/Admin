import type { IdCardDetails, IdCardTemplateBrand } from "./visionIndiaIdCard";
import { ID_CARD_NAMES, ID_CARD_BLOOD_GROUPS, idCardFields, isIdCardBrand } from "./idCardTemplates";
import { isValidIndianMobile } from "./IndianMobileField";

export interface IdCardState {
  brand: IdCardTemplateBrand;
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
export const emptyIdCard = (): IdCardState => ({ brand: "vision_india", issueType: "new", reason: "", designation: "", phone: "",
  bloodGroup: "", emergencyPhone: "", photoDataUrl: "", confirmed: false });
export const idCardDetails = (value: IdCardState, profile?: RequesterProfile): IdCardDetails => ({
  brand: value.brand, name: profile?.name || "Authenticated employee",
  employeeCode: profile?.employee_code || (profile?.id ? `EMP-${String(profile.id).padStart(4, "0")}` : "EMP-PENDING"),
  designation: idCardFields(value.brand).designation ? value.designation.trim() || profile?.dept || "—" : "",
  department: idCardFields(value.brand).department ? profile?.dept || "—" : "",
  phone: idCardFields(value.brand).phone ? value.phone : "",
  bloodGroup: value.bloodGroup, emergencyPhone: value.emergencyPhone, photoDataUrl: value.photoDataUrl,
});
export const idCardReady = (value: IdCardState, profile?: RequesterProfile) => {
  if (!isIdCardBrand(value.brand)) return false;
  const fields = idCardFields(value.brand);
  return Boolean(value.photoDataUrl && (!fields.phone || isValidIndianMobile(value.phone)) &&
    isValidIndianMobile(value.emergencyPhone) && ID_CARD_BLOOD_GROUPS.some((group) => group === value.bloodGroup) &&
    (!fields.designation || value.designation.trim() || profile?.dept));
};
export const idCardValid = (value: IdCardState, profile?: RequesterProfile) =>
  value.reason.trim().length >= 5 && idCardReady(value, profile) && value.confirmed;

export const ID_CARD_REASONS: Array<{ id: IdCardState["issueType"]; label: string; hint: string }> = [
  { id: "new", label: "New / first card", hint: "New joining or first ID card" },
  { id: "lost", label: "Lost card", hint: "Card was lost and needs replacement" },
  { id: "damaged", label: "Damaged card", hint: "Card is broken or unreadable" },
  { id: "details_changed", label: "Details changed", hint: "Name, role or office details changed" },
  { id: "expired", label: "Expired card", hint: "Renew an expired ID card" },
];

export function summarizeIdCard(value: IdCardState) {
  const label = ID_CARD_REASONS.find((reason) => reason.id === value.issueType)?.label || "ID card";
  return { subject: `${ID_CARD_NAMES[value.brand]} ID Card — ${label}`, description: value.reason.trim() };
}
