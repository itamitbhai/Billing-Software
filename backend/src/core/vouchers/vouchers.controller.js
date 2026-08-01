import * as vouchersService from './vouchers.service.js';
import { logAudit } from '../../shared/utils/audit-log.js';

const MANUAL_TYPES = ['CONTRA', 'JOURNAL', 'CREDIT_NOTE', 'DEBIT_NOTE'];

export async function listVouchers(req, res, next) {
  try {
    const { type, startDate, endDate, page, limit } = req.query;
    const result = await vouchersService.listVouchers({
      companyId: req.user.companyId, type, startDate, endDate, page, limit,
    });
    res.json({ success: true, count: result.data.length, ...result });
  } catch (err) { next(err); }
}

export async function getVoucher(req, res, next) {
  try {
    const voucher = await vouchersService.getVoucher(req.user.companyId, req.params.id);
    res.json({ success: true, data: voucher });
  } catch (err) { next(err); }
}

export async function createVoucher(req, res, next) {
  try {
    const { type, lines } = req.body;
    if (!type || !MANUAL_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `"type" must be one of: ${MANUAL_TYPES.join(', ')}. SALES/PURCHASE/RECEIPT/PAYMENT vouchers are created automatically via the billing module.`,
      });
    }
    if (!Array.isArray(lines) || lines.length < 2) {
      return res.status(400).json({ success: false, message: 'Provide at least 2 voucher lines.' });
    }
    for (const line of lines) {
      if (!line.ledgerId || !line.type || line.amount === undefined) {
        return res.status(400).json({ success: false, message: 'Each line must have ledgerId, type (DEBIT/CREDIT), and amount.' });
      }
    }
    const voucher = await vouchersService.createVoucher(req.user.companyId, req.body, req.user.id);
    await logAudit({
      companyId: req.user.companyId, userId: req.user.id, action: 'VOUCHER_CREATE',
      entityType: 'Voucher', entityId: voucher.id, metadata: { type: voucher.type, voucherNumber: voucher.voucherNumber }, req,
    });
    res.status(201).json({ success: true, message: `${type} voucher created successfully.`, data: voucher });
  } catch (err) { next(err); }
}

export async function updateVoucher(req, res, next) {
  try {
    const voucher = await vouchersService.updateVoucher(req.user.companyId, req.params.id, req.body);
    await logAudit({
      companyId: req.user.companyId, userId: req.user.id, action: 'VOUCHER_UPDATE',
      entityType: 'Voucher', entityId: voucher.id, metadata: { voucherNumber: voucher.voucherNumber }, req,
    });
    res.json({ success: true, message: 'Voucher updated.', data: voucher });
  } catch (err) { next(err); }
}

export async function deleteVoucher(req, res, next) {
  try {
    const result = await vouchersService.deleteVoucher(req.user.companyId, req.params.id, req.user.id);
    await logAudit({
      companyId: req.user.companyId, userId: req.user.id, action: 'VOUCHER_CANCEL',
      entityType: 'Voucher', entityId: req.params.id, req,
    });
    res.json({ success: true, message: `Voucher cancelled successfully.`, data: result });
  } catch (err) { next(err); }
}
