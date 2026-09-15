import { useEffect, useState } from 'react';
import { request } from '@/lib/api';
import { PaginationBar } from '@/components/PaginationBar';
import { vendorButton, vendorInput, type Vendor, type VendorPage } from './vendorTypes';

const empty = { name: '', email: '', contact_name: '', phone: '', service: 'both' as Vendor['service'], is_active: true };
export function VendorManager() {
  const [form, setForm] = useState<Partial<Vendor> & typeof empty>(empty);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [reload, setReload] = useState(0);
  const [data, setData] = useState<VendorPage<Vendor>>({ items: [], total: 0, page: 1 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    const timer = setTimeout(() => {
      request<VendorPage<Vendor>>(`/api/vendors?page=${page}&search=${encodeURIComponent(search)}`, { signal: controller.signal })
        .then(setData).catch(error => { if (!controller.signal.aborted) setError(error.message); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [page, search, reload]);
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await request(`/api/vendors${form.id ? `/${form.id}` : ''}`, { method: form.id ? 'PUT' : 'POST', body: form });
      setForm(empty); setReload(value => value + 1);
    } catch (error) { setError(error instanceof Error ? error.message : 'Vendor could not be saved'); }
    finally { setBusy(false); }
  };
  return <section className="space-y-4 rounded-xl border bg-white p-4 text-slate-900">
    <div><h3 className="text-lg font-semibold">Vendors</h3><p className="text-sm text-slate-500">Manage printing partners. Vendors receive emails and do not get a portal login.</p></div>
    <form onSubmit={save} className="grid gap-3 md:grid-cols-3">
      <label className="text-sm">Vendor / business name *<input required maxLength={120} className={vendorInput} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
      <label className="text-sm">Email *<input type="email" required maxLength={254} className={vendorInput} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
      <label className="text-sm">Contact person<input maxLength={120} className={vendorInput} value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })} /></label>
      <label className="text-sm">Phone<input maxLength={30} className={vendorInput} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></label>
      <label className="text-sm">Service<select className={vendorInput} value={form.service} onChange={e => setForm({ ...form, service: e.target.value as Vendor['service'] })}>
        <option value="both">ID Card and Visiting Card</option><option value="id_card">ID Card</option><option value="visiting_card">Visiting Card</option>
      </select></label>
      <label className="text-sm">Status<select className={vendorInput} value={String(form.is_active)} onChange={e => setForm({ ...form, is_active: e.target.value === 'true' })}>
        <option value="true">Active</option><option value="false">Inactive</option>
      </select></label>
      <div className="flex gap-3 md:col-span-3"><button disabled={busy} className={vendorButton}>{busy ? 'Saving…' : form.id ? 'Save vendor' : 'Create vendor'}</button>
        {form.id && <button type="button" onClick={() => setForm(empty)}>Cancel edit</button>}</div>
    </form>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <input aria-label="Search vendors" className={vendorInput} placeholder="Search vendors" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
    {loading ? <p role="status" className="animate-pulse p-4">Loading vendors…</p> : <div className="overflow-x-auto">
      <table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-2">Vendor</th><th>Email</th><th>Service</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>{data.items.map(item => <tr key={item.id} className="border-b"><td className="p-2">{item.name}</td><td>{item.email}</td><td>{item.service.replaceAll('_', ' ')}</td><td>{item.is_active ? 'Active' : 'Inactive'}</td>
          <td><button className="p-2 text-indigo-700" onClick={() => setForm(item)}>Edit</button></td></tr>)}</tbody></table>
      {!data.items.length && <p className="p-4 text-sm text-slate-500">No vendors found.</p>}
    </div>}
    <PaginationBar page={page} pageSize={25} total={data.total} onPageChange={setPage} />
  </section>;
}
