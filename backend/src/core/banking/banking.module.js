import { Router } from 'express';
import * as bankingController from './banking.controller.js';
import { requireAuth, requireRoles } from '../auth/auth.middleware.js';

const bankingRouter = Router();
bankingRouter.use(requireAuth);

const ADMIN = requireRoles(['ADMIN']);

// Bank Accounts
bankingRouter.get('/accounts',           bankingController.listBankAccounts);
bankingRouter.get('/accounts/:id',       bankingController.getBankAccount);
bankingRouter.post('/accounts',    ADMIN, bankingController.createBankAccount);
bankingRouter.put('/accounts/:id', ADMIN, bankingController.updateBankAccount);

// Bank Statement (date-filterable)
bankingRouter.get('/accounts/:id/statement', bankingController.getBankStatement);

// Reconciliation
bankingRouter.get('/accounts/:id/reconciliation',  bankingController.getPendingReconciliation);
bankingRouter.post('/accounts/:id/reconciliation', bankingController.reconcileEntry);

// Cheque Register
bankingRouter.get('/cheques', bankingController.getChequeRegister);

export { bankingRouter };
