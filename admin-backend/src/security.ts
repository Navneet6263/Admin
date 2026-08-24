import type { CorsOptions } from 'cors';
import type { NextFunction, Request, Response } from 'express';

const production = process.env.NODE_ENV === 'production';
const configuredOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);
const developmentOrigins = [
  'http://localhost:3000',
  'http://localhost:3004',
  'http://localhost:5173',
  'http://localhost:8080',
];

if (production && configuredOrigins.length === 0) {
  throw new Error('CORS_ORIGIN is required in production');
}
for (const origin of configuredOrigins) {
  let parsed: URL;
  try { parsed = new URL(origin); }
  catch { throw new Error(`Invalid CORS_ORIGIN value: ${origin}`); }
  if (parsed.origin !== origin || !['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`CORS_ORIGIN must contain exact HTTP(S) origins only: ${origin}`);
  }
}

export const allowedOrigins = new Set(
  production ? configuredOrigins : [...configuredOrigins, ...developmentOrigins],
);

export const corsOptions: CorsOptions = {
  credentials: true,
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin.replace(/\/+$/, ''))) {
      callback(null, true);
      return;
    }
    callback(null, false);
  },
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600,
};

export function enforceTrustedOrigin(req: Request, res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('Sec-Fetch-Site') === 'cross-site') {
    return res.status(403).json({ error: 'Cross-site request blocked' });
  }
  const origin = req.get('Origin')?.replace(/\/+$/, '');
  if (origin && !allowedOrigins.has(origin)) {
    return res.status(403).json({ error: 'Untrusted request origin' });
  }
  next();
}

type Attempt = { count: number; resetAt: number };
const attempts = new Map<string, Attempt>();
const windowMs = 15 * 60_000;
const maxAttempts = 10;
const clientKey = (req: Request) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : 'unknown';
  return `${ip}:${email}`;
};

export function loginRateLimit(req: Request, res: Response, next: NextFunction) {
  const key = clientKey(req);
  const now = Date.now();
  const current = attempts.get(key);
  const attempt = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + windowMs }
    : current;
  attempt.count += 1;
  attempts.set(key, attempt);
  res.setHeader('X-RateLimit-Limit', String(maxAttempts));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, maxAttempts - attempt.count)));
  if (attempt.count > maxAttempts) {
    res.setHeader('Retry-After', String(Math.ceil((attempt.resetAt - now) / 1000)));
    return res.status(429).json({ error: 'Too many login attempts. Please try again later.' });
  }
  next();
}

export function resetLoginRateLimit(req: Request) {
  attempts.delete(clientKey(req));
}

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of attempts) if (value.resetAt <= now) attempts.delete(key);
}, windowMs).unref();
