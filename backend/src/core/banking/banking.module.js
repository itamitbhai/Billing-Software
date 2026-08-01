import { Router } from 'express';
import * as bankingController from './banking.controller.js';
import { requireAuth, requireRoles } from '../auth/auth.middleware.js';

const bankingRouter = Router();
bankingRouter.use(requireAuth);

// Managing payments/receipts and bank reconciliation is core accountant work.
const WRITE = requireRoles(['ADMIN', 'ACCOUNTANT']);

// Bank Accounts
bankingRouter.get('/accounts',           bankingController.listBankAccounts);
bankingRouter.get('/accounts/:id',       bankingController.getBankAccount);
bankingRouter.post('/accounts',    WRITE, bankingController.createBankAccount);
bankingRouter.put('/accounts/:id', WRITE, bankingController.updateBankAccount);

// Bank Statement (date-filterable)
bankingRouter.get('/accounts/:id/statement', bankingController.getBankStatement);

// Reconciliation
bankingRouter.get('/accounts/:id/reconciliation',  bankingController.getPendingReconciliation);
bankingRouter.post('/accounts/:id/reconciliation', bankingController.reconcileEntry);

// Cheque Register
bankingRouter.get('/cheques', bankingController.getChequeRegister);

export { bankingRouter };
