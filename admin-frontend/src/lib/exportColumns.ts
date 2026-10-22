import type { ExportColumn } from './excelExport';
import { request, toRequest, type Paged } from './api';
import { typeLabels, type RequestItem } from '@/components/models';
import { statusTone } from '@/components/requestMeta';
import { detailRows, hotelNights, type TravelState } from '@/components/RequestForms';

/** Request timestamps come from GETDATE() (India wall-clock) but are serialised with a trailing Z. */
const wallClock = (iso: string | null | undefined) => (iso ? iso.replace(/Z$/, '') : null);
const travel = (row: RequestItem) => (row.type === 'travel' ? row.details as unknown as TravelState : null);
const hotel = (row: RequestItem) => { const t = travel(row); return t?.needHotel ? t.hotel ?? null : null; };
const humanise = (value: string | null | undefined) => value ? value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : '';

export const requestExportColumns: ExportColumn<RequestItem>[] = [
  { key: 'ref', label: 'Request ID', value: (row) => row.id },
  { key: 'created', label: 'Raised on', value: (row) => wallClock(row.createdAt), type: 'datetime' },
  { key: 'type', label: 'Category', value: (row) => typeLabels[row.type] ?? row.type },
  { key: 'subject', label: 'Subject', value: (row) => row.subject, width: 42 },
  { key: 'employee', label: 'Employee', value: (row) => row.employeeName },
  { key: 'dept', label: 'Department', value: (row) => row.employeeDept },
  { key: 'company', label: 'Company', value: (row) => row.company },
  { key: 'home', label: 'Home center', value: (row) => row.homeCenter },
  { key: 'approval', label: 'Approval center', value: (row) => row.approvalCenter, defaultOn: false },
  { key: 'charge', label: 'Charged to center', value: (row) => row.chargeCenter, defaultOn: false },
  { key: 'priority', label: 'Priority', value: (row) => humanise(row.priority) },
  { key: 'status', label: 'Status', value: (row) => statusTone[row.status]?.label ?? row.status },
  { key: 'workflow', label: 'Workflow stage', value: (row) => humanise(row.workflowStatus), defaultOn: false },
  { key: 'amount', label: 'Estimated amount', value: (row) => row.amount, type: 'currency' },
  { key: 'actual', label: 'Actual amount', value: (row) => row.actualAmount, type: 'currency' },
  { key: 'payment', label: 'Payment status', value: (row) => humanise(row.paymentStatus) },
  { key: 'fulfillment', label: 'Hand-over status', value: (row) => humanise(row.fulfillmentStatus), defaultOn: false },
  { key: 'receipt', label: 'Receipt status', value: (row) => humanise(row.receiptStatus), defaultOn: false },
  { key: 'updated', label: 'Last updated', value: (row) => wallClock(row.updatedAt), type: 'datetime', defaultOn: false },
  { key: 'travelMode', label: 'Travel mode', value: (row) => humanise(travel(row)?.mode ?? ''), defaultOn: false },
  { key: 'travelRoute', label: 'Travel route', value: (row) => { const t = travel(row); return t ? `${t.from} → ${t.to}` : ''; }, defaultOn: false },
  { key: 'travelDate', label: 'Travel date', value: (row) => travel(row)?.date || null, type: 'date', defaultOn: false },
  { key: 'hotelNeeded', label: 'Hotel booked', value: (row) => (row.type === 'travel' ? (hotel(row) ? 'Yes' : 'No') : ''), defaultOn: false },
  { key: 'hotelCity', label: 'Hotel city', value: (row) => hotel(row)?.city ?? '', defaultOn: false },
  { key: 'checkIn', label: 'Check-in', value: (row) => hotel(row)?.checkIn || null, type: 'date', defaultOn: false },
  { key: 'checkOut', label: 'Check-out', value: (row) => hotel(row)?.checkOut || null, type: 'date', defaultOn: false },
  { key: 'nights', label: 'Hotel nights', value: (row) => (hotel(row) ? hotelNights(hotel(row)!) : null), type: 'number', defaultOn: false },
  { key: 'rooms', label: 'Hotel rooms', value: (row) => (hotel(row) ? Number(hotel(row)!.rooms) : null), type: 'number', defaultOn: false },
  { key: 'details', label: 'All request details', value: (row) => detailRows(row.type, row.details).map((item) => `${item.label}: ${item.value}`).join(' | '), width: 60, defaultOn: false },
  { key: 'description', label: 'Description', value: (row) => row.description, width: 50, defaultOn: false },
];

/** Loads every page of a workflow queue view (100 per call, capped) for full exports. */
export async function fetchAllWorkflowRequests(query: string, cap = 5000) {
  const all: RequestItem[] = [];
  for (let page = 1; all.length < cap; page += 1) {
    const result = await request<Paged<Record<string, unknown>>>(`/api/workflow/queue?${query}${query ? '&' : ''}page=${page}&page_size=100`);
    all.push(...result.data.map(toRequest));
    if (all.length >= result.total || !result.data.length) break;
  }
  return all;
}

export type ActivityExportRow = { action: string; note?: string | null; created_at: string; ref_id: string; subject: string;
  actor_name: string; actor_role?: string; type?: string };
export const activityExportColumns: ExportColumn<ActivityExportRow>[] = [
  { key: 'at', label: 'When', value: (row) => wallClock(row.created_at), type: 'datetime' },
  { key: 'ref', label: 'Request ID', value: (row) => row.ref_id },
  { key: 'subject', label: 'Subject', value: (row) => row.subject, width: 40 },
  { key: 'action', label: 'Action', value: (row) => humanise(row.action) },
  { key: 'actor', label: 'Done by', value: (row) => row.actor_name },
  { key: 'role', label: 'Role', value: (row) => humanise(row.actor_role) },
  { key: 'note', label: 'Remarks', value: (row) => row.note, width: 40 },
];

export type StockExportRow = { sku: string; name: string; category: string; unit: string; price: number; qty: number;
  threshold: number; reserved_qty?: number; available_qty?: number };
export const stockExportColumns: ExportColumn<StockExportRow>[] = [
  { key: 'sku', label: 'SKU', value: (row) => row.sku },
  { key: 'name', label: 'Item', value: (row) => row.name },
  { key: 'category', label: 'Category', value: (row) => row.category },
  { key: 'unit', label: 'Unit', value: (row) => row.unit },
  { key: 'qty', label: 'On hand', value: (row) => row.qty, type: 'number' },
  { key: 'reserved', label: 'Reserved', value: (row) => row.reserved_qty, type: 'number', defaultOn: false },
  { key: 'available', label: 'Available', value: (row) => row.available_qty ?? row.qty, type: 'number' },
  { key: 'threshold', label: 'Reorder level', value: (row) => row.threshold, type: 'number' },
  { key: 'status', label: 'Status', value: (row) => ((row.available_qty ?? row.qty) <= row.threshold ? 'Low stock' : 'Healthy') },
  { key: 'price', label: 'Unit price', value: (row) => row.price, type: 'currency' },
  { key: 'value', label: 'Stock value', value: (row) => Number(row.qty) * Number(row.price), type: 'currency' },
];

export type UserExportRow = { id: number; name: string; email: string; role: string; dept: string; company: string;
  center_code?: string | null; center_name?: string | null; center_city?: string | null; is_active?: boolean };
export const userExportColumns: ExportColumn<UserExportRow>[] = [
  { key: 'id', label: 'User ID', value: (row) => row.id, type: 'number' },
  { key: 'name', label: 'Name', value: (row) => row.name },
  { key: 'email', label: 'Email', value: (row) => row.email },
  { key: 'role', label: 'Role', value: (row) => humanise(row.role) },
  { key: 'company', label: 'Company', value: (row) => row.company },
  { key: 'dept', label: 'Department', value: (row) => row.dept },
  { key: 'center', label: 'Center code', value: (row) => row.center_code },
  { key: 'centerName', label: 'Center name', value: (row) => row.center_name },
  { key: 'city', label: 'City', value: (row) => row.center_city, defaultOn: false },
  { key: 'active', label: 'Active', value: (row) => (row.is_active === undefined ? null : row.is_active), defaultOn: false },
];
