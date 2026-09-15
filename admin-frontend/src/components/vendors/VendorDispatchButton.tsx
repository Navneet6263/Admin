import { useState } from 'react';
import { session } from '@/lib/api';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { VendorCardsPanel } from './VendorCardsPanel';
import { VendorSendDialog } from './VendorSendDialog';

export function VendorDispatchButton({ requestId }: { requestId?: number }) {
  const [open, setOpen] = useState(false);
  if (!['hq_admin', 'super_admin', 'center_admin'].includes(session.user?.role || '')) return null;
  return <>
    <button type="button" onClick={() => setOpen(true)} className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-800 hover:bg-indigo-100">
      {requestId ? 'Verify template & send to vendor' : 'Approved cards · Vendor dispatch'}
    </button>
    {open && (requestId ? <VendorSendDialog ids={[requestId]} onClose={() => setOpen(false)} onSent={() => {}} />
      : <Dialog open onOpenChange={setOpen}><DialogContent className="max-h-[94dvh] w-[96vw] max-w-5xl overflow-y-auto bg-white text-slate-900">
        <DialogTitle>Approved cards · Vendor dispatch</DialogTitle>
        <DialogDescription>Review delivery status or select approved cards to send to a printing vendor.</DialogDescription>
        <VendorCardsPanel />
      </DialogContent></Dialog>)}
  </>;
}
