import { Router } from 'express';
import * as mastersController from './masters.controller.js';
import { requireAuth, requireRoles } from '../auth/auth.middleware.js';

const mastersRouter = Router();
mastersRouter.use(requireAuth);

const ADMIN = requireRoles(['ADMIN']);

// ── Parties ───────────────────────────────────────────────────────────────────
mastersRouter.get('/parties',               mastersController.listParties);
mastersRouter.get('/parties/:id',           mastersController.getParty);
mastersRouter.post('/parties',         ADMIN, mastersController.createParty);
mastersRouter.put('/parties/:id',      ADMIN, mastersController.updateParty);
mastersRouter.delete('/parties/:id',   ADMIN, mastersController.deleteParty);

// ── Products ──────────────────────────────────────────────────────────────────
mastersRouter.get('/products',              mastersController.listProducts);
mastersRouter.get('/products/:id',          mastersController.getProduct);
mastersRouter.post('/products',        ADMIN, mastersController.createProduct);
mastersRouter.put('/products/:id',     ADMIN, mastersController.updateProduct);
mastersRouter.delete('/products/:id',  ADMIN, mastersController.deleteProduct);

mastersRouter.get('/stock-items',              mastersController.listProducts);
mastersRouter.get('/stock-items/:id',          mastersController.getProduct);
mastersRouter.post('/stock-items',        ADMIN, mastersController.createProduct);
mastersRouter.put('/stock-items/:id',     ADMIN, mastersController.updateProduct);
mastersRouter.delete('/stock-items/:id',  ADMIN, mastersController.deleteProduct);

// ── Batches ───────────────────────────────────────────────────────────────────
mastersRouter.get('/batches',               mastersController.listBatches);
mastersRouter.get('/batches/:id',           mastersController.getBatch);
mastersRouter.post('/batches',         ADMIN, mastersController.createBatch);
mastersRouter.put('/batches/:id',      ADMIN, mastersController.updateBatch);
mastersRouter.delete('/batches/:id',   ADMIN, mastersController.deleteBatch);

// ── Integration Sync ──────────────────────────────────────────────────────────
mastersRouter.post('/sync',            ADMIN, mastersController.syncMasters);

export { mastersRouter };
