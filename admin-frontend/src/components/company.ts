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
  { code: "VI", name: "Vision India", legal: "Vision India Pvt. Ltd.", teams: ["Engineering", "HR", "Finance", "Operations", "Product"], tone: "border-indigo-200 bg-indigo-50 text-indigo-700" },
  { code: "JJ", name: "Just Job",     legal: "Just Job Services Pvt. Ltd.", teams: ["Sales", "Recruitment", "Marketing", "Operations"], tone: "border-sky-200 bg-sky-50 text-sky-700" },
  { code: "LS", name: "Live Skills",  legal: "Live Skills Education Pvt. Ltd.", teams: ["Training", "Product", "Design", "Academic Ops"], tone: "border-emerald-200 bg-emerald-50 text-emerald-700" },
];

export const companyByCode = (codeOrName: string) =>
  companies.find((c) => c.code === codeOrName || c.name.toLowerCase() === (codeOrName || '').toLowerCase()) ?? companies[0];

export const companyTone = (code: string) => companyByCode(code).tone;
