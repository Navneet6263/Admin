import visionIndiaImage from "@/assets/business-cards/vision-india.jpg";
import talentFoundationImage from "@/assets/business-cards/talent-foundation.jpg";
import greenCallFrontImage from "@/assets/business-cards/greencall-front.jpg";
import greenCallBackImage from "@/assets/business-cards/greencall-back.jpg";
import greenHrFrontImage from "@/assets/business-cards/greenhr-front.jpg";
import greenHrBackImage from "@/assets/business-cards/greenhr-back.jpg";

export type BusinessCardBrand = "vision_india" | "talent_foundation" | "green_call" | "green_hr";
export type BusinessCardField = "name" | "designation" | "phone" | "email";

export interface BusinessCardDetails {
  brand: BusinessCardBrand;
  name: string;
  designation: string;
  phone: string;
  email: string;
  address: string;
  qty: number;
  confirmed?: boolean;
}

export interface CardText {
  field: BusinessCardField;
  x: number;
  y: number;
  size: number;
  color: string;
  weight: number;
  anchor: "start" | "middle" | "end";
  prefix?: string;
  maxWidth?: number;
}

export interface CardSide {
  id: "front" | "back";
  label: string;
  image?: string;
  crop: { x: number; y: number; width: number; height: number };
  masks: Array<{ x: number; y: number; width: number; height: number; color: string }>;
  texts: CardText[];
}

export interface BusinessCardTemplate {
  id: BusinessCardBrand;
  name: string;
  image: string;
  sourceWidth: number;
  sourceHeight: number;
  sides: CardSide[];
}

export const BUSINESS_CARD_TEMPLATES: Record<BusinessCardBrand, BusinessCardTemplate> = {
  vision_india: {
    id: "vision_india",
    name: "Vision India",
    image: visionIndiaImage,
    sourceWidth: 1600,
    sourceHeight: 485,
    sides: [
      {
        id: "front", label: "Front",
        crop: { x: 0, y: 0, width: 777, height: 485 },
        masks: [{ x: 65, y: 185, width: 650, height: 110, color: "#fdfeff" }],
        texts: [
          { field: "name", x: 389, y: 237, size: 34, color: "#303030", weight: 700, anchor: "middle" },
          { field: "designation", x: 389, y: 278, size: 27, color: "#303030", weight: 600, anchor: "middle" },
        ],
      },
      {
        id: "back", label: "Back",
        crop: { x: 823, y: 0, width: 777, height: 485 },
        masks: [{ x: 347, y: 27, width: 420, height: 105, color: "#d1242a" }],
        texts: [
          { field: "phone", prefix: "☎ ", x: 743, y: 68, size: 27, color: "#ffffff", weight: 700, anchor: "end" },
          { field: "email", prefix: "✉ ", x: 743, y: 111, size: 24, color: "#ffffff", weight: 700, anchor: "end" },
        ],
      },
    ],
  },
  talent_foundation: {
    id: "talent_foundation",
    name: "Talent Foundation",
    image: talentFoundationImage,
    sourceWidth: 1600,
    sourceHeight: 474,
    sides: [
      {
        id: "front", label: "Front",
        crop: { x: 841, y: 0, width: 759, height: 474 },
        masks: [{ x: 175, y: 180, width: 420, height: 105, color: "#fdfeff" }],
        texts: [
          { field: "name", x: 380, y: 232, size: 34, color: "#303030", weight: 700, anchor: "middle" },
          { field: "designation", x: 380, y: 273, size: 26, color: "#303030", weight: 500, anchor: "middle" },
        ],
      },
      {
        id: "back", label: "Back",
        crop: { x: 0, y: 0, width: 757, height: 474 },
        masks: [{ x: 420, y: 20, width: 325, height: 90, color: "#ee7725" }],
        texts: [
          { field: "phone", prefix: "☎ ", x: 720, y: 51, size: 21, color: "#ffffff", weight: 700, anchor: "end" },
          { field: "email", prefix: "✉ ", x: 720, y: 88, size: 19, color: "#ffffff", weight: 700, anchor: "end" },
        ],
      },
    ],
  },
  green_call: {
    id: "green_call",
    name: "GreenCall",
    image: greenCallFrontImage,
    sourceWidth: 1575,
    sourceHeight: 900,
    sides: [
      {
        id: "front", label: "Front",
        crop: { x: 0, y: 0, width: 1575, height: 900 },
        masks: [
          { x: 390, y: 340, width: 800, height: 190, color: "#ffffff" },
          { x: 145, y: 755, width: 390, height: 90, color: "#ffffff" },
          { x: 1080, y: 755, width: 455, height: 90, color: "#ffffff" },
        ],
        texts: [
          { field: "name", x: 790, y: 420, size: 68, maxWidth: 760, color: "#096b67", weight: 700, anchor: "middle" },
          { field: "designation", x: 790, y: 505, size: 43, maxWidth: 760, color: "#d33175", weight: 500, anchor: "middle" },
          { field: "phone", x: 160, y: 820, size: 39, maxWidth: 365, color: "#111111", weight: 500, anchor: "start" },
          { field: "email", x: 1100, y: 820, size: 34, maxWidth: 420, color: "#111111", weight: 500, anchor: "start" },
        ],
      },
      {
        id: "back", label: "Back", image: greenCallBackImage,
        crop: { x: 0, y: 0, width: 1575, height: 900 }, masks: [], texts: [],
      },
    ],
  },
  green_hr: {
    id: "green_hr",
    name: "Green HR",
    image: greenHrFrontImage,
    sourceWidth: 1575,
    sourceHeight: 900,
    sides: [
      {
        id: "front", label: "Front",
        crop: { x: 0, y: 0, width: 1575, height: 900 },
        masks: [
          { x: 760, y: 260, width: 660, height: 90, color: "#ffffff" },
          { x: 760, y: 365, width: 740, height: 85, color: "#ffffff" },
          { x: 855, y: 480, width: 610, height: 70, color: "#ffffff" },
          { x: 855, y: 550, width: 670, height: 80, color: "#ffffff" },
        ],
        texts: [
          { field: "name", x: 780, y: 325, size: 59, maxWidth: 620, color: "#096b67", weight: 700, anchor: "start" },
          { field: "designation", x: 780, y: 425, size: 40, maxWidth: 700, color: "#d33175", weight: 500, anchor: "start" },
          { field: "phone", x: 870, y: 535, size: 35, maxWidth: 570, color: "#111111", weight: 500, anchor: "start" },
          { field: "email", x: 870, y: 607, size: 31, maxWidth: 625, color: "#111111", weight: 500, anchor: "start" },
        ],
      },
      {
        id: "back", label: "Back", image: greenHrBackImage,
        crop: { x: 0, y: 0, width: 1575, height: 900 }, masks: [], texts: [],
      },
    ],
  },
};

export const businessCardTemplate = (brand: BusinessCardBrand | undefined) =>
  BUSINESS_CARD_TEMPLATES[brand || "vision_india"];
