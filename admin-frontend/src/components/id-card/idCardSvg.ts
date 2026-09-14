import { ID_CARD_ARTWORK, isIdCardBrand } from "./idCardTemplates";
import { visionIndiaIdCardSvg, type IdCardDetails, type IdCardSide } from "./visionIndiaIdCard";

const xml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
export const safeIdPhoto = (value?: string) =>
  value && /^data:image\/(jpeg|png|webp);base64,[a-z0-9+/=\s]+$/i.test(value) ? value : "";

// One bounded line per field. Font width is measured in browsers and capped in
// SVG too, so long employee names/codes cannot overlap labels or the card edge.
function text(value: string, x: number, y: number, max: number, size = 7, bold = false,
  anchor = "start", color = "#222") {
  const content = value?.trim() || "—";
  let width = content.length * size * .6;
  if (typeof document !== "undefined") {
    const context = document.createElement("canvas").getContext("2d");
    if (context) {
      context.font = `${bold ? 700 : 400} ${size}px Arial`;
      width = context.measureText(content).width;
    }
  }
  const fit = width > max ? ` textLength="${max}" lengthAdjust="spacingAndGlyphs"` : "";
  return `<text x="${x}" y="${y}" font-family="Arial,sans-serif" font-size="${size}" font-weight="${bold ? 700 : 400}" text-anchor="${anchor}" fill="${color}"${fit}>${xml(content)}</text>`;
}

function photo(source: string, x: number, y: number, width: number, height: number, color: string) {
  return `<defs><clipPath id="employee-photo"><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="5"/></clipPath></defs>
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="5" fill="#f1f5f9"/>
    ${source ? `<image href="${xml(source)}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet" clip-path="url(#employee-photo)"/>`
      : text("PHOTO", x + width / 2, y + height / 2, width - 10, 7, false, "middle", "#64748b")}
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="5" fill="none" stroke="${color}" stroke-width=".6"/>`;
}

function front(details: IdCardDetails) {
  const { brand, name, employeeCode, designation } = details;
  const source = safeIdPhoto(details.photoDataUrl);
  if (brand === "talent_foundation") return photo(source, 57.5, 81, 67, 70, "#f47b20")
    + text(name, 91.25, 179, 141, 8, true, "middle")
    + text(designation, 91.25, 195, 140, 8, false, "middle")
    + text(`Employee Code : ${employeeCode}`, 91.25, 211, 119, 7.5, false, "middle", "#f47b20");
  const green = brand === "green_call";
  const row = (label: string, value: string, y: number) => text(label, 17, y, 48, 7, true)
    + text(":", green ? 70 : 65, y, 3, 7, true)
    + text(value, green ? 75 : 69, y, green ? 94 : 103, 7, true);
  return photo(source, 59.5, green ? 63 : 60, 63, 71.5, green ? "#ff002b" : "#ff8000")
    + row("Name", name, green ? 162 : 148)
    + row("Employee ID", employeeCode, 188)
    + (green ? "" : row("Designation", designation, 200));
}

function back(details: IdCardDetails) {
  const { brand, bloodGroup, emergencyPhone } = details;
  if (brand === "talent_foundation") return text("Blood Group", 27.5, 165.5, 53, 6.7, true)
    + text(`: ${bloodGroup}`, 85, 165.5, 67, 7)
    + text("Emergency No", 27.5, 180, 54, 6.7, true)
    + text(`: +91 ${emergencyPhone}`, 85, 180, 72, 7);
  const green = brand === "green_call";
  const x = green || brand === "north_star_iocl" ? 33 : 24.6;
  return text(`Blood Group: ${bloodGroup}`, x, green ? 145.5 : 140, 141, 7)
    + text(`Emergency No.: ${emergencyPhone}`, x, green ? 158 : 152.5, 141, 7);
}

export function idCardSvg(side: IdCardSide, details: IdCardDetails, embeddedArtwork?: string) {
  if (!isIdCardBrand(details.brand)) throw new Error("Unsupported ID-card template");
  if (details.brand === "vision_india") return visionIndiaIdCardSvg(side,
    { ...details, photoDataUrl: safeIdPhoto(details.photoDataUrl) });
  const art = ID_CARD_ARTWORK[details.brand];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${art.width}" height="${art.height}" viewBox="0 0 ${art.width} ${art.height}" style="display:block;width:100%;height:auto">
    <image href="${xml(embeddedArtwork || art[side])}" width="${art.width}" height="${art.height}"/>
    ${side === "front" ? front(details) : back(details)}</svg>`;
}
