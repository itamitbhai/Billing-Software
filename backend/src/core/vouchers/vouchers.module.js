import { Router } from 'express';
import * as vouchersController from './vouchers.controller.js';
import { requireAuth, requireRoles } from '../auth/auth.middleware.js';

const vouchersRouter = Router();
vouchersRouter.use(requireAuth);

// GET  /api/v1/vouchers          — list with filters (type, date range, party, page)
// POST /api/v1/vouchers          — create manual voucher (ADMIN/ACCOUNTANT — Journal/Contra/Credit-Debit Notes)
// GET  /api/v1/vouchers/:id      — get full voucher detail
// PUT  /api/v1/vouchers/:id      — amend voucher (ADMIN/ACCOUNTANT — correcting mistakes before final posting)
// DELETE /api/v1/vouchers/:id    — soft-delete / cancel voucher (ADMIN/ACCOUNTANT)

const WRITE = requireRoles(['ADMIN', 'ACCOUNTANT']);

vouchersRouter.get('/',    vouchersController.listVouchers);
vouchersRouter.post('/',   WRITE, vouchersController.createVoucher);
vouchersRouter.get('/:id', vouchersController.getVoucher);
vouchersRouter.put('/:id', WRITE, vouchersController.updateVoucher);
vouchersRouter.delete('/:id', WRITE, vouchersController.deleteVoucher);

export { vouchersRouter };
