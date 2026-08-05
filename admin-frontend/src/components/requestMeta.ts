import {
  CreditCard, IdCard, Package,
  Plane, Send, CalendarClock, UtensilsCrossed, type LucideIcon,
} from "lucide-react";
import type { RequestType, Priority, RequestStatus } from "./models";

export const typeIcon: Record<RequestType, LucideIcon> = {
  id_card: IdCard,
  visiting_card: CreditCard,
  stationery: Package,
  travel: Plane,
  courier: Send,
  meeting_room: CalendarClock,
  fooding: UtensilsCrossed,
};

export const priorityTone: Record<Priority, { dot: string; text: string; bg: string; label: string }> = {
  urgent: { dot: "bg-rose-500", text: "text-rose-700", bg: "bg-rose-50 border-rose-100", label: "Urgent" },
  high:   { dot: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50 border-amber-100", label: "High" },
  normal: { dot: "bg-sky-500", text: "text-sky-700", bg: "bg-sky-50 border-sky-100", label: "Normal" },
  low:    { dot: "bg-slate-400", text: "text-slate-600", bg: "bg-slate-50 border-slate-100", label: "Low" },
};

export const statusTone: Record<RequestStatus, { text: string; bg: string; label: string }> = {
  pending:               { text: "text-amber-700",   bg: "bg-amber-50 border-amber-100",     label: "Pending" },
  queued:                { text: "text-indigo-700",  bg: "bg-indigo-50 border-indigo-100",   label: "Queued · Super Admin" },
  awaiting_verification: { text: "text-violet-700",  bg: "bg-violet-50 border-violet-100",   label: "Awaiting Verification" },
  approved:              { text: "text-emerald-700", bg: "bg-emerald-50 border-emerald-100", label: "Verified · Closed" },
  rejected:              { text: "text-rose-700",    bg: "bg-rose-50 border-rose-100",       label: "Rejected" },
  info_requested:        { text: "text-slate-700",   bg: "bg-slate-100 border-slate-200",    label: "Info Requested" },
};

function parseLocalDate(iso: string): Date {
  if (!iso) return new Date();
  if (typeof iso === "string" && iso.endsWith("Z")) {
    // SQL Server GETDATE() timestamps get serialized with a trailing 'Z' by mssql driver.
    // Stripping 'Z' prevents double-applying IST timezone offset (+5:30).
    const localStr = iso.slice(0, -1);
    const d = new Date(localStr);
    if (!isNaN(d.getTime())) return d;
  }
  const d = new Date(iso);
  return isNaN(d.getTime()) ? new Date() : d;
}

export function relTime(iso: string) {
  const date = parseLocalDate(iso);
  const diff = Date.now() - date.getTime();
  if (diff < 0) return "Just now";
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return `${Math.max(1, Math.floor(diff / 60_000))}m ago`;
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function fmtDateTime(iso: string) {
  const date = parseLocalDate(iso);
  return date.toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

export function fmtINR(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}
