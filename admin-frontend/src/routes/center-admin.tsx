import { createFileRoute } from '@tanstack/react-router';
import { Activity, AlertTriangle, Building2, ClipboardCheck, LayoutDashboard, Package, PackageCheck, RefreshCw } from 'lucide-react';
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
import { PaginationBar } from '@/components/PaginationBar';
import { CenterCombobox } from '@/components/CenterCombobox';
import { PanelLoadingSkeleton } from '@/components/LoadingSkeletons';

type Tab = 'overview' | 'approvals' | 'activity' | 'inventory';
type QueueFilter = 'awaiting_approval' | 'ready_to_assign' | 'delivery_issues' | 'approved' | 'rejected' | 'withdrawn' | 'all';
type CenterOption = { id: number; code: string; name: string; city: string };
type QueueSummary = { ready_to_assign?: number; delivery_issues?: number };

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
  const [queueLoading, setQueueLoading] = useState(true);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [centers, setCenters] = useState<CenterOption[]>([]);
  const [selectedCenter, setSelectedCenter] = useState('');
  const [readyCount, setReadyCount] = useState(0);
  const [deliveryIssueCount, setDeliveryIssueCount] = useState(0);
  const pageSize = 20;
  const scope = selectedCenter ? `center_code=${encodeURIComponent(selectedCenter)}` : '';

  const loadQueue = useCallback(async (status: QueueFilter) => {
    setQueueLoading(true);
    try {
      const result = await request<Paged<CenterRequest, QueueSummary>>(`/api/workflow/queue?status=${status}&page=${page}&page_size=${pageSize}${scope ? `&${scope}` : ''}`);
      setRequests(result.data); setTotal(result.total);
      setReadyCount(Number(result.summary?.ready_to_assign || 0));
      setDeliveryIssueCount(Number(result.summary?.delivery_issues || 0));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Queue could not be loaded');
    } finally { setQueueLoading(false); }
  }, [page, scope]);
  const loadOverview = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [summary, logs] = await Promise.all([
        request<CenterOverviewData>(`/api/center-admin/overview${scope ? `?${scope}` : ''}`),
        request<CenterActivityRow[]>(`/api/center-admin/activity?limit=40${scope ? `&${scope}` : ''}`),
      ]);
      setOverview(summary); setActivity(logs);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Dashboard could not be loaded'); }
    finally { setLoading(false); }
  }, [scope]);
  const refresh = useCallback(async () => { await Promise.all([loadOverview(), loadQueue(filter)]); }, [filter, loadOverview, loadQueue]);
  useEffect(() => { void loadOverview(); }, [loadOverview]);
  useEffect(() => { void loadQueue(filter); }, [filter, loadQueue]);
  useEffect(() => {
    void request<CenterOption[]>('/api/centers').then((rows) => {
      setCenters(rows);
      setSelectedCenter((current) => current || user?.center_code || rows[0]?.code || '');
    }).catch((cause) => setError(cause instanceof Error ? cause.message : 'Centers could not be loaded'));
  }, [user?.center_code]);
  useEffect(() => {
    if (tab !== 'inventory' || inventory.length) return;
    setInventoryLoading(true);
    void request<CenterInventoryRow[]>(`/api/center-admin/inventory-view${scope ? `?${scope}` : ''}`).then(setInventory).catch((cause) =>
      setError(cause instanceof Error ? cause.message : 'Inventory could not be loaded')).finally(() => setInventoryLoading(false));
  }, [inventory.length, scope, tab]);

  const act = async (id: number, action: 'approve' | 'reject' | 'assign') => {
    if (action === 'assign' && !window.confirm('Confirm this item has been handed over to the employee?')) return;
    setError('');
    try {
      const remarks = action === 'assign' ? 'Item handed over to employee' : '';
      await request(`/api/workflow/requests/${id}/${action}`, { method: 'POST', body: { remarks } });
      if (page === 1) await refresh(); else setPage(1);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : `Request could not be ${action}d`;
      setError(message);
    }
  };
  const resolveIssue = async (id: number) => {
    if (!window.confirm('Mark this delivery issue as resolved and ask the employee to confirm again?')) return;
    setError('');
    try {
      await request(`/api/workflow/requests/${id}/resolve-delivery`, { method: 'POST',
        body: { remarks: 'Delivery issue resolved. Employee asked to confirm receipt again.' } });
      if (page === 1) await refresh(); else setPage(1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Delivery issue could not be resolved');
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
          <div className="flex items-center gap-2">
          <button type="button" onClick={() => { setTab('approvals'); setFilter('ready_to_assign'); setPage(1); }}
            className="inline-flex items-center gap-2 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-left text-cyan-800 shadow-sm">
            <PackageCheck className="h-4 w-4" /><span><b className="block text-xs">Ready to Assign · {readyCount}</b><span className="text-[10px]">Applicable inventory already deducted</span></span>
          </button>
          <button type="button" onClick={() => { setTab('approvals'); setFilter('delivery_issues'); setPage(1); }}
            className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-left text-rose-800 shadow-sm">
            <AlertTriangle className="h-4 w-4" /><span><b className="block text-xs">Delivery Issues - {deliveryIssueCount}</b><span className="text-[10px]">Resolve and ask employee to confirm</span></span>
          </button>
          {centers.length > 1 && <CenterCombobox centers={centers} value={selectedCenter}
            onChange={(value) => { setSelectedCenter(value); setInventory([]); setPage(1); }}
            placeholder="Select accessible center" className="w-64" />}
          <button type="button" onClick={() => void refresh()} disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh data</button>
          </div>
        </div>
        {error && <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">{error}</div>}
        {loading && !overview ? <PanelLoadingSkeleton /> : <>
          {tab === 'overview' && overview && <CenterOverview data={overview} activity={activity} />}
          {tab === 'approvals' && <section>
            <div className="mb-4 flex flex-wrap gap-2">{([['awaiting_approval','Needs action'],['ready_to_assign','Ready to assign'],['delivery_issues','Delivery issues'],['approved','Approved'],['rejected','Rejected'],['withdrawn','Withdrawn'],['all','All history']] as const).map(([value,label]) =>
              <button key={value} type="button" onClick={() => { setFilter(value); setPage(1); }} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${filter === value ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>{label}</button>)}</div>
            {queueLoading ? <PanelLoadingSkeleton /> : <><div className="grid gap-3 lg:grid-cols-2">{visible.map((row) => <CenterRequestCard key={row.id} req={row} onApprove={(id) => act(id,'approve')} onReject={(id) => act(id,'reject')} onAssign={(id) => act(id,'assign')} onResolve={resolveIssue} />)}</div>
            {!visible.length && <div className="rounded-xl border border-dashed border-slate-300 bg-white py-20 text-center text-sm text-slate-400">No requests match this view.</div>}
            <div className="mt-4 overflow-hidden rounded-lg border border-slate-200"><PaginationBar page={page} pageSize={pageSize} total={total} onPageChange={setPage} /></div></>}
          </section>}
          {tab === 'activity' && <ActivityFeed rows={activity} title="Center audit trail" subtitle="Every approval and workflow action for this center" />}
          {tab === 'inventory' && (inventoryLoading ? <PanelLoadingSkeleton /> : <CenterInventoryTable rows={inventory} />)}
        </>}
      </div>
    </div>
  </DashboardLayout>;
}
