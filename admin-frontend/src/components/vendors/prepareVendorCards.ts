import { request } from '@/lib/api';
import { createIdCardPrint } from '../id-card/idCardPdf';
import { isIdCardBrand } from '../id-card/idCardTemplates';
import type { IdCardDetails } from '../id-card/visionIndiaIdCard';
import { createBusinessCardPrint } from '../business-card/businessCardPdf';
import type { BusinessCardDetails } from '../business-card/businessCardTemplates';
import type { VendorCard } from './vendorTypes';

export type PreparedCard = VendorCard & { blob: Blob; pdf: string; images: string[] };
function dataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('PDF could not be prepared'));
    reader.readAsDataURL(blob);
  });
}
export async function prepareVendorCards(ids: number[], signal: AbortSignal) {
  const cards: PreparedCard[] = [];
  let size = 0;
  for (const id of ids) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    const card = await request<VendorCard>(`/api/vendor-cards/${id}`, { signal });
    const brand = card.details?.brand;
    if (card.type === 'id_card' ? !isIdCardBrand(brand)
      : !['vision_india', 'green_call', 'green_hr', 'talent_foundation'].includes(String(brand)))
      throw new Error(`${card.ref_id}: printable template is unavailable`);
    const print = card.type === 'id_card'
      ? await createIdCardPrint(card.details as unknown as IdCardDetails)
      : await createBusinessCardPrint(card.details as unknown as BusinessCardDetails);
    const blob = print.pdf;
    size += blob.size;
    if (size > 8 * 1024 * 1024) throw new Error('PDFs exceed 8 MB. Please select fewer cards.');
    const pdf = (await dataUrl(blob)).split(',')[1];
    const images = await Promise.all(print.images.map(dataUrl));
    cards.push({ ...card, blob, pdf, images });
  }
  return cards;
}
