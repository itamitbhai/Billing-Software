import * as mastersService from './masters.service.js';

// ============================================
// PARTIES
// ============================================

export async function listParties(req, res, next) {
  try {
    const { type, page, limit } = req.query;
    const result = await mastersService.listParties({ companyId: req.user.companyId, type, page, limit });
    res.json({ success: true, count: result.data.length, ...result });
  } catch (err) { next(err); }
}

export async function getParty(req, res, next) {
  try {
    const party = await mastersService.getParty(req.user.companyId, req.params.id);
    res.json({ success: true, data: party });
  } catch (err) { next(err); }
}

export async function createParty(req, res, next) {
  try {
    const { name, type } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: '"name" is required.' });
    }
    if (type && !['CUSTOMER', 'SUPPLIER', 'BOTH'].includes(type)) {
      return res.status(400).json({ success: false, message: 'type must be CUSTOMER, SUPPLIER, or BOTH.' });
    }
    const party = await mastersService.createParty(req.user.companyId, req.body);
    res.status(201).json({ success: true, message: 'Party created successfully.', data: party });
  } catch (err) { next(err); }
}

export async function updateParty(req, res, next) {
  try {
    const party = await mastersService.updateParty(req.user.companyId, req.params.id, req.body);
    res.json({ success: true, message: 'Party updated successfully.', data: party });
  } catch (err) { next(err); }
}

export async function deleteParty(req, res, next) {
  try {
    await mastersService.deleteParty(req.user.companyId, req.params.id);
    res.json({ success: true, message: 'Party deleted successfully.' });
  } catch (err) { next(err); }
}

// ============================================
// PRODUCTS
// ============================================

export async function listProducts(req, res, next) {
  try {
    const { page, limit } = req.query;
    const result = await mastersService.listProducts({ companyId: req.user.companyId, page, limit });
    res.json({ success: true, count: result.data.length, ...result });
  } catch (err) { next(err); }
}

export async function getProduct(req, res, next) {
  try {
    const product = await mastersService.getProduct(req.user.companyId, req.params.id);
    res.json({ success: true, data: product });
  } catch (err) { next(err); }
}

export async function createProduct(req, res, next) {
  try {
    const { name, price } = req.body;
    if (!name || price === undefined) {
      return res.status(400).json({ success: false, message: '"name" and "price" are required.' });
    }
    const product = await mastersService.createProduct(req.user.companyId, req.body);
    res.status(201).json({ success: true, message: 'Product created successfully.', data: product });
  } catch (err) { next(err); }
}

export async function updateProduct(req, res, next) {
  try {
    const product = await mastersService.updateProduct(req.user.companyId, req.params.id, req.body);
    res.json({ success: true, message: 'Product updated successfully.', data: product });
  } catch (err) { next(err); }
}

export async function deleteProduct(req, res, next) {
  try {
    await mastersService.deleteProduct(req.user.companyId, req.params.id);
    res.json({ success: true, message: 'Product deleted successfully.' });
  } catch (err) { next(err); }
}

// ============================================
// BATCHES
// ============================================

export async function listBatches(req, res, next) {
  try {
    const { productId } = req.query;
    const batches = await mastersService.listBatches({ companyId: req.user.companyId, productId });
    res.json({ success: true, count: batches.length, data: batches });
  } catch (err) { next(err); }
}

export async function getBatch(req, res, next) {
  try {
    const batch = await mastersService.getBatch(req.user.companyId, req.params.id);
    res.json({ success: true, data: batch });
  } catch (err) { next(err); }
}

export async function createBatch(req, res, next) {
  try {
    const { productId, batchNumber, expiryDate, mrp } = req.body;
    if (!productId || !batchNumber || !expiryDate || mrp === undefined) {
      return res.status(400).json({
        success: false,
        message: '"productId", "batchNumber", "expiryDate", and "mrp" are required.',
      });
    }
    const batch = await mastersService.createBatch(req.user.companyId, req.body);
    res.status(201).json({ success: true, message: 'Batch created successfully.', data: batch });
  } catch (err) { next(err); }
}

export async function updateBatch(req, res, next) {
  try {
    const batch = await mastersService.updateBatch(req.user.companyId, req.params.id, req.body);
    res.json({ success: true, message: 'Batch updated successfully.', data: batch });
  } catch (err) { next(err); }
}

export async function deleteBatch(req, res, next) {
  try {
    await mastersService.deleteBatch(req.user.companyId, req.params.id);
    res.json({ success: true, message: 'Batch deleted successfully.' });
  } catch (err) { next(err); }
}

export async function syncMasters(req, res, next) {
  try {
    const result = await mastersService.syncFromVsArogya(req.user.companyId);
    res.json(result);
  } catch (err) { next(err); }
}
