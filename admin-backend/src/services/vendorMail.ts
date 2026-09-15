import nodemailer from 'nodemailer';
import { emailValid, VendorError } from './vendorPolicy';

const templateNames: Record<string, string> = {
  vision_india: 'Vision India', green_call: 'GreenCall', green_hr: 'Green HR', talent_foundation: 'Talent Foundation',
  north_star_avantika: 'North Star - Avantika Gas', north_star_bgcl: 'North Star - BGCL',
  north_star_ioag: 'North Star - IOAG', north_star_iocl: 'North Star - IOCL',
};

export function mailSettings() {
  const from = process.env.SMTP_FROM?.trim();
  const port = Number(process.env.SMTP_PORT || 587);
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD
      || !emailValid(from) || ![465, 587].includes(port))
    throw new VendorError(503, 'Vendor email is not configured. Please contact your system administrator.');
  return { from, host: process.env.SMTP_HOST, port, secure: port === 465,
    requireTLS: true, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 30000,
    disableFileAccess: true, disableUrlAccess: true };
}

export async function sendVendorMail(id: string, vendor: any, cards: any[], attachments: Buffer[]) {
  const { from, ...options } = mailSettings();
  const transport = nodemailer.createTransport(options);
  const companyNames = [...new Set(cards.map(card => String(card.company_name)))];
  const text = [
    `Hello ${vendor.name},`, '', 'Please print the following approved cards using the attached PDFs.',
    'Both sides are included in each PDF. Please confirm print size and proof before production.', '',
    ...cards.map((card, i) => `${i + 1}. ${card.company_name} | ${card.ref_id} | ${card.type === 'id_card' ? 'ID Card' : 'Visiting Card'}\n`
      + `Template: ${templateNames[card.details.brand] || card.details.brand} | Quantity: ${card.quantity}\nAttachment: ${card.ref_id}.pdf`),
    '', `Dispatch reference: ${id}`, 'Sent through RequestHub. This email does not confirm employee handover.',
  ].join('\n');
  const result = await transport.sendMail({
    from: { name: 'RequestHub', address: from }, to: { name: vendor.name, address: vendor.email },
    subject: `Approved cards - ${companyNames.join(' / ').replace(/[\r\n]/g, ' ').slice(0, 120)} (${cards.length})`,
    messageId: `<${id}@${from.split('@')[1]}>`, text,
    attachments: cards.map((card, index) => ({ filename: `${String(card.ref_id).replace(/[^a-z0-9-]/gi, '-')}.pdf`,
      content: attachments[index], contentType: 'application/pdf' })),
  });
  if (!result.accepted.length || result.rejected.length) throw Object.assign(new Error('Recipient rejected'), { code: 'EENVELOPE' });
  return result.messageId;
}

// A connection lost after DATA may still have delivered mail. Never auto-retry it.
export function deliveryFailure(error: any): 'failed' | 'unknown' {
  return ['EAUTH', 'EENVELOPE', 'EDNS', 'ECONNECTION'].includes(error?.code)
    || (Number(error?.responseCode) >= 400 && Number(error?.responseCode) <= 599) ? 'failed' : 'unknown';
}
