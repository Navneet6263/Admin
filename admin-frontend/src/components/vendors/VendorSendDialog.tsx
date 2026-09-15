import { useEffect, useRef, useState } from 'react';
import { request } from '@/lib/api';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { prepareVendorCards, type PreparedCard } from './prepareVendorCards';
import { VendorPicker } from './VendorPicker';
import { vendorButton, type Vendor } from './vendorTypes';
import { ID_CARD_NAMES } from '../id-card/idCardTemplates';

export function VendorSendDialog({ ids, onClose, onSent }: { ids: number[]; onClose: () => void; onSent: () => void }) {
  const [cards, setCards] = useState<PreparedCard[]>([]);
  const [index, setIndex] = useState(0);
  const [verified, setVerified] = useState<Set<number>>(new Set());
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [resend, setResend] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [outcome, setOutcome] = useState('');
  const [preview, setPreview] = useState<{ id: number; url: string } | null>(null);
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
  const key = useRef(crypto.randomUUID());
  const idsKey = ids.join(',');
  useEffect(() => {
    const controller = new AbortController();
    prepareVendorCards(idsKey.split(',').map(Number), controller.signal)
      .then(value => { if (!controller.signal.aborted) setCards(value); })
      .catch(error => { if (!controller.signal.aborted) setError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [idsKey]);
  const card = cards[index];
  const templateName = card ? ({ ...ID_CARD_NAMES, green_hr: 'Green HR' } as Record<string, string>)[String(card.details.brand)] || String(card.details.brand) : '';
  useEffect(() => {
    if (!card) return;
    const next = URL.createObjectURL(card.blob); setPreview({ id: card.id, url: next });
    return () => URL.revokeObjectURL(next);
  }, [card]);
  const url = preview?.id === card?.id ? preview?.url : undefined;
  const loaded = card?.images.every((_, i) => loadedImages.has(`${card.id}:${i}`));
  const needsResend = cards.some(card => card.delivery_status === 'sent');
  const uncertain = cards.some(card => ['sending', 'unknown'].includes(card.delivery_status || ''));
  const compatible = vendor && cards.every(card => vendor.service === 'both' || vendor.service === card.type);
  const ready = !loading && cards.length === ids.length && verified.size === cards.length && compatible
    && (!needsResend || resend) && !uncertain && !busy && !outcome;
  const send = async () => {
    if (!ready || !vendor) return;
    setBusy(true); setError('');
    try {
      const result = await request<{ id: string; status: string }>('/api/vendor-cards/send', { method: 'POST', body: {
        key: key.current, vendorId: vendor.id, vendorEmail: vendor.email, resend,
        cards: cards.map(card => ({ id: card.id, revision: card.revision, lastDeliveryId: card.delivery_id,
          verified: verified.has(card.id), pdf: card.pdf })),
      } });
      setOutcome(result.status === 'sent' ? 'Sent to vendor. Email accepted by the mail server; printing and handover are still separate.'
        : result.status === 'failed' ? 'Email failed. Close and reopen to retry after the mail configuration or recipient is corrected.'
        : 'Delivery is pending or uncertain. Ask HQ Admin to check the mail provider logs before sending again.');
      onSent();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Sending could not be confirmed');
      // The server may have sent the message even when the browser loses its response.
      setOutcome('Close and reload dispatch status before retrying. Do not send another copy blindly.'); onSent();
    } finally { setBusy(false); }
  };
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent className="flex max-h-[94dvh] w-[96vw] max-w-5xl flex-col overflow-hidden bg-white text-slate-900"
      onEscapeKeyDown={e => { if (busy) e.preventDefault(); }} onPointerDownOutside={e => e.preventDefault()}>
      <DialogTitle>Verify templates and send to vendor</DialogTitle>
      <DialogDescription>Check every card before sending. These print images are the exact images embedded in the email's PDF attachments.</DialogDescription>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading && <p className="animate-pulse rounded-lg bg-slate-100 p-6" role="status">Preparing approved card PDFs…</p>}
        {card && <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
          <section className="space-y-2">
            <p className="font-semibold">{card.ref_id} · {card.company_name}</p>
            <p className="text-sm text-slate-600">{templateName} · Quantity: {card.quantity}</p>
            <div className="h-[42dvh] min-h-[220px] space-y-3 overflow-y-auto rounded-lg border bg-slate-100 p-2" tabIndex={0} aria-label="Print preview — scroll to check both sides">
              {card.images.map((image, i) => <img key={`${card.id}:${i}`} src={image} alt={`${card.ref_id} print sheet ${i + 1}`}
                className="h-auto w-full" onLoad={() => setLoadedImages(current => new Set([...current, `${card.id}:${i}`]))} />)}
            </div>
            <a className="text-xs text-indigo-700 underline" href={url} target="_blank" rel="noopener noreferrer">Open full PDF to inspect both sides</a>
            <label className="flex items-start gap-2 rounded-lg bg-emerald-50 p-3 text-sm">
              <input type="checkbox" checked={verified.has(card.id)} disabled={!url || !loaded || busy || !!outcome}
                onChange={e => setVerified(current => { const next = new Set(current); e.target.checked ? next.add(card.id) : next.delete(card.id); return next; })} />
              Yes, I checked both sides. The template, photo, details and quantity are correct.
            </label>
            <div className="flex items-center justify-between text-sm">
              <button disabled={index === 0 || busy} onClick={() => setIndex(index - 1)}>Previous card</button>
              <span>{index + 1} / {cards.length} · {verified.size} verified</span>
              <button disabled={index === cards.length - 1 || busy} onClick={() => setIndex(index + 1)}>Next card</button>
            </div>
          </section>
          <section className="space-y-4">
            <VendorPicker value={vendor} onChange={value => { setVendor(value); setResend(false); }} disabled={busy || !!outcome} />
            {vendor && <p className="rounded-lg bg-indigo-50 p-3 text-sm">Send {cards.length} PDF(s) to <strong>{vendor.name}</strong><br />{vendor.email}</p>}
            {vendor && !compatible && <p className="text-sm text-red-700">This vendor does not support all selected card types.</p>}
            {needsResend && <label className="flex gap-2 rounded-lg bg-amber-50 p-3 text-sm">
              <input type="checkbox" checked={resend} disabled={busy || !!outcome} onChange={e => setResend(e.target.checked)} />
              Some cards were already sent. I intentionally want to resend these cards.
            </label>}
            {uncertain && <p className="text-sm text-amber-800">Previous delivery is pending or uncertain. Sending is blocked until its outcome is checked.</p>}
            <p className="text-xs text-slate-500">Maximum 10 cards / 8 MB per email. Request company names and quantities are included. No inventory prices are emailed.</p>
          </section>
        </div>}
        {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {outcome && <p role="status" className="mt-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">{outcome}</p>}
      </div>
      <div className="flex shrink-0 justify-end gap-3 border-t pt-3">
        <button disabled={busy} onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">Close</button>
        <button disabled={!ready} onClick={() => void send()} className={vendorButton}>{busy ? 'Sending…' : 'Send to vendor'}</button>
      </div>
    </DialogContent>
  </Dialog>;
}
