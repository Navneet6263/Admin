import nodemailer from 'nodemailer';

export function mailConfigured() {
  const port = Number(process.env.SMTP_PORT || 587);
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD
    && process.env.SMTP_FROM?.includes('@') && [465, 587].includes(port));
}

/** Sends a plain-text system email (OTP etc.) through the configured SMTP account. */
export async function sendSystemMail(to: string, subject: string, text: string) {
  if (!mailConfigured()) throw Object.assign(new Error('Email is not configured'), { code: 'NO_SMTP' });
  const port = Number(process.env.SMTP_PORT || 587);
  const transport = nodemailer.createTransport({ host: process.env.SMTP_HOST, port, secure: port === 465, requireTLS: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 30000, disableFileAccess: true, disableUrlAccess: true });
  await transport.sendMail({ from: { name: 'Admin @ Management', address: process.env.SMTP_FROM!.trim() }, to,
    subject: subject.replace(/[\r\n]/g, ' '), text });
}

/** Sends an OTP; without SMTP outside production it is printed to the server log for local testing. */
export async function sendOtpMail(to: string, code: string, purpose: 'login' | 'email') {
  const subject = purpose === 'login' ? `${code} is your Admin @ Management login code` : `${code} is your email verification code`;
  const text = [`Your one-time code is ${code}.`, '', 'It expires in 5 minutes. Never share it with anyone.',
    'If you did not request this, you can ignore this email.'].join('\n');
  if (!mailConfigured() && process.env.NODE_ENV !== 'production') {
    console.warn(`[DEV OTP] ${purpose} code for ${to}: ${code} (configure SMTP_* to send real emails)`);
    return;
  }
  await sendSystemMail(to, subject, text);
}
