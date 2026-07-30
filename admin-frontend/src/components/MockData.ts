// ⭐ MOCK DATA — Delete this file when connecting to real backend APIs.

export type RequestType =
  | "id_card"
  | "visiting_card"
  | "stationery"
  | "travel"
  | "courier"
  | "meeting_room"
  | "fooding";

export type RequestStatus =
  | "pending"
  | "queued"
  | "awaiting_verification"
  | "approved"
  | "rejected"
  | "info_requested";
export type Priority = "low" | "normal" | "high" | "urgent";

export interface AuditEntry {
  at: string;
  actor: string;
  action:
    | "created"
    | "approved"
    | "rejected"
    | "queued"
    | "info_requested"
    | "commented"
    | "verified"
    | "sent_back";
  note?: string;
}

export interface StationeryPick {
  sku: string;
  name: string;
  qty: number;
  price: number;
}

export interface RequestItem {
  id: string; // REQ-2026-####
  dbId?: number;
  employeeId: number;
  employeeName: string;
  employeeDept: string;
  /** Sub-company code within Vision India Group (VT / VR / VM / VL). */
  company: string;
  /** Team within the sub-company (same as employeeDept). */
  team: string;
  type: RequestType;
  subject: string;
  amount: number | null;
  description: string;
  priority: Priority;
  status: RequestStatus;
  createdAt: string;
  updatedAt: string;
  audit: AuditEntry[];
  items?: StationeryPick[];
  /** Structured payload for specialized forms (visiting card, travel, courier, meeting, fooding). */
  details?: Record<string, unknown>;
}

export const typeLabels: Record<RequestType, string> = {
  id_card: "ID Card",
  visiting_card: "Visiting Card",
  stationery: "Stationery",
  travel: "Travel Booking",
  courier: "Courier / Dispatch",
  meeting_room: "Meeting Room",
  fooding: "Food / Catering",
};

export const typeCategory: Record<RequestType, "identity" | "supplies" | "logistics" | "facility"> = {
  id_card: "identity",
  visiting_card: "identity",
  stationery: "supplies",
  travel: "logistics",
  courier: "logistics",
  meeting_room: "facility",
  fooding: "facility",
};

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

// Maps employeeId → sub-company code within Vision India Group.
const employeeCompany: Record<number, string> = {
  1: "VT", // Rahul Kumar     · Engineering
  2: "VR", // Priya Sharma    · Sales
  3: "VM", // Amit Verma      · Marketing
  4: "VL", // Neha Gupta      · Operations
  5: "VM", // Karthik Rao     · Design
  6: "VT", // Meera Iyer      · HR
  8: "VT", // Ananya Reddy    · Product
};

const mk = (
  id: string,
  employeeId: number,
  employeeName: string,
  employeeDept: string,
  type: RequestType,
  subject: string,
  amount: number | null,
  description: string,
  priority: Priority,
  status: RequestStatus,
  ageHrs: number,
  extraAudit: AuditEntry[] = []
): RequestItem => {
  const createdAt = hoursAgo(ageHrs);
  const audit: AuditEntry[] = [
    { at: createdAt, actor: employeeName, action: "created", note: description },
    ...extraAudit,
  ];
  return {
    id, employeeId, employeeName, employeeDept,
    company: employeeCompany[employeeId] ?? "VT",
    team: employeeDept,
    type, subject, amount, description,
    priority, status, createdAt,
    updatedAt: audit[audit.length - 1].at,
    audit,
  };
};

/** Runtime data is loaded from SQL Server APIs; this empty export only preserves shared UI types. */
export const mockRequests: RequestItem[] = [];
/*
  mk("REQ-2026-0142", 1, "Rahul Kumar", "Engineering", "id_card", "Replacement ID card — lost", null, "Lost original card near cafeteria on 14 Jul. Need urgent replacement for access.", "urgent", "pending", 4),
  mk("REQ-2026-0141", 2, "Priya Sharma", "Sales", "visiting_card", "Reprint — 500 qty, new designation", null, "Recently promoted to Senior Account Executive. Need reprints with updated title.", "normal", "pending", 9),
  mk("REQ-2026-0138", 5, "Karthik Rao", "Design", "stationery", "Whiteboard markers, sticky notes bulk", 3400, "Design sprint next week, current stock over.", "low", "pending", 34),
  mk("REQ-2026-0137", 6, "Meera Iyer", "HR", "travel", "Flight — DEL → BLR, 24 Jul, return 26 Jul", 22500, "Campus recruitment drive at IIM-B. Hotel already booked.", "normal", "pending", 40),
  mk("REQ-2026-0136", 1, "Rahul Kumar", "Engineering", "courier", "Blue Dart — legal contracts to Mumbai HQ", 850, "Physical signed originals to Mumbai legal team.", "normal", "pending", 52),
  mk("REQ-2026-0134", 8, "Ananya Reddy", "Product", "meeting_room", "Board Room A — Q3 review, 4 hrs", null, "Quarterly review with leadership. Needs AV + refreshments.", "normal", "pending", 12),


  mk("REQ-2026-0135", 3, "Amit Verma", "Marketing", "travel", "Taxi — Airport pickup, 21 Jul", 1800, "Client visit — pickup from BLR airport, drop to hotel.", "normal", "awaiting_verification", 60, [
    { at: hoursAgo(48), actor: "John Admin (ADM-001)", action: "approved", note: "Approved by John Admin (ADM-001). Sent to Verifier for claim check." },
  ]),
  mk("REQ-2026-0133", 6, "Meera Iyer", "HR", "fooding", "Team lunch — 12 pax", 4800, "Q2 wrap-up lunch. Veg + non-veg mix.", "normal", "awaiting_verification", 78, [
    { at: hoursAgo(64), actor: "John Admin (ADM-001)", action: "approved", note: "Approved by John Admin (ADM-001). Bills to be verified." },
  ]),

  mk("REQ-2026-0128", 3, "Amit Verma", "Marketing", "stationery", "Printer cartridges — HP LaserJet", 4200, "", "normal", "approved", 168, [
    { at: hoursAgo(160), actor: "John Admin", action: "approved", note: "Under petty cash. Procured via Amazon Business." },
  ]),
  mk("REQ-2026-0126", 1, "Rahul Kumar", "Engineering", "visiting_card", "Reprint — 250 qty", null, "", "low", "approved", 220, [
    { at: hoursAgo(210), actor: "John Admin", action: "approved" },
  ]),
  mk("REQ-2026-0124", 6, "Meera Iyer", "HR", "courier", "DTDC — offer letters batch", 1200, "", "normal", "approved", 260, [
    { at: hoursAgo(255), actor: "John Admin", action: "approved" },
  ]),

];*/

export const priorityRank: Record<Priority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
