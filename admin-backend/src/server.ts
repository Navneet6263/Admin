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

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') ?? true }));
app.use(express.json({ limit: '10mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/requests', requireAuth('employee', 'admin', 'finance', 'verifier', 'super_admin'), requestRoutes);
app.use('/api/inventory', requireAuth('admin', 'super_admin'), inventoryRoutes);
app.use('/api/admin',       requireAuth('admin', 'finance'), adminRoutes);
app.use('/api/employee',    requireAuth('employee'), employeeRoutes);
app.use('/api/verifier',    requireAuth('verifier'), verifierRoutes);
app.use('/api/super-admin', requireAuth('super_admin'), superAdminRoutes);

app.get('/health', (_req, res) =>
  res.json({ status: dbConnected ? 'connected' : 'disconnected', uptime: process.uptime() })
);

const PORT = process.env.PORT || 3001;

connectDB().then(() =>
  app.listen(PORT, () => console.log(`🚀 Backend running on port ${PORT}`))
);
