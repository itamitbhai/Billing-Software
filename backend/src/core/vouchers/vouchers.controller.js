import * as vouchersService from './vouchers.service.js';

export async function listVouchers(req, res, next) {
  try {
    const { type, startDate, endDate, page, limit } = req.query;
    const result = await vouchersService.listVouchers({
      type, startDate, endDate, page, limit,
    });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

export async function getVoucher(req, res, next) {
  try {
    const voucher = await vouchersService.getVoucher(req.params.id);
    res.json({ success: true, data: voucher });
  } catch (err) { next(err); }
}

export async function createVoucher(req, res, next) {
  try {
    const { type, lines } = req.body;
    const VALID_TYPES = ['SALES', 'PURCHASE', 'RECEIPT', 'PAYMENT', 'CONTRA', 'JOURNAL', 'CREDIT_NOTE', 'DEBIT_NOTE'];
    if (!type || !VALID_TYPES.includes(type)) {
      return res.status(400).json({ success: false, message: `"type" must be one of: ${VALID_TYPES.join(', ')}.` });
    }
    if (!Array.isArray(lines) || lines.length < 2) {
      return res.status(400).json({ success: false, message: 'Provide at least 2 voucher lines.' });
    }
    for (const line of lines) {
      if (!line.ledgerId || !line.type || line.amount === undefined) {
        return res.status(400).json({ success: false, message: 'Each line must have ledgerId, type (DEBIT/CREDIT), and amount.' });
      }
    }
    const voucher = await vouchersService.createVoucher(req.body);
    res.status(201).json({ success: true, message: `${type} voucher created successfully.`, data: voucher });
  } catch (err) { next(err); }
}

export async function updateVoucher(req, res, next) {
  try {
    const voucher = await vouchersService.updateVoucher(req.params.id, req.body);
    res.json({ success: true, message: 'Voucher updated.', data: voucher });
  } catch (err) { next(err); }
}

export async function deleteVoucher(req, res, next) {
  try {
    const result = await vouchersService.deleteVoucher(req.params.id);
    res.json({ success: true, message: `Voucher deleted successfully.`, data: result });
  } catch (err) { next(err); }
}
