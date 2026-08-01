import { Router } from 'express';
import * as accountsController from './accounts.controller.js';
import { requireAuth, requireRoles } from '../auth/auth.middleware.js';

const accountsRouter = Router();

// All routes require authentication
accountsRouter.use(requireAuth);

// "Manage Ledger" is core accountant work — Admin and Accountant can both
// maintain the chart of accounts; only Staff is read-only here.
const WRITE = requireRoles(['ADMIN', 'ACCOUNTANT']);

// ── Ledger Groups ─────────────────────────────────────────────────────────────
accountsRouter.get('/groups',         accountsController.listGroups);
accountsRouter.get('/groups/:id',     accountsController.getGroup);
accountsRouter.post('/groups',        WRITE, accountsController.createGroup);
accountsRouter.put('/groups/:id',     WRITE, accountsController.updateGroup);
accountsRouter.delete('/groups/:id',  WRITE, accountsController.deleteGroup);

// ── Ledgers ───────────────────────────────────────────────────────────────────
accountsRouter.get('/ledgers',        accountsController.listLedgers);
accountsRouter.get('/ledgers/:id',    accountsController.getLedger);
accountsRouter.post('/ledgers',       WRITE, accountsController.createLedger);
accountsRouter.put('/ledgers/:id',    WRITE, accountsController.updateLedger);
accountsRouter.delete('/ledgers/:id', WRITE, accountsController.deleteLedger);

export { accountsRouter };
