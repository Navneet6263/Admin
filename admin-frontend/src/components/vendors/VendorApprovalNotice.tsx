import { useState } from 'react';
import { VendorSendDialog } from './VendorSendDialog';
import { VendorDispatchButton } from './VendorDispatchButton';

export function VendorApprovalNotice({ ids, dismiss }: { ids: number[]; dismiss: () => void }) {
  const [open, setOpen] = useState(false);
  if (!ids.length) return null;
  return <div className="m-4 flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900" role="status">
    <span>{ids.length} card request(s) approved. Ready to verify and send to a vendor.</span>
    {ids.length <= 10 ? <button type="button" className="rounded-lg bg-indigo-600 px-3 py-2 font-semibold text-white"
      onClick={() => setOpen(true)}>Select vendor & verify templates</button> : <VendorDispatchButton />}
    <button type="button" className="ml-auto text-xs underline" onClick={dismiss}>Later</button>
    {open && <VendorSendDialog ids={ids} onClose={() => setOpen(false)} onSent={() => {}} />}
  </div>;
}
