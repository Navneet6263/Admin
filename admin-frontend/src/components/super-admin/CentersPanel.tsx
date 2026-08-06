import { useEffect, useMemo, useState } from "react";
import { Building2, Plus, Edit2, Copy, Check, Sparkles, Search } from "lucide-react";
import { request } from "@/lib/api";
import { type UserRow, type CenterRow } from "./shared";
import { useCompanies } from "@/lib/directory";

interface CentersAssignmentPanelProps {
  users: UserRow[];
  centers: CenterRow[];
  onLoad: () => void;
}

export function CentersAssignmentPanel({ users, centers, onLoad }: CentersAssignmentPanelProps) {
  const companies = useCompanies();
  useEffect(() => { onLoad(); }, [onLoad]);

  // Create Center Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newCity, setNewCity] = useState("");
  const [newCompany, setNewCompany] = useState("Vision India");
  const [newBudget, setNewBudget] = useState("0");
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState("");
  const [createErr, setCreateErr] = useState("");

  // Edit Center Modal State
  const [editingCenter, setEditingCenter] = useState<CenterRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editCompany, setEditCompany] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [editMsg, setEditMsg] = useState("");

  // Copy indicator state
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const [centerQuery, setCenterQuery] = useState("");

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleCreateCenter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) { setCreateErr("Center Name is required"); return; }
    setCreating(true); setCreateErr(""); setCreateMsg("");
    try {
      const created = await request<{ code: string; name: string }>('/api/centers/create', {
        method: 'POST',
        body: {
          code: newCode.trim() || undefined,
          name: newName.trim(),
          city: newCity.trim(),
          company: newCompany,
          initial_budget: newBudget,
        },
      });
      setCreateMsg(`✅ Center "${created.name}" (${created.code}) created successfully!`);
      setNewCode(""); setNewName(""); setNewCity("");
      onLoad();
      setTimeout(() => setShowCreateModal(false), 1500);
    } catch (err) {
      setCreateErr(err instanceof Error ? err.message : "Failed to create center");
    } finally { setCreating(false); }
  };

  const handleUpdateCenter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCenter) return;
    setUpdating(true); setEditMsg("");
    try {
      await request(`/api/centers/${editingCenter.id}`, {
        method: 'PUT',
        body: {
          name: editName.trim(),
          city: editCity.trim(),
          company: editCompany,
          is_active: editActive,
        },
      });
      setEditMsg("✅ Center updated!");
      onLoad();
      setTimeout(() => setEditingCenter(null), 1200);
    } catch (err) {
      setEditMsg(err instanceof Error ? err.message : "Failed to update center");
    } finally { setUpdating(false); }
  };

  const employeeCountByCenter = useMemo(() => users.reduce<Record<string, number>>((counts, user) => {
    if (user.center_code) counts[user.center_code] = (counts[user.center_code] ?? 0) + 1;
    return counts;
  }, {}), [users]);
  const visibleCenters = useMemo(() => {
    const query = centerQuery.trim().toLowerCase();
    if (!query) return centers;
    return centers.filter(center =>
      `${center.code} ${center.name} ${center.city} ${center.company}`.toLowerCase().includes(query)
    );
  }, [centerQuery, centers]);

  return (
    <div className="px-1 space-y-6">
      {/* Top Header + Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-500" /> Centers & Location Management
          </h2>
          <p className="text-xs text-slate-500 mt-1">Create new offices/centers, edit details, or share Center Codes with employees for auto-assignment.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowCreateModal(true); setCreateErr(""); setCreateMsg(""); }}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-all inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Create New Center
          </button>
        </div>
      </div>

      {/* Centers Summary & Edit Grid */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/70">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Active Group Centers ({centers.length})</h3>
            <span className="text-[10px] text-slate-400">Showing {visibleCenters.length} · Click code to copy · Edit to update</span>
          </div>
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={centerQuery} onChange={event => setCenterQuery(event.target.value)}
              placeholder="Search center, city, company or code…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-800 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-200/60" />
          </div>
        </div>

        <div className="request-scrollbar max-h-[min(62vh,620px)] overflow-y-auto p-3 sm:p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibleCenters.map(c => {
            const count = employeeCountByCenter[c.code] ?? 0;
            return (
              <div key={c.code} className="bg-white border border-slate-200 hover:border-indigo-300 rounded-xl p-3.5 shadow-sm transition-all relative group">
                <div className="flex items-center justify-between mb-1.5">
                  <button
                    onClick={() => handleCopyCode(c.code)}
                    title="Click to copy center code"
                    className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 px-2 py-0.5 rounded transition-colors"
                  >
                    {copiedCode === c.code ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-indigo-400" />}
                    {c.code}
                  </button>

                  <button
                    onClick={() => {
                      setEditingCenter(c);
                      setEditName(c.name);
                      setEditCity(c.city);
                      setEditCompany(c.company || "Vision India");
                      setEditActive(c.is_active !== false);
                      setEditMsg("");
                    }}
                    className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded transition-colors"
                    title="Edit Center Details"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="text-sm font-bold text-slate-800 truncate">{c.name}</div>
                <div className="text-xs text-slate-500 mt-0.5">{c.city}</div>

                <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                  <span className="font-semibold text-indigo-600">{count} employee{count !== 1 ? "s" : ""}</span>
                  {!c.is_active && (
                    <span className="text-[10px] text-rose-500 font-semibold bg-rose-50 px-1.5 py-0.5 rounded">Inactive</span>
                  )}
                </div>
              </div>
            );
          })}
          </div>
          {visibleCenters.length === 0 && (
            <div className="grid min-h-48 place-items-center text-center">
              <div><Search className="mx-auto mb-2 h-6 w-6 text-slate-300" /><p className="text-sm font-medium text-slate-500">No matching center found</p><p className="mt-1 text-xs text-slate-400">Try a code, city, company, or center name.</p></div>
            </div>
          )}
        </div>
      </div>

      {/* Shareable Code Info Box */}
      <div className="bg-gradient-to-r from-indigo-900/5 via-purple-900/5 to-transparent border border-indigo-200/60 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-slate-800">Auto-Center Assignment with Center Code 🚀</h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Employees can enter their office Center Code (e.g. <span className="font-mono font-bold text-indigo-600">A11</span>, <span className="font-mono font-bold text-indigo-600">B01</span>, <span className="font-mono font-bold text-indigo-600">C01</span>) during registration or login to automatically join their center!
            </p>
            <p className="mt-1 text-[10px] font-medium text-indigo-600">Manual user assignment is managed only from Team & Roles → Team Roster.</p>
          </div>
        </div>

      </div>

      {/* CREATE CENTER MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-600" /> Create New Center
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600 text-lg">✕</button>
            </div>

            <form onSubmit={handleCreateCenter} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Center Name *</label>
                <input
                  type="text" value={newName} onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. Pune Regional Office"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-300"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Center Code</label>
                  <input
                    type="text" value={newCode} onChange={e => setNewCode(e.target.value.toUpperCase())}
                    placeholder="Auto (e.g. P01)"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none font-mono font-bold text-indigo-600 uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">City *</label>
                  <input
                    type="text" value={newCity} onChange={e => setNewCity(e.target.value)}
                    placeholder="e.g. Pune"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-300"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Monthly Budget (₹)</label>
                  <input
                    type="number" value={newBudget} onChange={e => setNewBudget(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Company *</label>
                <select value={newCompany} onChange={e => setNewCompany(e.target.value)} required
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
                  {companies.map(company => <option key={company.id} value={company.name}>{company.name}</option>)}
                </select>
              </div>

              {createErr && <div className="text-xs text-rose-600 bg-rose-50 border border-rose-100 p-2.5 rounded-lg">{createErr}</div>}
              {createMsg && <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 p-2.5 rounded-lg font-medium">{createMsg}</div>}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={creating} className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm disabled:opacity-50">
                  {creating ? 'Saving to DB…' : 'Save Center'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT CENTER MODAL */}
      {editingCenter && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-indigo-600" /> Edit Center — <span className="font-mono text-indigo-600">{editingCenter.code}</span>
              </h3>
              <button onClick={() => setEditingCenter(null)} className="text-slate-400 hover:text-slate-600 text-lg">✕</button>
            </div>

            <form onSubmit={handleUpdateCenter} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Center Name</label>
                <input
                  type="text" value={editName} onChange={e => setEditName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">City</label>
                  <input
                    type="text" value={editCity} onChange={e => setEditCity(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox" id="editActiveCheck" checked={editActive} onChange={e => setEditActive(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                />
                <label htmlFor="editActiveCheck" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  Center Active Status (Uncheck to deactivate center)
                </label>
              </div>

              {editMsg && <div className="text-xs p-2.5 rounded-lg border bg-emerald-50 text-emerald-700 border-emerald-100 font-medium">{editMsg}</div>}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditingCenter(null)} className="px-4 py-2 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={updating} className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm disabled:opacity-50">
                  {updating ? 'Updating…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
