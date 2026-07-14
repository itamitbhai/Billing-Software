import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Auth
import { authRouter } from '../src/core/auth/auth.module.js';
// B2B Medical Distribution Billing Modules
import { mastersRouter }   from '../src/core/masters/masters.module.js';
import { billingRouter }   from '../src/core/billing/billing.module.js';
import { utilitiesRouter } from '../src/core/utilities/utilities.module.js';
import { accountsRouter }  from '../src/core/accounts/accounts.module.js';
import { vouchersRouter }  from '../src/core/vouchers/vouchers.module.js';
import { reportsRouter }   from '../src/core/reports/reports.module.js';
import { bankingRouter }   from '../src/core/banking/banking.module.js';
// Shared
import { errorMiddleware } from '../src/shared/middleware/error.middleware.js';

dotenv.config();

const app  = express();
const port = process.env.API_PORT || 3001;

// ── Core Middlewares ──────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Health Check ──────────────────────────────────────────────────────────────
app.get('/api/v1/health', (req, res) => {
  res.status(200).json({
    success:   true,
    status:    'OK',
    message:   'VS Arogya Meda Billing API is online and healthy.',
    timestamp: new Date().toISOString(),
    modules: [
      'auth', 'masters', 'billing', 'utilities', 'accounts', 'vouchers', 'reports', 'banking'
    ],
  });
});

// ── API Route Map ─────────────────────────────────────────────────────────────
app.use('/api/v1/auth',       authRouter);
app.use('/api/v1/masters',    mastersRouter);     // Parties, Products, Batches
app.use('/api/v1/billing',    billingRouter);     // Sales, Purchases, Payments
app.use('/api/v1/utilities',  utilitiesRouter);   // Company Profile settings, Dashboard stats
app.use('/api/v1/accounts',   accountsRouter);    // Chart of Accounts (Groups & Ledgers)
app.use('/api/v1/vouchers',   vouchersRouter);    // Double Entry Vouchers
app.use('/api/v1/reports',    reportsRouter);     // Balance Sheet, P&L, Trial Balance, Day Book
app.use('/api/v1/banking',    bankingRouter);     // Bank Accounts & Reconciliation

// ── 404 Handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
});

// ── Global Error Handler ──────────────────────────────────────────────────────
app.use(errorMiddleware);

app.listen(port, () => {
  console.log(`\n🚀  Billing API running at:  http://localhost:${port}/api/v1`);
  console.log(`❤️  Health check:             http://localhost:${port}/api/v1/health`);
  console.log(`\n📋  Available Modules:`);
  console.log(`    ├── Auth            → /api/v1/auth`);
  console.log(`    ├── Masters         → /api/v1/masters     (Parties, Products, Batches)`);
  console.log(`    ├── Billing         → /api/v1/billing     (Sales, Purchases, Payments)`);
  console.log(`    ├── Accounts        → /api/v1/accounts    (Groups & Ledgers)`);
  console.log(`    ├── Vouchers        → /api/v1/vouchers    (Double Entry)`);
  console.log(`    ├── Reports         → /api/v1/reports     (Balance Sheet, P&L, Trial Balance)`);
  console.log(`    ├── Banking         → /api/v1/banking     (Bank Accounts & Reconciliation)`);
  console.log(`    └── Utilities       → /api/v1/utilities   (Company settings, Dashboard stats)\n`);
});
