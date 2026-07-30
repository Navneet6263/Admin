import { Router } from 'express';
import { createToken, login, requireAuth } from '../auth';

const router = Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string') return res.status(400).json({ error: 'Email and password are required' });
  try {
    const user = await login(email, password);
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });
    res.json({ token: createToken(user), user });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Login unavailable' }); }
});

router.get('/me', requireAuth(), (req, res) => res.json(req.user));
export default router;
