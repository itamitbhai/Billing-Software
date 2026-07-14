import * as billingService from './billing.service.js';

const SUPPLY_TYPES = ['TAXABLE', 'ZERO_RATED_EXPORT', 'ZERO_RATED_SEZ', 'EXEMPT', 'NIL_RATED', 'NON_GST'];

// ============================================
// PURCHASES
// ============================================

export async function createPurchase(req, res, next) {
  try {
    const { supplierId, billNumber, purchaseDate, items } = req.body;
    if (!supplierId || !billNumber || !purchaseDate || !items || !items.length) {
      return res.status(400).json({
        success: false,
        message: 'supplierId, billNumber, purchaseDate, and items (with at least one item) are required.',
      });
    }

    const purchase = await billingService.createPurchase(req.user.companyId, req.body, req.user.id);
    res.status(201).json({
      success: true,
      message: 'Purchase recorded successfully and batch stocks updated.',
      data: purchase,
    });
  } catch (err) { next(err); }
}

export async function listPurchases(req, res, next) {
  try {
    const { page, limit } = req.query;
    const result = await billingService.listPurchases({ companyId: req.user.companyId, page, limit });
    res.json({ success: true, count: result.data.length, ...result });
  } catch (err) { next(err); }
}

export async function getPurchase(req, res, next) {
  try {
    const purchase = await billingService.getPurchase(req.user.companyId, req.params.id);
    res.json({ success: true, data: purchase });
  } catch (err) { next(err); }
}

// ============================================
// SALES
// ============================================

export async function createSale(req, res, next) {
  try {
    const { customerId, saleDate, items, supplyType } = req.body;
    if (!customerId || !saleDate || !items || !items.length) {
      return res.status(400).json({
        success: false,
        message: 'customerId, saleDate, and items (with at least one item) are required.',
      });
    }
    if (supplyType && !SUPPLY_TYPES.includes(supplyType)) {
      return res.status(400).json({ success: false, message: `"supplyType" must be one of: ${SUPPLY_TYPES.join(', ')}.` });
    }

    const sale = await billingService.createSale(req.user.companyId, req.body, req.user.id);
    res.status(201).json({
      success: true,
      message: 'Sale invoice created successfully and batch stocks decremented.',
      data: sale,
    });
  } catch (err) { next(err); }
}

export async function listSales(req, res, next) {
  try {
    const { page, limit, status } = req.query;
    const result = await billingService.listSales({ companyId: req.user.companyId, status, page, limit });
    res.json({ success: true, count: result.data.length, ...result });
  } catch (err) { next(err); }
}

export async function getSale(req, res, next) {
  try {
    const sale = await billingService.getSale(req.user.companyId, req.params.id);
    res.json({ success: true, data: sale });
  } catch (err) { next(err); }
}

// ============================================
// PAYMENTS
// ============================================

export async function createPayment(req, res, next) {
  try {
    const { partyId, amount, method, paymentDate } = req.body;
    if (!partyId || amount === undefined || !method || !paymentDate) {
      return res.status(400).json({
        success: false,
        message: 'partyId, amount, method, and paymentDate are required.',
      });
    }

    const payment = await billingService.createPayment(req.user.companyId, req.body, req.user.id);

    res.status(201).json({
      success: true,
      message: 'Payment recorded successfully.',
      data: payment,
    });
  } catch (err) { next(err); }
}

export async function listPayments(req, res, next) {
  try {
    const { page, limit } = req.query;
    const result = await billingService.listPayments({ companyId: req.user.companyId, page, limit });
    res.json({ success: true, count: result.data.length, ...result });
  } catch (err) { next(err); }
}

export async function getPayment(req, res, next) {
  try {
    const payment = await billingService.getPayment(req.user.companyId, req.params.id);
    res.json({ success: true, data: payment });
  } catch (err) { next(err); }
}

export async function getLastSale(req, res, next) {
  try {
    const { customerId } = req.query;
    if (!customerId) {
      return res.status(400).json({ success: false, message: '"customerId" is required.' });
    }
    const sale = await billingService.getLastSale(req.user.companyId, customerId);
    res.json({ success: true, data: sale });
  } catch (err) { next(err); }
}
