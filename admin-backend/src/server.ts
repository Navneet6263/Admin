import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { connectDB, dbConnected } from './db';
import adminRoutes      from './routes/admin';
import employeeRoutes   from './routes/employee';
import verifierRoutes   from './routes/verifier';
import superAdminRoutes from './routes/super-admin';
import authRoutes       from './routes/auth';
import { ensureBootstrapSuperAdmin, requireAuth } from './auth';
import requestRoutes    from './routes/requests';
import inventoryRoutes  from './routes/inventory';
import usersRoutes      from './routes/users';
import teamsRoutes      from './routes/teams';
import companiesRoutes    from './routes/companies';
import centersRoutes      from './routes/centers';
import centerAdminRoutes  from './routes/centerAdmin';
import dashboardRoutes    from './routes/dashboard';
import workflowRoutes     from './routes/workflow';
import policyRoutes       from './routes/policies';
import paymentRoutes      from './routes/payments';
import notificationRoutes from './routes/notifications';
import centerAdminInsightsRoutes from './routes/centerAdminInsights';
import financeInsightsRoutes from './routes/financeInsights';
import { createPaymentReminders } from './services/notifications';
import { corsOptions, enforceTrustedOrigin } from './security';

const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  enforceTrustedOrigin(req, res, next);
});

app.use('/api/auth', authRoutes);
app.use('/api/teams',          requireAuth(), teamsRoutes);
app.use('/api/companies',      requireAuth(), companiesRoutes);
app.use('/api/centers',        requireAuth(), centersRoutes);
app.use('/api/notifications',  requireAuth(), notificationRoutes);
app.use('/api/workflow',       requireAuth('center_admin','hq_admin','admin','super_admin'), workflowRoutes);
app.use('/api/payments',       financeInsightsRoutes);
app.use('/api/payments',       requireAuth('center_admin','hq_admin','admin','finance','finance_head','super_admin'), paymentRoutes);
app.use('/api/super-admin/policies', requireAuth('super_admin'), policyRoutes);
app.use('/api/center-admin',   requireAuth('center_admin', 'super_admin'), centerAdminInsightsRoutes);
app.use('/api/center-admin',   requireAuth('center_admin', 'super_admin'), centerAdminRoutes);
app.use('/api/dashboard',      requireAuth('hq_admin', 'admin', 'super_admin'), dashboardRoutes);
app.use('/api/requests',       requireAuth('employee', 'hq_admin', 'admin', 'super_admin'), requestRoutes);
app.use('/api/inventory',      requireAuth('employee', 'hq_admin', 'admin', 'center_admin', 'verifier', 'finance', 'finance_head', 'super_admin'), inventoryRoutes);
app.use('/api/admin/users',    requireAuth('hq_admin', 'admin'), usersRoutes);
app.use('/api/admin',          requireAuth('hq_admin', 'admin'), adminRoutes);
app.use('/api/employee',       requireAuth('employee'), employeeRoutes);
app.use('/api/verifier',       requireAuth('verifier'), verifierRoutes);
app.use('/api/super-admin/users', requireAuth('super_admin'), usersRoutes);
app.use('/api/super-admin',    requireAuth('super_admin'), superAdminRoutes);
app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found' }));

app.get('/health', (_req, res) =>
  res.json({ status: dbConnected ? 'connected' : 'disconnected', uptime: process.uptime() })
);

const PORT = Number(process.env.PORT) || 3001;

app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));

void connectDB().then(async (connected) => {
  if (!connected) return;
  try { await ensureBootstrapSuperAdmin(); }
  catch (error) { console.error('Super Admin bootstrap failed:', error); }
  void createPaymentReminders().catch(console.error);
  setInterval(() => void createPaymentReminders().catch(console.error), 60_000).unref();
});
