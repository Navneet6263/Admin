import { useCallback, useEffect, useState } from 'react';
import { KeyRound, Pencil, Save, ShieldCheck, UserPlus, Users, X } from 'lucide-react';
import { request, type StaffPermissions } from '@/lib/api';
import { typeLabels, type RequestType } from '@/components/models';
import { PanelLoadingSkeleton } from '@/components/LoadingSkeletons';
import { ExcelExportButton } from '@/components/ExcelExportButton';
import type { ExportColumn } from '@/lib/excelExport';

export type StaffMember = {
  id: number; name: string; email: string; dept: string; is_active: boolean; created_at: string;
  center_code: string; created_by_name: string; permissions: StaffPermissions;
};

const input = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-200';
const requestTypes = Object.keys(typeLabels) as RequestType[];
const staffColumns: ExportColumn<StaffMember>[] = [
  { key: 'name', label: 'Name', value: (row) => row.name },
  { key: 'email', label: 'Login email', value: (row) => row.email },
  { key: 'dept', label: 'Role / work', value: (row) => row.dept },
  { key: 'center', label: 'Center', value: (row) => row.center_code },
  { key: 'status', label: 'Status', value: (row) => (row.is_active ? 'Active' : 'Disabled') },
  { key: 'access', label: 'Access granted', value: (row) => permissionSummary(row.permissions).join(', ') || 'None', width: 50 },
  { key: 'by', label: 'Added by', value: (row) => row.created_by_name },
  { key: 'created', label: 'Added on', value: (row) => row.created_at, type: 'datetime' },
];
const emptyPermissions: StaffPermissions = { request_types: [], center_inventory: false, daily_use: false };

function permissionSummary(permissions: StaffPermissions) {
  const parts = permissions.request_types.map((type) => typeLabels[type as RequestType] || type);
  if (permissions.center_inventory) parts.push('Center inventory');
  if (permissions.daily_use) parts.push('Daily-use stock');
  return parts;
}

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (value: boolean) => void; label: string; hint?: string }) {
  return <label className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 ${checked ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
    <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-0.5 h-3.5 w-3.5 accent-indigo-600" />
    <span><span className="block text-xs font-semibold text-slate-800">{label}</span>{hint && <span className="block text-[10px] text-slate-500">{hint}</span>}</span>
  </label>;
}

function PermissionEditor({ value, onChange }: { value: StaffPermissions; onChange: (value: StaffPermissions) => void }) {
  const toggleType = (type: string, on: boolean) => onChange({ ...value,
    request_types: on ? [...value.request_types, type] : value.request_types.filter((item) => item !== type) });
  return <div className="space-y-3">
    <div>
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Requests they can approve &amp; hand over</p>
      <div className="grid gap-2 sm:grid-cols-2">{requestTypes.map((type) =>
        <Toggle key={type} label={typeLabels[type]} checked={value.request_types.includes(type)} onChange={(on) => toggleType(type, on)} />)}</div>
    </div>
    <div>
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Inventory</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Toggle label="Center inventory" hint="View stationery stock of this center" checked={value.center_inventory}
          onChange={(on) => onChange({ ...value, center_inventory: on })} />
        <Toggle label="Daily-use stock" hint="Add items, record purchases, hand over to people" checked={value.daily_use}
          onChange={(on) => onChange({ ...value, daily_use: on })} />
      </div>
    </div>
  </div>;
}

function Modal({ title, subtitle, onClose, busy, children }: { title: string; subtitle: string; onClose: () => void; busy: boolean; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm" onClick={() => !busy && onClose()}>
    <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
      <div className="mb-4 flex items-start justify-between gap-3"><div><p className="text-base font-bold text-slate-900">{title}</p>
        <p className="mt-1 text-xs text-slate-500">{subtitle}</p></div>
        <button type="button" disabled={busy} onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button></div>
      {children}
    </div>
  </div>;
}

function StaffDialog({ staff, centerCode, onClose, onSaved }: { staff?: StaffMember; centerCode?: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: staff?.name || '', email: staff?.email || '', dept: staff?.dept || '', password: '' });
  const [permissions, setPermissions] = useState<StaffPermissions>(staff?.permissions || emptyPermissions);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const valid = form.name.trim() && (staff || (form.email.trim() && form.password.length >= 7));
  const save = async () => {
    if (!valid || busy) return; setBusy(true); setError('');
    try {
      if (staff) await request(`/api/center-team/${staff.id}`, { method: 'PATCH', body: { name: form.name.trim(), permissions } });
      else await request('/api/center-team', { method: 'POST', body: { ...form, name: form.name.trim(), email: form.email.trim(),
        dept: form.dept.trim(), permissions, center_code: centerCode || undefined } });
      onSaved(); onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Staff could not be saved'); setBusy(false); }
  };
  return <Modal busy={busy} onClose={onClose} title={staff ? `Edit access · ${staff.name}` : 'Add team member'}
    subtitle={staff ? 'Changes apply immediately on their next action.' : 'Creates a login for your center. They only see what you allow below.'}>
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Full name</span>
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className={input} placeholder="e.g. Navneet Kumar" /></label>
        <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Role / work</span>
          <input disabled={Boolean(staff)} value={form.dept} onChange={(event) => setForm({ ...form, dept: event.target.value })} className={`${input} disabled:bg-slate-100`} placeholder="e.g. Store keeper" /></label>
      </div>
      {!staff && <div className="grid gap-3 sm:grid-cols-2">
        <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Login email</span>
          <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className={input} placeholder="name@company.com" /></label>
        <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Password</span>
          <input type="password" minLength={7} maxLength={14} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} className={input} placeholder="7-14 characters" />
          <span className="mt-1 block text-[10px] text-slate-400">Include uppercase, lowercase, number and special character.</span></label>
      </div>}
      <PermissionEditor value={permissions} onChange={setPermissions} />
    </div>
    {error && <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
    <div className="mt-5 flex justify-end gap-2"><button type="button" disabled={busy} onClick={onClose} className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
      <button type="button" disabled={!valid || busy} onClick={() => void save()} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-black disabled:opacity-40">
        <Save className="h-3.5 w-3.5" /> {busy ? 'Saving…' : staff ? 'Save access' : 'Create login'}</button></div>
  </Modal>;
}

function PasswordDialog({ staff, onClose }: { staff: StaffMember; onClose: () => void }) {
  const [password, setPassword] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const save = async () => {
    setBusy(true); setError('');
    try { await request(`/api/center-team/${staff.id}/password`, { method: 'POST', body: { password } }); onClose(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Password could not be reset'); setBusy(false); }
  };
  return <Modal busy={busy} onClose={onClose} title={`Reset password · ${staff.name}`} subtitle="They will be signed out and must use the new password.">
    <input type="password" minLength={7} maxLength={14} value={password} onChange={(event) => setPassword(event.target.value)} className={input} placeholder="7-14 characters" autoFocus />
    {error && <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
    <div className="mt-5 flex justify-end gap-2"><button type="button" disabled={busy} onClick={onClose} className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
      <button type="button" disabled={password.length < 7 || busy} onClick={() => void save()} className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-black disabled:opacity-40">{busy ? 'Saving…' : 'Reset password'}</button></div>
  </Modal>;
}

/** Center Admin's own team with customisable, delegated access. */
export function CenterTeamPanel({ centerCode }: { centerCode?: string }) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [editing, setEditing] = useState<StaffMember | 'new' | null>(null);
  const [resetting, setResetting] = useState<StaffMember | null>(null);
  const scope = centerCode ? `?center_code=${encodeURIComponent(centerCode)}` : '';
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setStaff(await request<StaffMember[]>(`/api/center-team${scope}`)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Team could not be loaded'); }
    finally { setLoading(false); }
  }, [scope]);
  useEffect(() => { void load(); }, [load]);
  const setActive = async (member: StaffMember, active: boolean) => {
    if (!active && !window.confirm(`Disable ${member.name}'s login? They will be signed out immediately.`)) return;
    try { await request(`/api/center-team/${member.id}`, { method: 'PATCH', body: { is_active: active } }); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Status could not be changed'); }
  };

  return <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-200/40">
    <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-4">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Users className="h-4 w-4 text-indigo-600" /> My team</h2>
        <p className="mt-1 text-[11px] text-slate-500">Create logins for people who work with you and choose exactly what each one can do.</p>
      </div>
      <div className="ml-auto"><ExcelExportButton exportKey="center-team" title="Center team" columns={staffColumns} rows={staff} /></div>
      <button type="button" onClick={() => setEditing('new')} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-black">
        <UserPlus className="h-3.5 w-3.5" /> Add team member</button>
    </div>
    {error && <p className="mx-5 mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
    {loading ? <div className="p-5"><PanelLoadingSkeleton /></div> : staff.length === 0
      ? <div className="py-16 text-center text-sm text-slate-400">No team members yet. Add one to share your workload.</div>
      : <div className="divide-y divide-slate-100">{staff.map((member) => {
        const access = permissionSummary(member.permissions);
        return <div key={member.id} className={`flex flex-wrap items-center gap-4 px-5 py-4 ${member.is_active ? '' : 'opacity-60'}`}>
          <div className="min-w-[200px] flex-1">
            <p className="text-sm font-semibold text-slate-900">{member.name}
              {!member.is_active && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">Disabled</span>}</p>
            <p className="font-mono text-[11px] text-slate-500">{member.email}</p>
            <p className="text-[10px] text-slate-400">{member.dept} · added by {member.created_by_name}</p>
          </div>
          <div className="flex min-w-[240px] flex-[2] flex-wrap gap-1.5">
            {access.length ? access.map((label) => <span key={label} className="inline-flex items-center gap-1 rounded-full border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
              <ShieldCheck className="h-3 w-3" />{label}</span>)
              : <span className="text-[11px] text-slate-400">No access granted yet</span>}
          </div>
          <div className="flex gap-1.5">
            <button type="button" onClick={() => setEditing(member)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"><Pencil className="h-3 w-3" /> Access</button>
            <button type="button" onClick={() => setResetting(member)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"><KeyRound className="h-3 w-3" /> Password</button>
            <button type="button" onClick={() => void setActive(member, !member.is_active)} className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold ${member.is_active ? 'border-rose-200 text-rose-700 hover:bg-rose-50' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'}`}>
              {member.is_active ? 'Disable' : 'Enable'}</button>
          </div>
        </div>;
      })}</div>}
    {editing && <StaffDialog staff={editing === 'new' ? undefined : editing} centerCode={centerCode} onClose={() => setEditing(null)} onSaved={() => void load()} />}
    {resetting && <PasswordDialog staff={resetting} onClose={() => setResetting(null)} />}
  </section>;
}
