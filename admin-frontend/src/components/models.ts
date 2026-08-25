export type RequestType = 'id_card' | 'visiting_card' | 'stationery' | 'travel' | 'courier' | 'meeting_room' | 'fooding';
export type RequestStatus = 'pending' | 'queued' | 'awaiting_verification' | 'approved' | 'rejected' | 'info_requested' | 'withdrawn';
export type Priority = 'low' | 'normal' | 'high' | 'urgent';

export interface AuditEntry { at: string; actor: string; action: 'created' | 'raised' | 'withdrawn' | 'approved' | 'rejected' | 'queued' | 'info_requested' | 'commented' | 'verified' | 'sent_back' | 'payment_updated' | 'payment_verified' | 'assigned' | 'receipt_confirmed' | 'receipt_disputed'; note?: string; }
export interface StationeryPick { sku: string; name: string; qty: number; price: number; }
export interface RequestItem {
  id: string; dbId?: number; employeeId: number; employeeName: string; employeeDept: string;
  company: string; team: string; type: RequestType; subject: string; amount: number | null; actualAmount?: number | null;
  description: string; priority: Priority; status: RequestStatus; createdAt: string; updatedAt: string;
  audit: AuditEntry[]; items?: StationeryPick[]; details?: Record<string, unknown>;
  homeCenter?: string; requestCenter?: string; approvalCenter?: string; chargeCenter?: string;
  inventoryCenter?: string; workflowStatus?: string; paymentStatus?: string; canAct?: boolean;
  fulfillmentStatus?: 'not_required' | 'ready_to_assign' | 'assigned';
  fulfilledBy?: number | null; fulfilledAt?: string | null;
  receiptStatus?: 'not_required' | 'awaiting_confirmation' | 'received' | 'disputed';
  receiptFeedback?: 'very_easy' | 'easy' | 'needs_improvement' | null;
  receiptNote?: string | null; receiptConfirmedAt?: string | null;
}

export const typeLabels: Record<RequestType, string> = {
  id_card: 'ID Card', visiting_card: 'Visiting Card', stationery: 'Stationery', travel: 'Travel Booking',
  courier: 'Courier / Dispatch', meeting_room: 'Meeting Room', fooding: 'Food / Catering',
};
export const typeCategory: Record<RequestType, 'identity' | 'supplies' | 'logistics' | 'facility'> = {
  id_card: 'identity', visiting_card: 'identity', stationery: 'supplies', travel: 'logistics',
  courier: 'logistics', meeting_room: 'facility', fooding: 'facility',
};
export const priorityRank: Record<Priority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
