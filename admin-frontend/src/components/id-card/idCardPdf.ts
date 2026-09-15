import { makePdf } from "../business-card/businessCardPdf";
import type { IdCardDetails, IdCardSide } from "./visionIndiaIdCard";
import { ID_CARD_ARTWORK, idCardSize } from "./idCardTemplates";
import { idCardSvg } from "./idCardSvg";

// Nested SVG images must be embedded for reliable canvas/PDF rendering.
// Fetch only the chosen card artwork, not all twelve templates.
async function embeddedBackground(side: IdCardSide, details: IdCardDetails) {
  if (details.brand === "vision_india") return undefined;
  const response = await fetch(ID_CARD_ARTWORK[details.brand][side]);
  if (!response.ok) throw new Error("ID-card artwork could not be loaded. Please try again.");
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("ID-card artwork could not be read"));
    reader.readAsDataURL(blob);
  });
}

async function load(side: IdCardSide, details: IdCardDetails, urls: string[]) {
  const artwork = await embeddedBackground(side, details);
  const source = URL.createObjectURL(new Blob([idCardSvg(side, details, artwork)], { type: "image/svg+xml" }));
  urls.push(source);
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("ID-card template could not be loaded"));
    image.src = source;
  });
}

export async function createIdCardPrint(details: IdCardDetails) {
  const urls: string[] = [];
  try {
    const results = await Promise.allSettled((["front", "back"] as const).map((side) => load(side, details, urls)));
    const sides = results.map((result) => {
      if (result.status === "rejected") throw result.reason;
      return result.value;
    });
    const size = idCardSize(details.brand);
    // 2160px across a 3.5-inch preview sheet exceeds 600dpi. Vector logos and
    // text remain sharp when rasterized for the existing portable PDF writer.
    const width = 2160, gap = 120;
    const height = Math.round(width * size.height / size.width);
    const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height * 2 + gap;
    const context = canvas.getContext("2d"); if (!context) throw new Error("ID-card PDF canvas is unavailable");
    context.fillStyle = "#fff"; context.fillRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingQuality = "high";
    sides.forEach((image, index) => context.drawImage(image, 0, index * (height + gap), width, height));
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value)
      : reject(new Error("ID-card PDF could not be generated")), "image/jpeg", .97));
    const sheet = { bytes: new Uint8Array(await blob.arrayBuffer()), width: canvas.width, height: canvas.height };
    return { pdf: new Blob([makePdf([sheet])], { type: "application/pdf" }), images: [blob] };
  } finally {
    urls.forEach((url) => URL.revokeObjectURL(url));
  }
}

export async function createIdCardPdf(details: IdCardDetails) {
  return (await createIdCardPrint(details)).pdf;
}

export async function downloadIdCardPdf(details: IdCardDetails) {
  const url = URL.createObjectURL(await createIdCardPdf(details));
  const link = document.createElement("a"); link.href = url;
  link.download = `${details.brand}-id-${details.employeeCode || details.name}`.replace(/[^a-z0-9-]+/gi, "-").toLowerCase() + ".pdf";
  link.click(); setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
