// Multi-company hierarchy — Vision India Group
// Vision India (parent) → sub-companies → teams

export interface SubCompany {
  code: string;         // "VT"
  name: string;         // "Vision Tech"
  legal: string;        // "Vision Tech Pvt. Ltd."
  teams: string[];
  tone: string;         // tailwind border/text accent
}

export const GROUP = {
  code: "VI",
  name: "Vision India Group",
  legal: "Vision India Pvt. Ltd.",
};

export const companies: SubCompany[] = [
  { code: "VT", name: "Vision Tech",      legal: "Vision Tech Pvt. Ltd.",      teams: ["Engineering", "Product", "Design", "HR"],           tone: "border-sky-200 bg-sky-50 text-sky-700" },
  { code: "VR", name: "Vision Retail",    legal: "Vision Retail Pvt. Ltd.",    teams: ["Sales", "Merchandising", "Store Ops", "Marketing"], tone: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  { code: "VM", name: "Vision Media",     legal: "Vision Media Pvt. Ltd.",     teams: ["Design", "Marketing", "Content", "Production"],     tone: "border-amber-200 bg-amber-50 text-amber-700" },
  { code: "VL", name: "Vision Logistics", legal: "Vision Logistics Pvt. Ltd.", teams: ["Operations", "Fleet", "Warehouse", "HR"],           tone: "border-indigo-200 bg-indigo-50 text-indigo-700" },
];

export const companyByCode = (code: string) =>
  companies.find((c) => c.code === code) ?? companies[0];

export const companyTone = (code: string) => companyByCode(code).tone;
