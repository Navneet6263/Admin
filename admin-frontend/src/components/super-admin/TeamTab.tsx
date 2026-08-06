import { useState, useEffect, useCallback, useMemo } from "react";
import { Building2, Plus, Search, X, RotateCcw } from "lucide-react";
import { request } from "@/lib/api";
import { SmartUserForm } from "./SmartUserForm";
import { CenterCombobox, type CenterOption } from "@/components/CenterCombobox";

interface TeamTabProps {
  mode?: 'super' | 'hq';
}

interface UserRow {
  id: number; email: string; name: string; role: string; company: string; dept: string;
  center_code?: string | null; center_name?: string | null; center_city?: string | null;
  is_active: boolean; created_at: string;
}

export function TeamTab({ mode = 'super' }: TeamTabProps) {
  const userApiBase = mode === 'hq' ? '/api/admin/users' : '/api/super-admin/users';
  const isSuperAdmin = mode === 'super';
  const [users, setUsers] = useState<UserRow[]>([]);
  const [teams, setTeams] = useState<Array<{ id: number; name: string; company: string }>>([]);
  const [centers, setCenters] = useState<Array<CenterOption & { is_active?: boolean }>>([]);
  const [loading, setLoading] = useState(true);
  const [assigningId, setAssigningId] = useState<number | null>(null);
  const [assignmentError, setAssignmentError] = useState('');
  const [userQuery, setUserQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [centerFilter, setCenterFilter] = useState('all');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Dynamic Company & Team Creation state
  const [companiesList, setCompaniesList] = useState<Array<{ id: number; code: string; name: string; legal_name: string }>>([]);
  const [newCompName, setNewCompName] = useState('');
  const [creatingComp, setCreatingComp] = useState(false);
  const [compSuccess, setCompSuccess] = useState('');
  const [compError, setCompError] = useState('');

  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamCompany, setNewTeamCompany] = useState('');
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [teamError, setTeamError] = useState('');
  const [teamSuccess, setTeamSuccess] = useState('');

  const fetchUsersAndTeams = useCallback(async () => {
    try {
      setLoading(true);
      const [uData, tData, cData, centerData] = await Promise.all([
        request<UserRow[]>(userApiBase),
        request<Array<{ id: number; name: string; company: string }>>('/api/teams'),
        request<Array<{ id: number; code: string; name: string; legal_name: string }>>('/api/companies').catch(() => []),
        request<Array<CenterOption & { is_active?: boolean }>>('/api/centers'),
      ]);
      setUsers(uData);
      setTeams(tData);
      setCenters(centerData);
      if (Array.isArray(cData) && cData.length > 0) {
        setCompaniesList(cData);
        setNewTeamCompany((prev) => prev || cData[0].name);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [userApiBase]);

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

  const assignCenter = async (userId: number, centerCode: string) => {
    setAssigningId(userId); setAssignmentError('');
    try {
      await request(`${userApiBase}/${userId}/assign-center`, {
        method: 'POST', body: { center_code: centerCode },
      });
      await fetchUsersAndTeams();
    } catch (cause) {
      setAssignmentError(cause instanceof Error ? cause.message : 'Center assignment failed');
    } finally {
      setAssigningId(null);
    }
  };

  const roleBadges: Record<string, string> = {
    super_admin: 'bg-purple-100 text-purple-800 border-purple-200',
    hq_admin: 'bg-slate-100 text-slate-800 border-slate-200',
    admin: 'bg-slate-100 text-slate-800 border-slate-200',
    center_admin: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    finance: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    finance_head: 'bg-teal-100 text-teal-800 border-teal-200',
    verifier: 'bg-violet-100 text-violet-800 border-violet-200',
    employee: 'bg-sky-100 text-sky-800 border-sky-200',
  };
  const globalRole = (role: string) => ['hq_admin', 'admin', 'super_admin'].includes(role);

  const filterOptions = useMemo(() => ({
    roles: [...new Set(users.map((user) => user.role).filter(Boolean))].sort(),
    centers: [...new Set(centers.filter((center) => center.is_active !== false).map((center) => center.code))].sort(),
    companies: [...new Set(users.map((user) => user.company).filter(Boolean))].sort(),
    departments: [...new Set(users.map((user) => user.dept).filter(Boolean))].sort(),
  }), [centers, users]);
  const filteredUsers = useMemo(() => {
    const query = userQuery.trim().toLowerCase();
    return users.filter((user) => {
      const matchesSearch = !query || [user.name, user.email, user.dept, user.company,
        user.center_code ?? '', user.center_name ?? '', String(user.id)]
        .some((value) => value.toLowerCase().includes(query));
      return matchesSearch
        && (roleFilter === 'all' || user.role === roleFilter)
        && (centerFilter === 'all' || (centerFilter === 'unassigned' ? !user.center_code : user.center_code === centerFilter))
        && (companyFilter === 'all' || user.company === companyFilter)
        && (deptFilter === 'all' || user.dept === deptFilter)
        && (statusFilter === 'all' || (statusFilter === 'active') === Boolean(user.is_active));
    });
  }, [centerFilter, companyFilter, deptFilter, roleFilter, statusFilter, userQuery, users]);
  const filtersActive = Boolean(userQuery) || [roleFilter, centerFilter, companyFilter, deptFilter, statusFilter].some((value) => value !== 'all');
  const resetFilters = () => {
    setUserQuery(''); setRoleFilter('all'); setCenterFilter('all');
    setCompanyFilter('all'); setDeptFilter('all'); setStatusFilter('all');
  };

  return (
    <div className="space-y-6 pt-2">
      {/* 0. DYNAMIC COMPANY / BRAND CREATION SECTION */}
      {isSuperAdmin && <div className="bg-gradient-to-r from-emerald-900/5 via-teal-900/5 to-transparent border border-emerald-200/60 rounded-xl p-5 shadow-sm">
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
      </div>}

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
        userApiBase={userApiBase}
        allowedRoles={isSuperAdmin ? undefined : ['employee', 'center_admin', 'verifier', 'finance', 'finance_head']}
      />

      {/* 3. USERS ROSTER TABLE */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-xs font-semibold text-slate-800 uppercase tracking-wider">{isSuperAdmin ? 'Group' : 'HQ'} Team Roster</h3>
            <p className="mt-0.5 text-[10px] text-slate-500">{filteredUsers.length} shown · {users.length} total users in SQL Server</p>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">Live DB table `users`</span>
        </div>

        <div className="grid grid-cols-1 gap-2 border-b border-slate-100 p-3 sm:grid-cols-2 xl:grid-cols-7">
          <div className="relative sm:col-span-2 xl:col-span-2">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input type="search" value={userQuery} onChange={(event) => setUserQuery(event.target.value)}
              placeholder="Search name, email, ID, center…" aria-label="Search team roster"
              className="h-9 w-full rounded-md border border-slate-200 bg-slate-50/70 pl-9 pr-9 text-xs outline-none focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-200/70" />
            {userQuery && <button type="button" onClick={() => setUserQuery('')} aria-label="Clear roster search"
              className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-700"><X className="h-3.5 w-3.5" /></button>}
          </div>
          <FilterSelect label="All roles" value={roleFilter} onChange={setRoleFilter}
            options={filterOptions.roles.map((value) => ({ value, label: value.replaceAll('_', ' ') }))} />
          <FilterSelect label="All centers" value={centerFilter} onChange={setCenterFilter}
            options={[{ value: 'unassigned', label: 'Global / unassigned' }, ...filterOptions.centers.map((value) => ({ value, label: value }))]} />
          <FilterSelect label="All companies" value={companyFilter} onChange={setCompanyFilter}
            options={filterOptions.companies.map((value) => ({ value, label: value }))} />
          <FilterSelect label="All departments" value={deptFilter} onChange={setDeptFilter}
            options={filterOptions.departments.map((value) => ({ value, label: value }))} />
          <div className="flex gap-2">
            <FilterSelect label="All statuses" value={statusFilter} onChange={setStatusFilter}
              options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} />
            {filtersActive && <button type="button" onClick={resetFilters} title="Reset filters" aria-label="Reset roster filters"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800"><RotateCcw className="h-3.5 w-3.5" /></button>}
          </div>
        </div>
        {assignmentError && <div className="border-b border-rose-100 bg-rose-50 px-4 py-2 text-xs text-rose-700">{assignmentError}</div>}

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">Loading user roster from database...</div>
        ) : (
          <div className="max-h-[560px] overflow-auto overscroll-contain">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider border-b border-slate-200 shadow-[0_1px_0_0_rgb(226_232_240)]">
                <tr>
                  <th className="px-4 py-2.5">ID</th>
                  <th className="px-4 py-2.5">Name</th>
                  <th className="px-4 py-2.5">Email</th>
                  <th className="px-4 py-2.5">Role</th>
                  <th className="px-4 py-2.5">Entity</th>
                  <th className="px-4 py-2.5">Center</th>
                  <th className="min-w-64 px-4 py-2.5">Assign Center</th>
                  <th className="px-4 py-2.5">Team / Dept</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((u) => (
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
                    <td className="px-4 py-3">
                      {globalRole(u.role) ? <span className="text-[10px] font-medium text-violet-700">All centers</span>
                        : u.center_code ? <div><span className="font-mono text-[11px] font-semibold text-indigo-700">{u.center_code}</span>{u.center_name && <p className="max-w-40 truncate text-[10px] text-slate-400">{u.center_name}</p>}</div>
                        : <span className="text-[10px] font-medium text-amber-600">Not assigned</span>}
                    </td>
                    <td className="px-4 py-2">
                      {globalRole(u.role) ? <span className="text-[10px] text-slate-400">Not required · global access</span>
                        : <div className="flex min-w-60 items-center gap-2">
                          <CenterCombobox centers={centers.filter((center) => center.is_active !== false)} value={u.center_code ?? ''}
                            onChange={(code) => void assignCenter(u.id, code)}
                            disabled={assigningId === u.id} placeholder="Search center…" className="w-full" />
                          {assigningId === u.id && <span className="shrink-0 text-[10px] text-indigo-600">Saving…</span>}
                        </div>}
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-medium">{u.dept || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded border ${u.is_active ? 'text-emerald-700 bg-emerald-50 border-emerald-100' : 'text-slate-500 bg-slate-100 border-slate-200'}`}>
                        ● {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && <tr><td colSpan={9} className="p-12 text-center text-xs text-slate-500">No users match the selected filters.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function FilterSelect({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} aria-label={label}
      className="h-9 min-w-0 w-full rounded-md border border-slate-200 bg-white px-2 text-xs capitalize text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200/70">
      <option value="all">{label}</option>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  );
}
