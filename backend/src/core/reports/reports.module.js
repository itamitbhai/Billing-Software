import { Router } from 'express';
import * as reportsController from './reports.controller.js';
import { requireAuth } from '../auth/auth.middleware.js';

const reportsRouter = Router();
reportsRouter.use(requireAuth);

// All reports are read-only — available to all authenticated users
reportsRouter.get('/balance-sheet',            reportsController.getBalanceSheet);        // ?asOfDate=2024-03-31
reportsRouter.get('/profit-loss',              reportsController.getProfitLoss);           // ?startDate=&endDate=
reportsRouter.get('/stock-summary',            reportsController.getStockSummary);         // ?asOfDate=
reportsRouter.get('/day-book',                 reportsController.getDayBook);              // ?date=2024-01-15
reportsRouter.get('/trial-balance',            reportsController.getTrialBalance);         // ?asOfDate=
reportsRouter.get('/outstanding/receivables',  reportsController.getOutstandingReceivables); // ?asOfDate=
reportsRouter.get('/outstanding/payables',     reportsController.getOutstandingPayables);    // ?asOfDate=
reportsRouter.get('/cash-flow',                reportsController.getCashFlow);             // ?startDate=&endDate=
reportsRouter.get('/ledger/:ledgerId',         reportsController.getLedgerStatement);      // ?startDate=&endDate=

export { reportsRouter };
