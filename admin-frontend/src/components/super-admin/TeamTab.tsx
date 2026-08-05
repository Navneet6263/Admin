import { useState, useEffect, useCallback } from "react";
import { Building2, Plus } from "lucide-react";
import { request } from "@/lib/api";
import { SmartUserForm } from "./SmartUserForm";

export function TeamTab() {
  const [users, setUsers] = useState<Array<{ id: number; email: string; name: string; role: string; company: string; dept: string; is_active: boolean; created_at: string }>>([]);
  const [teams, setTeams] = useState<Array<{ id: number; name: string; company: string }>>([]);
  const [loading, setLoading] = useState(true);

  // Dynamic Company & Team Creation state
  const [companiesList, setCompaniesList] = useState<Array<{ id: number; code: string; name: string; legal_name: string }>>([
    { id: 1, code: 'VI', name: 'Vision India', legal_name: 'Vision India Pvt. Ltd.' },
    { id: 2, code: 'JJ', name: 'Just Job', legal_name: 'Just Job Services Pvt. Ltd.' },
    { id: 3, code: 'LS', name: 'Live Skills', legal_name: 'Live Skills Education Pvt. Ltd.' },
  ]);
  const [newCompName, setNewCompName] = useState('');
  const [creatingComp, setCreatingComp] = useState(false);
  const [compSuccess, setCompSuccess] = useState('');
  const [compError, setCompError] = useState('');

  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamCompany, setNewTeamCompany] = useState('Vision India');
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [teamError, setTeamError] = useState('');
  const [teamSuccess, setTeamSuccess] = useState('');

  const fetchUsersAndTeams = useCallback(async () => {
    try {
      setLoading(true);
      const [uData, tData, cData] = await Promise.all([
        request<Array<{ id: number; email: string; name: string; role: string; company: string; dept: string; is_active: boolean; created_at: string }>>('/api/super-admin/users'),
        request<Array<{ id: number; name: string; company: string }>>('/api/teams'),
        request<Array<{ id: number; code: string; name: string; legal_name: string }>>('/api/companies').catch(() => []),
      ]);
      setUsers(uData);
      setTeams(tData);
      if (Array.isArray(cData) && cData.length > 0) setCompaniesList(cData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchUsersAndTeams(); }, [fetchUsersAndTeams]);

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompName.trim()) { setCompError('Please enter company name'); return; }
    setCompError(''); setCompSuccess(''); setCreatingComp(true);
    try {
      const res = await request<{ name: string; code: string }>('/api/companies/create', {
        method: 'POST', body: { name: newCompName.trim() },
      });
      setCompSuccess(`Company "${res.name}" created & saved to SQL Server!`);
      setNewCompName('');
      await fetchUsersAndTeams();
    } catch (cause) {
      setCompError(cause instanceof Error ? cause.message : 'Failed to create company');
    } finally {
      setCreatingComp(false);
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) {
      setTeamError('Please enter team name'); return;
    }
    setTeamError(''); setTeamSuccess(''); setCreatingTeam(true);
    try {
      const res = await request<{ name: string; company: string }>('/api/teams/create', {
        method: 'POST',
        body: { name: newTeamName.trim(), company: newTeamCompany },
      });
      setTeamSuccess(`Team "${res.name}" created for ${res.company} & saved to SQL Server!`);
      setNewTeamName('');
      await fetchUsersAndTeams();
    } catch (cause) {
      setTeamError(cause instanceof Error ? cause.message : 'Failed to create team');
    } finally {
      setCreatingTeam(false);
    }
  };

  const roleBadges: Record<string, string> = {
    super_admin: 'bg-purple-100 text-purple-800 border-purple-200',
    admin: 'bg-slate-100 text-slate-800 border-slate-200',
    finance: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    verifier: 'bg-violet-100 text-violet-800 border-violet-200',
    employee: 'bg-sky-100 text-sky-800 border-sky-200',
  };

  return (
    <div className="space-y-6 pt-2">
      {/* 0. DYNAMIC COMPANY / BRAND CREATION SECTION */}
      <div className="bg-gradient-to-r from-emerald-900/5 via-teal-900/5 to-transparent border border-emerald-200/60 rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Building2 className="w-5 h-5 text-emerald-600" />
          <div>
            <h2 className="font-display font-semibold text-slate-900 text-base">Create & Manage Companies / Brands</h2>
            <p className="text-xs text-slate-500">Add custom company names (e.g. Vision India, Just Job, Live Skills) saved directly to SQL Server `companies` table</p>
          </div>
        </div>

        <form onSubmit={handleCreateCompany} className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[240px]">
            <label className="block text-[11px] font-medium text-slate-700 uppercase tracking-wider mb-1">Company / Brand Name</label>
            <input
              value={newCompName}
              onChange={(e) => setNewCompName(e.target.value)}
              placeholder="e.g. Vision India, Just Job, Live Skills"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500/20 bg-white"
              required
            />
          </div>

          <button
            type="submit"
            disabled={creatingComp}
            className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-all inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> {creatingComp ? 'Creating...' : 'Create Company'}
          </button>
        </form>

        {compError && <div className="mt-2 text-xs text-rose-600 bg-rose-50 border border-rose-100 p-2 rounded-lg">{compError}</div>}
        {compSuccess && <div className="mt-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 p-2 rounded-lg font-medium">{compSuccess}</div>}
      </div>

      {/* 1. DYNAMIC TEAM CREATION SECTION */}
      <div className="bg-gradient-to-r from-indigo-900/5 via-purple-900/5 to-transparent border border-indigo-200/60 rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Building2 className="w-5 h-5 text-indigo-600" />
          <div>
            <h2 className="font-display font-semibold text-slate-900 text-base">Create New Department</h2>
            <p className="text-xs text-slate-500">Add custom department names (e.g. Product, QA, Legal, Operations) to SQL Server `teams` table</p>
          </div>
        </div>

        <form onSubmit={handleCreateTeam} className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[11px] font-medium text-slate-700 uppercase tracking-wider mb-1">New Department Name</label>
            <input
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder="e.g. Product, QA, Legal"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
              required
            />
          </div>

          <div className="w-48">
            <label className="block text-[11px] font-medium text-slate-700 uppercase tracking-wider mb-1">Assigned Company</label>
            <select
              value={newTeamCompany}
              onChange={(e) => setNewTeamCompany(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
            >
              {companiesList.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={creatingTeam}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-all inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> {creatingTeam ? 'Creating...' : 'Create Department'}
          </button>
        </form>

        {teamError && <div className="mt-2 text-xs text-rose-600 bg-rose-50 border border-rose-100 p-2 rounded-lg">{teamError}</div>}
        {teamSuccess && <div className="mt-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 p-2 rounded-lg font-medium">{teamSuccess}</div>}
      </div>

      {/* 2. SMART USER CREATION — Step-by-step, role-first */}
      <SmartUserForm
        companiesList={companiesList}
        teams={teams}
        onCreated={fetchUsersAndTeams}
      />

      {/* 3. USERS ROSTER TABLE */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h3 className="font-display text-xs font-semibold text-slate-800 uppercase tracking-wider">Group Team Roster ({users.length} Total Users in SQL Server)</h3>
          <span className="text-[10px] text-slate-500 font-mono">Live DB table `users`</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">Loading user roster from database...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5">ID</th>
                  <th className="px-4 py-2.5">Name</th>
                  <th className="px-4 py-2.5">Email</th>
                  <th className="px-4 py-2.5">Role</th>
                  <th className="px-4 py-2.5">Entity</th>
                  <th className="px-4 py-2.5">Team / Dept</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-400">#{u.id}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{u.name}</td>
                    <td className="px-4 py-3 text-slate-600 font-mono text-[11px]">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 text-[10px] font-semibold rounded border capitalize ${roleBadges[u.role] ?? 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                        {u.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] font-semibold text-slate-700">{u.company}</td>
                    <td className="px-4 py-3 text-slate-600 font-medium">{u.dept || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                        ● Active
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
