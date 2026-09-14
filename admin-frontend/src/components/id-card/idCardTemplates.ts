import avantikaFront from "@/assets/id-card/north_star_avantika-front.svg";
import avantikaBack from "@/assets/id-card/north_star_avantika-back.svg";
import bgclFront from "@/assets/id-card/north_star_bgcl-front.svg";
import bgclBack from "@/assets/id-card/north_star_bgcl-back.svg";
import ioagFront from "@/assets/id-card/north_star_ioag-front.svg";
import ioagBack from "@/assets/id-card/north_star_ioag-back.svg";
import ioclFront from "@/assets/id-card/north_star_iocl-front.svg";
import ioclBack from "@/assets/id-card/north_star_iocl-back.svg";
import greenFront from "@/assets/id-card/green_call-front.svg";
import greenBack from "@/assets/id-card/green_call-back.svg";
import talentFront from "@/assets/id-card/talent_foundation-front.svg";
import talentBack from "@/assets/id-card/talent_foundation-back.svg";

export const ID_CARD_NAMES = {
  vision_india: "Vision India",
  green_call: "GreenCall",
  talent_foundation: "Talent Foundation",
  north_star_avantika: "North Star · Avantika Gas",
  north_star_bgcl: "North Star · BGCL",
  north_star_ioag: "North Star · IOAG",
  north_star_iocl: "North Star · IOCL",
} as const;
export type IdCardTemplateBrand = keyof typeof ID_CARD_NAMES;
export const isIdCardBrand = (value: unknown): value is IdCardTemplateBrand =>
  typeof value === "string" && Object.prototype.hasOwnProperty.call(ID_CARD_NAMES, value);

// Only personal fields printed in the supplied format are editable/required.
// Other formats print a fixed company helpline, not the employee's contact.
export const idCardFields = (brand: IdCardTemplateBrand) => ({
  designation: brand !== "green_call",
  phone: brand === "vision_india",
  department: brand === "vision_india",
  bloodGroup: true,
  emergencyPhone: true,
});
export const ID_CARD_BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

type Artwork = { front: string; back: string; width: number; height: number };
const northStar = (front: string, back: string): Artwork => ({ front, back, width: 181.5, height: 261 });
export const ID_CARD_ARTWORK: Record<Exclude<IdCardTemplateBrand, "vision_india">, Artwork> = {
  north_star_avantika: northStar(avantikaFront, avantikaBack),
  north_star_bgcl: northStar(bgclFront, bgclBack),
  north_star_ioag: northStar(ioagFront, ioagBack),
  north_star_iocl: northStar(ioclFront, ioclBack),
  green_call: { front: greenFront, back: greenBack, width: 182.5, height: 262 },
  talent_foundation: { front: talentFront, back: talentBack, width: 182.5, height: 255 },
};

export function idCardSize(brand: IdCardTemplateBrand) {
  return brand === "vision_india" ? { width: 540, height: 860 } : ID_CARD_ARTWORK[brand];
}
