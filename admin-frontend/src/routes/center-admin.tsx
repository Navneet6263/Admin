import { createFileRoute } from '@tanstack/react-router';
import { Activity, Building2, ClipboardCheck, LayoutDashboard, Package, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { CenterInventoryTable } from '@/components/center-admin/CenterInventoryTable';
import { CenterOverview } from '@/components/center-admin/CenterOverview';
import { CenterRequestCard, type CenterRequest } from '@/components/center-admin/CenterRequestCard';
import type { CenterActivityRow, CenterInventoryRow, CenterOverviewData } from '@/components/center-admin/types';
import { DashboardLayout } from '@/components/DashboardLayout';
import { protectedRoute } from '@/components/ProtectedRoute';
import { request, type Paged } from '@/lib/api';
import { useSessionUser } from '@/lib/useSessionUser';

type Tab = 'overview' | 'approvals' | 'activity' | 'inventory';
type QueueFilter = 'awaiting_approval' | 'approved' | 'rejected' | 'all';

export const Route = createFileRoute('/center-admin')({
  head: () => ({ meta: [{ title: 'Center Admin · RequestHub' },
    { name: 'description', content: 'Center operations, approvals, budget, activity and inventory.' }] }),
  component: protectedRoute(CenterAdminDashboard, ['center_admin']),
});

function CenterAdminDashboard() {
  const user = useSessionUser();
  const [tab, setTab] = useState<Tab>('overview');
  const [filter, setFilter] = useState<QueueFilter>('awaiting_approval');
  const [overview, setOverview] = useState<CenterOverviewData | null>(null);
  const [activity, setActivity] = useState<CenterActivityRow[]>([]);
  const [inventory, setInventory] = useState<CenterInventoryRow[]>([]);
  const [requests, setRequests] = useState<CenterRequest[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadQueue = useCallback(async (status: QueueFilter) => {
    const page = await request<Paged<CenterRequest>>(`/api/workflow/queue?status=${status}&page_size=100`);
    setRequests(page.data);
  }, []);
  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [summary, logs] = await Promise.all([
        request<CenterOverviewData>('/api/center-admin/overview'),
        request<CenterActivityRow[]>('/api/center-admin/activity?limit=40'),
        loadQueue(filter),
      ]);
      setOverview(summary); setActivity(logs);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Dashboard could not be loaded'); }
    finally { setLoading(false); }
  }, [filter, loadQueue]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (tab !== 'inventory' || inventory.length) return;
    void request<CenterInventoryRow[]>('/api/center-admin/inventory-view').then(setInventory).catch((cause) =>
      setError(cause instanceof Error ? cause.message : 'Inventory could not be loaded'));
  }, [inventory.length, tab]);

  const act = async (id: number, action: 'approve' | 'reject') => {
    setError('');
    try {
      await request(`/api/workflow/requests/${id}/${action}`, { method: 'POST', body: { remarks: '' } });
      await refresh();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : `Request could not be ${action}d`;
      setError(message);
    }
  };
  const visible = useMemo(() => {
    const value = query.trim().toLowerCase();
    return requests.filter((row) => !value || `${row.ref_id} ${row.subject} ${row.employeeName}`.toLowerCase().includes(value));
  }, [query, requests]);
  const tabs = [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'approvals', label: 'Approval queue', icon: ClipboardCheck, badge: overview?.requests.awaiting_approval },
    { key: 'activity', label: 'Activity logs', icon: Activity },
    { key: 'inventory', label: 'Center inventory', icon: Package, badge: overview?.inventory.low_stock },
  ];

  return <DashboardLayout workspace="Center Operations" role="Center Admin"
    currentUser={user ? `${user.name} · ${user.center_code || 'Unassigned'}` : 'Center Admin'}
    tabs={tabs} activeTab={tab} onTabChange={(value) => setTab(value as Tab)}
    searchQuery={query} onSearchChange={setQuery} searchPlaceholder="Search request ID, subject or employee">
    <div className="min-h-full bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-indigo-600"><Building2 className="h-3.5 w-3.5" /> {overview?.center.code || user?.center_code || 'Center'}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{overview?.center.name || 'Center operations'}</h1>
            <p className="mt-1 text-xs text-slate-500">{overview ? `${overview.center.city} · ${overview.center.company}` : 'Secure center-scoped workspace'}</p>
          </div>
          <button type="button" onClick={() => void refresh()} disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh data</button>
        </div>
        {error && <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">{error}</div>}
        {loading && !overview ? <div className="rounded-xl border border-slate-200 bg-white py-24 text-center text-xs text-slate-400">Loading center operations…</div> : <>
          {tab === 'overview' && overview && <CenterOverview data={overview} activity={activity} />}
          {tab === 'approvals' && <section>
            <div className="mb-4 flex flex-wrap gap-2">{([['awaiting_approval','Needs action'],['approved','Approved'],['rejected','Rejected'],['all','All history']] as const).map(([value,label]) =>
              <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${filter === value ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>{label}</button>)}</div>
            <div className="grid gap-3 lg:grid-cols-2">{visible.map((row) => <CenterRequestCard key={row.id} req={row} onApprove={(id) => act(id,'approve')} onReject={(id) => act(id,'reject')} />)}</div>
            {!visible.length && <div className="rounded-xl border border-dashed border-slate-300 bg-white py-20 text-center text-sm text-slate-400">No requests match this view.</div>}
          </section>}
          {tab === 'activity' && <ActivityFeed rows={activity} title="Center audit trail" subtitle="Every approval and workflow action for this center" />}
          {tab === 'inventory' && <CenterInventoryTable rows={inventory} />}
        </>}
      </div>
    </div>
  </DashboardLayout>;
}
