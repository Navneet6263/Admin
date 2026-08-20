export type IdCardTemplateBrand = "vision_india";
export type IdCardSide = "front" | "back";

export interface IdCardDetails {
  brand: IdCardTemplateBrand;
  name: string;
  employeeCode: string;
  designation: string;
  department: string;
  phone: string;
  bloodGroup: string;
  emergencyPhone: string;
  photoDataUrl?: string;
}

const xml = (value: string | undefined) => (value || "—")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&apos;");
const wrap = (value: string | undefined, limit = 20) => {
  const words = (value || "—").trim().split(/\s+/); const lines = [""];
  words.forEach((word) => { const index = lines.length - 1; const next = `${lines[index]} ${word}`.trim();
    if (next.length <= limit || !lines[index]) lines[index] = next; else if (lines.length < 2) lines.push(word); else lines[index] += ` ${word}`; });
  return lines.slice(0, 2).map(xml);
};
const tspans = (value: string | undefined, x: number, y: number, limit = 20) => wrap(value, limit)
  .map((line, index) => `<tspan x="${x}" y="${y + index * 31}">${line}</tspan>`).join("");

const logo = `<g>
  <path d="M0 0h55l42 38L139 0h55l-97 88z" fill="#ed1628"/><path d="M12 13h50l12 11H27zM31 32h52l12 11H46z" fill="#fff"/>
  <text x="205" y="52" fill="#ed1628" font-family="Arial,sans-serif" font-size="34" font-weight="600" letter-spacing="3">VISION INDIA</text>
  <text x="206" y="79" fill="#171717" font-family="Arial,sans-serif" font-size="14" font-weight="600">Staffing  |  Skilling  |  Advisory Services</text>
</g>`;

const base = (content: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="540" height="860" viewBox="0 0 540 860" style="display:block;width:100%;height:auto">
  <defs><linearGradient id="red" x1="0" x2="1"><stop stop-color="#f20b24"/><stop offset="1" stop-color="#a90009"/></linearGradient>
  <clipPath id="photo"><rect x="170" y="225" width="200" height="235" rx="4"/></clipPath></defs>
  <rect width="540" height="860" rx="20" fill="#fff"/>${content}</svg>`;

export function visionIndiaIdCardSvg(side: IdCardSide, details: IdCardDetails) {
  if (side === "front") return base(`
    <path d="M165 0h375v92H250c-50 0-85-42-85-92z" fill="url(#red)"/><g transform="translate(40 112)">${logo}</g>
    <rect x="170" y="225" width="200" height="235" rx="4" fill="#8f8f8f"/>
    ${details.photoDataUrl ? `<image href="${xml(details.photoDataUrl)}" x="170" y="225" width="200" height="235" preserveAspectRatio="xMidYMid slice" clip-path="url(#photo)"/>` : `<text x="270" y="350" text-anchor="middle" fill="#fff" font-family="Arial" font-size="20">PHOTO</text>`}
    <g font-family="Arial,sans-serif" fill="#111" font-size="25"><text x="65" y="535" font-weight="700">Name :</text><text>${tspans(details.name, 245, 535)}</text>
    <text x="65" y="615" font-weight="700">Employee Code :</text><text x="285" y="615">${xml(details.employeeCode)}</text>
    <text x="65" y="675" font-weight="700">Designation :</text><text>${tspans(details.designation, 245, 675)}</text>
    <text x="65" y="755" font-weight="700">Department :</text><text>${tspans(details.department, 245, 755)}</text></g>`);
  return base(`
    <g transform="translate(52 120) scale(.9)">${logo}</g>
    <g font-family="Arial,sans-serif" fill="#151515"><text x="80" y="310" font-size="27">Vision India Services Pvt Ltd</text>
    <text x="80" y="352" font-size="22">A-11, Sector - 67, Noida - 201301</text>
    <text x="80" y="410" font-size="22">Contact no.</text><text x="285" y="410" font-size="22">: ${xml(details.phone)}</text>
    <text x="80" y="455" font-size="22" font-weight="700">Blood group</text><text x="285" y="455" font-size="22">: ${xml(details.bloodGroup)}</text>
    <text x="80" y="500" font-size="22" font-weight="700">Emergency No.</text><text x="285" y="500" font-size="22">: ${xml(details.emergencyPhone)}</text></g>
    <path d="M350 655c40-35 72-28 25 3 56-27 67-8 10 8-54 14-80 36-18 4" fill="none" stroke="#343a40" stroke-width="4" stroke-linecap="round"/>
    <text x="350" y="720" font-family="Arial,sans-serif" font-size="22">Authorised Sign</text><path d="M350 730h150" stroke="#222"/>
    <path d="M0 782h310c55 0 82 31 112 78H0z" fill="url(#red)"/>`);
}
