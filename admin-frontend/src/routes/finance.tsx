import { createFileRoute } from '@tanstack/react-router';
import { Activity, BarChart3, Landmark, LayoutDashboard, ReceiptIndianRupee } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ExpenseAnalytics } from '@/components/analytics/ExpenseAnalytics';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { DashboardLayout } from '@/components/DashboardLayout';
import { FinanceHeadOverview } from '@/components/finance/FinanceHeadOverview';
import { PaymentQueue } from '@/components/finance/PaymentQueue';
import type { FinanceHeadData } from '@/components/finance/types';
import { protectedRoute } from '@/components/ProtectedRoute';
import { request } from '@/lib/api';
import { useSessionUser } from '@/lib/useSessionUser';
import { PanelLoadingSkeleton } from '@/components/LoadingSkeletons';

type Tab = 'overview' | 'queue' | 'ledger' | 'activity';

export const Route = createFileRoute('/finance')({
  head: () => ({ meta: [{ title: 'Finance · RequestHub' },
    { name: 'description', content: 'Payment operations and Finance Head control dashboard.' }] }),
  component: protectedRoute(FinanceConsole, ['finance', 'finance_head']),
});

function FinanceConsole() {
  const user = useSessionUser();
  const isHead = user?.role === 'finance_head';
  const [tab, setTab] = useState<Tab>('overview');
  const [headData, setHeadData] = useState<FinanceHeadData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!isHead) return;
    setLoading(true); setError('');
    void request<FinanceHeadData>('/api/payments/head-dashboard')
      .then(setHeadData).catch((cause) => setError(cause instanceof Error ? cause.message : 'Finance dashboard unavailable'))
      .finally(() => setLoading(false));
  }, [isHead]);
  const tabs = isHead ? [
    { key: 'overview', label: 'Executive overview', icon: LayoutDashboard },
    { key: 'queue', label: 'Payment controls', icon: ReceiptIndianRupee, badge: headData?.metrics.awaiting_verification },
    { key: 'ledger', label: 'Expense ledger', icon: BarChart3 },
    { key: 'activity', label: 'Finance logs', icon: Activity },
  ] : [{ key: 'queue', label: 'Payment operations', icon: ReceiptIndianRupee }];
  const activeTab = isHead ? tab : 'queue';
  return <DashboardLayout workspace={isHead ? 'Finance Control Center' : 'Finance Operations'}
    currentUser={user?.name || 'Finance'} role={isHead ? 'Finance Head' : 'Finance Executive'}
    tabs={tabs} activeTab={activeTab} onTabChange={(value) => setTab(value as Tab)}>
    <div className="min-h-full bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-indigo-600"><Landmark className="h-3.5 w-3.5" /> {isHead ? 'Enterprise finance governance' : 'Controlled fund operations'}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{isHead ? 'Finance Head dashboard' : 'Payment operations'}</h1>
          <p className="mt-1 text-xs text-slate-500">{isHead ? 'Global spend, payment risk, verification performance and audit visibility.' : 'Update and verify payments within your assigned policy limits.'}</p>
        </div>
        {error && <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">{error}</div>}
        {isHead && activeTab === 'overview' && (loading || !headData ? <Loading /> : <FinanceHeadOverview data={headData} />)}
        {activeTab === 'queue' && <PaymentQueue defaultStatus={isHead ? 'awaiting_verification' : 'all'} />}
        {isHead && activeTab === 'ledger' && <ExpenseAnalytics />}
        {isHead && activeTab === 'activity' && (headData ? <ActivityFeed rows={headData.activity} title="Finance audit trail" subtitle="Payment updates and verifications recorded across every center" /> : <Loading />)}
      </div>
    </div>
  </DashboardLayout>;
}

function Loading() {
  return <PanelLoadingSkeleton />;
}
