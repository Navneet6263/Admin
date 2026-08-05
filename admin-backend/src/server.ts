import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { connectDB, dbConnected } from './db';
import adminRoutes      from './routes/admin';
import employeeRoutes   from './routes/employee';
import verifierRoutes   from './routes/verifier';
import superAdminRoutes from './routes/super-admin';
import authRoutes       from './routes/auth';
import { requireAuth } from './auth';
import requestRoutes    from './routes/requests';
import inventoryRoutes  from './routes/inventory';
import usersRoutes      from './routes/users';
import teamsRoutes      from './routes/teams';
import companiesRoutes    from './routes/companies';
import centersRoutes      from './routes/centers';
import centerAdminRoutes  from './routes/centerAdmin';
import dashboardRoutes    from './routes/dashboard';

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') ?? true }));
app.use(express.json({ limit: '10mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/teams', teamsRoutes);
app.use('/api/companies', companiesRoutes);
app.use('/api/centers',        centersRoutes);
app.use('/api/center-admin',   requireAuth('admin', 'super_admin'), centerAdminRoutes);
app.use('/api/dashboard',      requireAuth('admin', 'super_admin'), dashboardRoutes);
app.use('/api/requests',       requireAuth('employee', 'admin', 'finance', 'verifier', 'super_admin'), requestRoutes);
app.use('/api/inventory',      requireAuth('employee', 'admin', 'verifier', 'finance', 'super_admin'), inventoryRoutes);
app.use('/api/admin',          requireAuth('admin', 'finance'), adminRoutes);
app.use('/api/employee',       requireAuth('employee'), employeeRoutes);
app.use('/api/verifier',       requireAuth('verifier'), verifierRoutes);
app.use('/api/super-admin/users', requireAuth('super_admin'), usersRoutes);
app.use('/api/super-admin',    requireAuth('super_admin'), superAdminRoutes);

app.get('/health', (_req, res) =>
  res.json({ status: dbConnected ? 'connected' : 'disconnected', uptime: process.uptime() })
);

const PORT = 3001;

connectDB().then(() =>
  app.listen(PORT, () => console.log(`🚀 Backend running on port ${PORT}`))
);
