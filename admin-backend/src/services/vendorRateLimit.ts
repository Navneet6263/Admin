import type { RequestHandler } from 'express';

const attempts = new Map<number, { count: number; until: number }>();
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
}, 60000).unref();

export const vendorSendRateLimit: RequestHandler = (req, res, next) => {
  if (req.method !== 'POST') return next();
  const now = Date.now(), id = req.user!.id;
  const previous = attempts.get(id);
  const current = previous && previous.until > now ? previous : { count: 0, until: now + 60000 };
  attempts.set(id, current);
  if (++current.count > 5) {
    res.setHeader('Retry-After', String(Math.ceil((current.until - now) / 1000)));
    res.status(429).json({ error: 'Too many email attempts. Please wait one minute before trying again.' }); return;
  }
  next();
};
