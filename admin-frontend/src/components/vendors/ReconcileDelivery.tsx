import { useState } from 'react';
import { request, session } from '@/lib/api';
import type { VendorCard } from './vendorTypes';

export function ReconcileDelivery({ card, onChanged }: { card: VendorCard; onChanged: () => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  if (!['hq_admin', 'super_admin'].includes(session.user?.role || '') || !['sending', 'unknown'].includes(card.delivery_status || '')) return null;
  const reconcile = async (outcome: 'sent' | 'failed') => {
    const note = window.prompt('Check this dispatch in your mail provider logs first. Enter the evidence/reference (at least 10 characters). This updates ALL cards in this dispatch.');
    if (!note) return;
    if (note.trim().length < 10) { setError('Enter at least 10 characters explaining the provider result.'); return; }
    if (!window.confirm(`Confirm the mail provider shows this email was ${outcome === 'sent' ? 'accepted' : 'NOT accepted'}? This does not send an email.`)) return;
    setBusy(true); setError('');
    try {
      await request(`/api/vendor-cards/${card.id}/reconcile`, { method: 'POST', body: {
        deliveryId: card.delivery_id, outcome, note, checkedProvider: true,
      } }); onChanged();
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not update delivery'); }
    finally { setBusy(false); }
  };
  return <div className="mt-2 space-y-1 text-xs">
    <p>Check provider logs before changing this status.</p>
    <button disabled={busy} className="mr-3 text-indigo-700 underline" onClick={() => void reconcile('sent')}>Confirm sent</button>
    <button disabled={busy} className="text-indigo-700 underline" onClick={() => void reconcile('failed')}>Confirm not sent</button>
    {error && <p role="alert" className="text-red-700">{error}</p>}
  </div>;
}
