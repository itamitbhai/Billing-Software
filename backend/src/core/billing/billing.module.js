import { Router } from 'express';
import * as billingController from './billing.controller.js';
import { requireAuth } from '../auth/auth.middleware.js';

const billingRouter = Router();

// Apply auth middleware to all billing endpoints
billingRouter.use(requireAuth);

// Purchases
billingRouter.get('/purchases',     billingController.listPurchases);
billingRouter.get('/purchases/:id', billingController.getPurchase);
billingRouter.post('/purchases',    billingController.createPurchase);

// Sales
billingRouter.get('/sales',         billingController.listSales);
billingRouter.get('/sales/last',    billingController.getLastSale);
billingRouter.get('/sales/:id',     billingController.getSale);
billingRouter.post('/sales',        billingController.createSale);

// Payments
billingRouter.get('/payments',      billingController.listPayments);
billingRouter.get('/payments/:id',  billingController.getPayment);
billingRouter.post('/payments',     billingController.createPayment);

export { billingRouter };
