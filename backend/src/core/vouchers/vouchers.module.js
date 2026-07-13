import { Router } from 'express';
import * as vouchersController from './vouchers.controller.js';
import { requireAuth, requireRoles } from '../auth/auth.middleware.js';

const vouchersRouter = Router();
vouchersRouter.use(requireAuth);

// GET  /api/v1/vouchers          — list with filters (type, date range, party, page)
// POST /api/v1/vouchers          — create voucher (any authenticated user)
// GET  /api/v1/vouchers/:id      — get full voucher detail
// PUT  /api/v1/vouchers/:id      — amend voucher (any authenticated user)
// DELETE /api/v1/vouchers/:id    — soft-delete / cancel voucher (ADMIN only)

vouchersRouter.get('/',    vouchersController.listVouchers);
vouchersRouter.post('/',   vouchersController.createVoucher);
vouchersRouter.get('/:id', vouchersController.getVoucher);
vouchersRouter.put('/:id', vouchersController.updateVoucher);
vouchersRouter.delete('/:id', requireRoles(['ADMIN']), vouchersController.deleteVoucher);

export { vouchersRouter };
