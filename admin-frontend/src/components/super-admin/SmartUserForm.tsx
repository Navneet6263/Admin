import { useState, useEffect } from "react";
import { UserPlus } from "lucide-react";
import { request } from "@/lib/api";
import { CenterCombobox } from "@/components/CenterCombobox";

interface SmartUserFormProps {
  companiesList: Array<{ id: number; code: string; name: string; legal_name: string }>;
  teams: Array<{ id: number; name: string; company: string }>;
  onCreated: () => void;
}

const ROLE_CARDS = [
  {
    role: 'employee',
    label: 'Employee',
    sub: 'Raises requests — travel, stationery, ID cards etc.',
    icon: '👤',
    color: 'sky',
    border: 'border-sky-300 bg-sky-50',
    active: 'border-sky-500 bg-sky-100 ring-2 ring-sky-300',
  },
  {
    role: 'center_admin',
    label: 'Center Admin',
    sub: 'Approves requests for their assigned center only.',
    icon: '🏢',
    color: 'indigo',
    border: 'border-indigo-200 bg-indigo-50',
    active: 'border-indigo-500 bg-indigo-100 ring-2 ring-indigo-300',
  },
  {
    role: 'hq_admin',
    label: 'HQ Admin',
    sub: 'Group / HQ request queue, inventory & escalations.',
    icon: '🏛️',
    color: 'slate',
    border: 'border-slate-300 bg-slate-50',
    active: 'border-slate-600 bg-slate-100 ring-2 ring-slate-400',
  },
  {
    role: 'verifier',
    label: 'Verifier',
    sub: 'Stage-2 bill & claim verification before finance release.',
    icon: '🔍',
    color: 'violet',
    border: 'border-violet-200 bg-violet-50',
    active: 'border-violet-500 bg-violet-100 ring-2 ring-violet-300',
  },
  {
    role: 'finance',
    label: 'Finance Executive',
    sub: 'Routine payment updates and verification within policy limits.',
    icon: '💰',
    color: 'emerald',
    border: 'border-emerald-200 bg-emerald-50',
    active: 'border-emerald-500 bg-emerald-100 ring-2 ring-emerald-300',
  },
  {
    role: 'finance_head',
    label: 'Head Finance',
    sub: 'High-value verification, exceptions and financial analytics.',
    icon: '₹', color: 'teal', border: 'border-teal-200 bg-teal-50',
    active: 'border-teal-500 bg-teal-100 ring-2 ring-teal-300',
  },
  {
    role: 'super_admin',
    label: 'Super Admin',
    sub: 'Full system access. Override authority. Group-level visibility.',
    icon: '👑',
    color: 'amber',
    border: 'border-amber-200 bg-amber-50',
    active: 'border-amber-500 bg-amber-100 ring-2 ring-amber-300',
  },
] as const;

type RoleKey = typeof ROLE_CARDS[number]['role'];

export function SmartUserForm({ companiesList, teams, onCreated }: SmartUserFormProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [role, setRole] = useState<RoleKey | ''>('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [dept, setDept] = useState('');
  const [centerCode, setCenterCode] = useState('');
  const [centers, setCenters] = useState<Array<{ id: number; code: string; name: string; city: string }>>([]);
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Load centers when center_admin or employee role selected
  useEffect(() => {
    if ((role === 'center_admin' || role === 'employee' || role === 'hq_admin') && centers.length === 0) {
      request<Array<{ id: number; code: string; name: string; city: string }>>('/api/centers')
        .then(setCenters).catch(console.error);
    }
  }, [role, centers.length]);

  const selectedCard = ROLE_CARDS.find(c => c.role === role);

  const needsCenter  = role === 'center_admin' || role === 'employee' || role === 'hq_admin';
  const needsDept    = role === 'employee' || role === 'finance' || role === 'finance_head' || role === 'verifier';
  const needsCompany = role !== 'super_admin';

  const handleStep1 = (r: RoleKey) => {
    setRole(r);
    setError('');
    setSuccess('');
    if (companiesList.length > 0) setCompany(companiesList[0].name);
    if (teams.length > 0) setDept(teams[0].name);
    setStep(2);
  };

  const handleStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) { setError('Name and email required'); return; }
    if (needsCenter && !centerCode) { setError('Is role ko center assign karna zaroori hai'); return; }
    setError(''); setStep(3);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || password.length < 6) { setError('Password minimum 6 characters'); return; }
    setSaving(true); setError('');
    try {
      const payload: Record<string, string> = { name, email, role, password };
      if (needsCompany) payload.company = company;
      if (needsDept)    payload.dept = dept;
      if (centerCode)   payload.center_code = centerCode;

      const res = await request<{ name: string; email: string }>('/api/super-admin/users', {
        method: 'POST', body: payload,
      });

      if (centerCode && res) {
        const newUsers = await request<Array<{ id: number; email: string }>>('/api/super-admin/users');
        const created = newUsers.find(u => u.email === email);
        if (created) {
          await request(`/api/super-admin/users/${created.id}/assign-center`, {
            method: 'POST', body: { center_code: centerCode },
          });
        }
      }

      setSuccess(`✅ ${res.name} (${res.email}) created & saved to SQL Server!`);
      setStep(1); setRole(''); setName(''); setEmail(''); setPassword('');
      setCompany(''); setDept(''); setCenterCode('');
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    } finally { setSaving(false); }
  };

  const STEP_LABELS = ['Choose Role', 'User Details', 'Set Password'];

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-6 pt-5 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2 mb-4">
          <UserPlus className="w-5 h-5 text-indigo-600" />
          <div>
            <h2 className="font-display font-semibold text-slate-900 text-base">Create User Account</h2>
            <p className="text-xs text-slate-500">Pehle role chunein — uske baad relevant fields automatically dikhenge</p>
          </div>
        </div>
        <div className="flex items-center gap-0">
          {STEP_LABELS.map((label, i) => {
            const s = i + 1;
            const done = step > s;
            const active = step === s;
            return (
              <div key={label} className="flex items-center flex-1">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${done ? 'bg-indigo-600 text-white' : active ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-400' : 'bg-slate-100 text-slate-400'}`}>
                    {done ? '✓' : s}
                  </div>
                  <span className={`text-xs font-medium hidden sm:block ${active ? 'text-indigo-700' : done ? 'text-slate-600' : 'text-slate-400'}`}>{label}</span>
                </div>
                {i < STEP_LABELS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-3 rounded transition-all ${done ? 'bg-indigo-600' : 'bg-slate-200'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="p-6">
        {success && (
          <div className="mb-4 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 p-3 rounded-lg font-medium">{success}</div>
        )}
        {error && (
          <div className="mb-4 text-xs text-rose-600 bg-rose-50 border border-rose-100 p-3 rounded-lg">{error}</div>
        )}

        {step === 1 && (
          <div>
            <p className="text-sm text-slate-600 mb-4 font-medium">Is user ka role kya hai?</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {ROLE_CARDS.map((card) => (
                <button
                  key={card.role}
                  type="button"
                  onClick={() => handleStep1(card.role)}
                  className={`text-left p-4 rounded-xl border-2 transition-all hover:scale-[1.02] active:scale-[0.98] ${role === card.role ? card.active : card.border} group`}
                >
                  <div className="text-2xl mb-2">{card.icon}</div>
                  <div className="font-semibold text-slate-800 text-sm">{card.label}</div>
                  <div className="text-xs text-slate-500 mt-1 leading-relaxed">{card.sub}</div>
                  <div className="mt-3 text-xs font-semibold text-indigo-600 group-hover:translate-x-1 transition-transform">
                    Select → 
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && selectedCard && (
          <form onSubmit={handleStep2}>
            <div className="flex items-center gap-3 mb-5 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-2xl">{selectedCard.icon}</span>
              <div>
                <div className="font-semibold text-slate-800">{selectedCard.label}</div>
                <div className="text-xs text-slate-500">{selectedCard.sub}</div>
              </div>
              <button type="button" onClick={() => setStep(1)} className="ml-auto text-xs text-indigo-600 hover:underline font-medium">Change</button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Full Name *</label>
                <input value={name} onChange={e => setName(e.target.value)}
                  placeholder="Full name"
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400" required />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Work Email *</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="Work email"
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400" required />
              </div>

              {needsCompany && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Company / Brand *</label>
                  <select value={company} onChange={e => setCompany(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 bg-white">
                    {companiesList.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
              )}

              {needsDept && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Department *</label>
                  <select value={dept} onChange={e => setDept(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 bg-white">
                    {teams.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                    <option value="Other">Other / Custom</option>
                  </select>
                </div>
              )}

              {needsCenter && (
                <div className={needsCenter ? 'sm:col-span-2' : ''}>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                    Home Center {needsCenter ? '*' : '(optional)'}
                    {needsCenter && (
                      <span className="ml-2 text-rose-500 font-normal">— Center Admin ka center zaroori hai</span>
                    )}
                  </label>
                  <CenterCombobox centers={centers} value={centerCode} onChange={setCenterCode}
                    placeholder={centers.length ? "Search center, city or code…" : "Loading centers…"} required={needsCenter} />
                </div>
              )}
            </div>

            <div className="flex justify-between mt-6">
              <button type="button" onClick={() => setStep(1)}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                ← Back
              </button>
              <button type="submit"
                className="px-6 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-all inline-flex items-center gap-2">
                Continue → Set Password
              </button>
            </div>
          </form>
        )}

        {step === 3 && selectedCard && (
          <form onSubmit={handleSubmit}>
            <div className="mb-5 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Creating account for:</div>
              <div className="flex flex-wrap gap-3">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-700">
                  {selectedCard.icon} {selectedCard.label}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-mono text-slate-700">
                  {email}
                </span>
                {centerCode && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-xs font-bold text-indigo-700">
                    🏢 {centerCode}
                  </span>
                )}
                {company && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs text-slate-600">
                    {company}
                  </span>
                )}
              </div>
              <button type="button" onClick={() => setStep(2)} className="text-xs text-indigo-600 hover:underline mt-1">Edit details</button>
            </div>

            <div className="max-w-sm">
              <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Set Initial Password *</label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400"
                required minLength={6} autoFocus
              />
              <p className="text-xs text-slate-400 mt-1.5">User can change this after first login.</p>
            </div>

            <div className="flex justify-between mt-6">
              <button type="button" onClick={() => setStep(2)}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                ← Back
              </button>
              <button type="submit" disabled={saving}
                className="px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 rounded-lg shadow-sm transition-all inline-flex items-center gap-2">
                <UserPlus className="w-4 h-4" />
                {saving ? 'Saving to Database…' : 'Create Account'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
