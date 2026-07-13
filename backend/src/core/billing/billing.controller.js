import * as billingService from './billing.service.js';

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

    const purchase = await billingService.createPurchase(req.body);
    res.status(201).json({
      success: true,
      message: 'Purchase recorded successfully and batch stocks updated.',
      data: purchase,
    });
  } catch (err) { next(err); }
}

export async function listPurchases(req, res, next) {
  try {
    const purchases = await billingService.listPurchases();
    res.json({ success: true, count: purchases.length, data: purchases });
  } catch (err) { next(err); }
}

export async function getPurchase(req, res, next) {
  try {
    const purchase = await billingService.getPurchase(req.params.id);
    res.json({ success: true, data: purchase });
  } catch (err) { next(err); }
}

// ============================================
// SALES
// ============================================

export async function createSale(req, res, next) {
  try {
    const { customerId, invoiceNumber, saleDate, items } = req.body;
    if (!customerId || !invoiceNumber || !saleDate || !items || !items.length) {
      return res.status(400).json({
        success: false,
        message: 'customerId, invoiceNumber, saleDate, and items (with at least one item) are required.',
      });
    }

    const sale = await billingService.createSale(req.body);
    res.status(201).json({
      success: true,
      message: 'Sale invoice created successfully and batch stocks decremented.',
      data: sale,
    });
  } catch (err) { next(err); }
}

export async function listSales(req, res, next) {
  try {
    const sales = await billingService.listSales();
    res.json({ success: true, count: sales.length, data: sales });
  } catch (err) { next(err); }
}

export async function getSale(req, res, next) {
  try {
    const sale = await billingService.getSale(req.params.id);
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

    // Attach recordedBy from logged-in user
    const payment = await billingService.createPayment({
      ...req.body,
      recordedById: req.user.id,
    });

    res.status(201).json({
      success: true,
      message: 'Payment recorded successfully.',
      data: payment,
    });
  } catch (err) { next(err); }
}

export async function listPayments(req, res, next) {
  try {
    const payments = await billingService.listPayments();
    res.json({ success: true, count: payments.length, data: payments });
  } catch (err) { next(err); }
}

export async function getPayment(req, res, next) {
  try {
    const payment = await billingService.getPayment(req.params.id);
    res.json({ success: true, data: payment });
  } catch (err) { next(err); }
}

export async function getLastSale(req, res, next) {
  try {
    const { customerId } = req.query;
    if (!customerId) {
      return res.status(400).json({ success: false, message: '"customerId" is required.' });
    }
    const sale = await billingService.getLastSale(customerId);
    res.json({ success: true, data: sale });
  } catch (err) { next(err); }
}
