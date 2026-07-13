import { Router } from 'express';
import * as accountsController from './accounts.controller.js';
import { requireAuth, requireRoles } from '../auth/auth.middleware.js';

const accountsRouter = Router();

// All routes require authentication
accountsRouter.use(requireAuth);

// ── Ledger Groups ─────────────────────────────────────────────────────────────
accountsRouter.get('/groups',         accountsController.listGroups);
accountsRouter.get('/groups/:id',     accountsController.getGroup);
accountsRouter.post('/groups',        requireRoles(['ADMIN']), accountsController.createGroup);
accountsRouter.put('/groups/:id',     requireRoles(['ADMIN']), accountsController.updateGroup);
accountsRouter.delete('/groups/:id',  requireRoles(['ADMIN']), accountsController.deleteGroup);

// ── Ledgers ───────────────────────────────────────────────────────────────────
accountsRouter.get('/ledgers',        accountsController.listLedgers);
accountsRouter.get('/ledgers/:id',    accountsController.getLedger);
accountsRouter.post('/ledgers',       requireRoles(['ADMIN']), accountsController.createLedger);
accountsRouter.put('/ledgers/:id',    requireRoles(['ADMIN']), accountsController.updateLedger);
accountsRouter.delete('/ledgers/:id', requireRoles(['ADMIN']), accountsController.deleteLedger);

export { accountsRouter };
