import { Router } from "express";
import { clearSessionCookie, createSession, login, requireAuth, revokeSession, setSessionCookie } from "../auth";
import { loginRateLimit, resetLoginRateLimit } from "../security";

const router = Router();
router.post("/login", loginRateLimit, async (req, res) => {
  const { email, password } = req.body ?? {};
  res.setHeader('Cache-Control', 'no-store');
  if (typeof email !== "string" || typeof password !== "string"
    || email.length > 254 || password.length > 256)
    return res.status(400).json({ error: "Email and password are required" });
  try {
    const user = await login(email, password);
    if (!user) return res.status(401).json({ error: "Invalid email or password" });
    setSessionCookie(res, await createSession(user.id));
    resetLoginRateLimit(req);
    res.json({ user });
  } catch (error) {
    console.error(error); res.status(500).json({ error: "Login unavailable" });
  }
});

router.post("/register", (_req, res) => {
  res.status(403).json({ error: "Self-registration is disabled. Contact an administrator." });
});

router.post('/logout', async (req, res) => {
  try { await revokeSession(req); }
  catch (error) { console.error('Session revocation failed:', error); }
  finally { clearSessionCookie(res); }
  res.setHeader('Cache-Control', 'no-store');
  res.json({ success: true });
});

router.get("/me", requireAuth(), (req, res) => res.json(req.user));
export default router;
