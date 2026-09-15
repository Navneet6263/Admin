export type Vendor = { id: number; name: string; email: string; contact_name: string; phone: string;
  service: 'id_card' | 'visiting_card' | 'both'; is_active: boolean };
export type VendorCard = { id: number; ref_id: string; type: 'id_card' | 'visiting_card'; subject: string;
  company_name: string; quantity: number; details: Record<string, unknown>; revision: string;
  delivery_id: string | null; delivery_status: string | null; vendor_name?: string; vendor_email?: string;
  sent_at?: string; sent_by?: string };
export type VendorPage<T> = { items: T[]; total: number; page: number };
export const vendorInput = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900';
export const vendorButton = 'rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50';
