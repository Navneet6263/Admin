import { useEffect, useState } from "react";
import { Building2, AlertTriangle, Plus, Edit2, Copy, Check, Sparkles } from "lucide-react";
import { request } from "@/lib/api";
import { type UserRow, type CenterRow } from "./shared";

interface CentersAssignmentPanelProps {
  users: UserRow[];
  centers: CenterRow[];
  assigningId: number | null;
  search: string;
  onSearch: (v: string) => void;
  onAssign: (userId: number, centerCode: string) => void;
  onLoad: () => void;
}

export function CentersAssignmentPanel({ users, centers, assigningId, search, onSearch, onAssign, onLoad }: CentersAssignmentPanelProps) {
  useEffect(() => { onLoad(); }, [onLoad]);

  // Create Center Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newCity, setNewCity] = useState("");
  const [newCompany, setNewCompany] = useState("VT");
  const [newBudget, setNewBudget] = useState("200000");
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

  // Self Join test state
  const [joinUserId, setJoinUserId] = useState("");
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinResMsg, setJoinResMsg] = useState("");

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
          city: newCity.trim() || 'Noida',
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

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinUserId || !joinCodeInput) return;
    setJoining(true); setJoinResMsg("");
    try {
      const res = await request<{ message: string }>('/api/centers/join-by-code', {
        method: 'POST',
        body: { user_id: parseInt(joinUserId), center_code: joinCodeInput },
      });
      setJoinResMsg(res.message);
      onLoad();
    } catch (err) {
      setJoinResMsg(err instanceof Error ? err.message : "Failed to join center");
    } finally { setJoining(false); }
  };

  const filtered = users.filter(u =>
    !search || u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.center_name ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const unassigned = filtered.filter(u => !u.center_code).length;

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
          {unassigned > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
              <AlertTriangle className="w-3.5 h-3.5" /> {unassigned} unassigned
            </span>
          )}

          <button
            onClick={() => { setShowCreateModal(true); setCreateErr(""); setCreateMsg(""); }}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-all inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Create New Center
          </button>
        </div>
      </div>

      {/* Centers Summary & Edit Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Group Centers ({centers.length})</h3>
          <span className="text-[10px] text-slate-400">Click Code to Copy · Click Edit to Update</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {centers.map(c => {
            const count = users.filter(u => u.center_code === c.code).length;
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
                      setEditCompany(c.company || "VT");
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
          </div>
        </div>

        {/* Quick Join Test Form */}
        <form onSubmit={handleJoinByCode} className="flex items-center gap-2 w-full md:w-auto shrink-0 bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
          <select
            value={joinUserId}
            onChange={e => setJoinUserId(e.target.value)}
            className="text-xs border border-slate-200 rounded px-2 py-1 bg-slate-50 focus:outline-none"
          >
            <option value="">Select User</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>#{u.id} {u.name}</option>
            ))}
          </select>

          <input
            type="text"
            value={joinCodeInput}
            onChange={e => setJoinCodeInput(e.target.value)}
            placeholder="Enter Code (e.g. B01)"
            className="w-28 text-xs border border-slate-200 rounded px-2 py-1 uppercase font-mono font-bold text-indigo-600 focus:outline-none"
          />

          <button
            type="submit"
            disabled={joining}
            className="px-3 py-1 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded transition-all disabled:opacity-50 whitespace-nowrap"
          >
            {joining ? 'Linking…' : 'Link Center'}
          </button>
        </form>
      </div>
      {joinResMsg && (
        <div className={`text-xs p-2.5 rounded-lg border ${joinResMsg.includes('Successfully') || joinResMsg.includes('✅') ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-600 border-rose-200'}`}>
          {joinResMsg}
        </div>
      )}

      {/* Search Bar */}
      <div className="relative">
        <input
          type="text" value={search} onChange={e => onSearch(e.target.value)}
          placeholder="Search employees by name, email, or assigned center…"
          className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
      </div>

      {/* Users Assignment Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-5 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Employee</th>
              <th className="px-5 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Role / Dept</th>
              <th className="px-5 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Current Center</th>
              <th className="px-5 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Assign Center</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u, i) => (
              <tr key={u.id} className={`border-b border-slate-100 ${i % 2 === 0 ? "" : "bg-slate-50/50"} hover:bg-indigo-50/30 transition-colors`}>
                <td className="px-5 py-3.5">
                  <div className="font-semibold text-slate-800">{u.name}</div>
                  <div className="text-xs text-slate-400">{u.email}</div>
                </td>
                <td className="px-5 py-3.5">
                  <span className="inline-block px-2 py-0.5 text-[11px] font-semibold rounded-full bg-slate-100 text-slate-600 capitalize">{u.role}</span>
                  {u.dept && <div className="text-xs text-slate-400 mt-0.5">{u.dept}</div>}
                </td>
                <td className="px-5 py-3.5">
                  {u.center_code ? (
                    <div>
                      <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{u.center_code}</span>
                      <div className="text-xs text-slate-500 mt-0.5">{u.center_name} · {u.center_city}</div>
                    </div>
                  ) : (
                    <span className="text-xs text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded">⚠ Not assigned</span>
                  )}
                </td>
                <td className="px-5 py-3.5">
                  <select
                    value={u.center_code ?? ""}
                    disabled={assigningId === u.id}
                    onChange={e => { if (e.target.value) onAssign(u.id, e.target.value); }}
                    className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-50 cursor-pointer"
                  >
                    <option value="">— Select Center —</option>
                    {centers.filter(c => c.is_active !== false).map(c => (
                      <option key={c.code} value={c.code}>{c.code} — {c.name} ({c.city})</option>
                    ))}
                  </select>
                  {assigningId === u.id && <span className="ml-2 text-xs text-indigo-500 animate-pulse">Saving…</span>}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-slate-400 text-sm">
                  No users found matching "{search}"
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
