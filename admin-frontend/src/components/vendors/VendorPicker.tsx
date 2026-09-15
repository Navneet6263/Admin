import { useEffect, useState } from 'react';
import { request } from '@/lib/api';
import { vendorInput, type Vendor, type VendorPage } from './vendorTypes';

export function VendorPicker({ value, onChange, disabled }: {
  value: Vendor | null; onChange: (value: Vendor | null) => void; disabled: boolean;
}) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<VendorPage<Vendor>>({ items: [], total: 0, page: 1 });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    const timer = setTimeout(() => {
      request<VendorPage<Vendor>>(`/api/vendors?active=1&page=${page}&search=${encodeURIComponent(search)}`, { signal: controller.signal })
        .then(setData).catch(error => { if (!controller.signal.aborted) setError(error.message); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [search, page]);
  return <div className="space-y-2">
    <label className="block text-sm font-medium">Find vendor
      <input className={vendorInput} value={search} placeholder="Search vendor name or email" disabled={disabled}
        onChange={e => { setSearch(e.target.value); setPage(1); onChange(null); }} /></label>
    <label className="block text-sm font-medium">Select vendor
      <select aria-label="Select vendor" className={vendorInput} value={value?.id || ''} disabled={disabled || loading}
        onChange={e => onChange(data.items.find(item => item.id === Number(e.target.value)) || null)}>
        <option value="">{loading ? 'Loading vendors…' : 'Choose a vendor'}</option>
        {data.items.map(item => <option key={item.id} value={item.id}>{item.name} — {item.email} ({item.service.replaceAll('_', ' ')})</option>)}
      </select></label>
    {!loading && !error && !data.total && <p className="text-sm text-slate-500">No active vendors found. Ask HQ Admin to create one in Team / Users → Vendors.</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {data.total > 25 && <div className="flex gap-3 text-xs">
      <button disabled={disabled || page === 1} onClick={() => { setPage(page - 1); onChange(null); }}>Previous vendors</button>
      <span>{page} / {Math.ceil(data.total / 25)}</span>
      <button disabled={disabled || page * 25 >= data.total} onClick={() => { setPage(page + 1); onChange(null); }}>More vendors</button>
    </div>}
  </div>;
}
