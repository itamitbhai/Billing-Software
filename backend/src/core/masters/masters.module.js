import { Router } from 'express';
import * as mastersController from './masters.controller.js';
import { requireAuth, requireRoles } from '../auth/auth.middleware.js';

const mastersRouter = Router();
mastersRouter.use(requireAuth);

// Day-to-day master data entry (parties/products/batches/cost centres) is core
// accountant work — only company-wide sync is reserved for Admin.
const WRITE = requireRoles(['ADMIN', 'ACCOUNTANT']);
const ADMIN = requireRoles(['ADMIN']);

// ── Parties ───────────────────────────────────────────────────────────────────
mastersRouter.get('/parties',               mastersController.listParties);
mastersRouter.get('/parties/:id',           mastersController.getParty);
mastersRouter.post('/parties',         WRITE, mastersController.createParty);
mastersRouter.put('/parties/:id',      WRITE, mastersController.updateParty);
mastersRouter.delete('/parties/:id',   WRITE, mastersController.deleteParty);

// ── Products ──────────────────────────────────────────────────────────────────
mastersRouter.get('/products',              mastersController.listProducts);
mastersRouter.get('/products/:id',          mastersController.getProduct);
mastersRouter.post('/products',        WRITE, mastersController.createProduct);
mastersRouter.put('/products/:id',     WRITE, mastersController.updateProduct);
mastersRouter.delete('/products/:id',  WRITE, mastersController.deleteProduct);

mastersRouter.get('/stock-items',              mastersController.listProducts);
mastersRouter.get('/stock-items/:id',          mastersController.getProduct);
mastersRouter.post('/stock-items',        WRITE, mastersController.createProduct);
mastersRouter.put('/stock-items/:id',     WRITE, mastersController.updateProduct);
mastersRouter.delete('/stock-items/:id',  WRITE, mastersController.deleteProduct);

// ── Batches ───────────────────────────────────────────────────────────────────
mastersRouter.get('/batches',               mastersController.listBatches);
mastersRouter.get('/batches/:id',           mastersController.getBatch);
mastersRouter.post('/batches',         WRITE, mastersController.createBatch);
mastersRouter.put('/batches/:id',      WRITE, mastersController.updateBatch);
mastersRouter.delete('/batches/:id',   WRITE, mastersController.deleteBatch);

// ── Cost Centres ──────────────────────────────────────────────────────────────
mastersRouter.get('/cost-centres',              mastersController.listCostCentres);
mastersRouter.post('/cost-centres',        WRITE, mastersController.createCostCentre);
mastersRouter.put('/cost-centres/:id',     WRITE, mastersController.updateCostCentre);
mastersRouter.delete('/cost-centres/:id',  WRITE, mastersController.deleteCostCentre);

// ── Integration Sync ──────────────────────────────────────────────────────────
mastersRouter.post('/sync',            ADMIN, mastersController.syncMasters);

export { mastersRouter };
