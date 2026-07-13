import * as mastersService from './masters.service.js';

// ============================================
// PARTIES
// ============================================

export async function listParties(req, res, next) {
  try {
    const { type } = req.query;
    const parties = await mastersService.listParties({ type });
    res.json({ success: true, count: parties.length, data: parties });
  } catch (err) { next(err); }
}

export async function getParty(req, res, next) {
  try {
    const party = await mastersService.getParty(req.params.id);
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
    const party = await mastersService.createParty(req.body);
    res.status(201).json({ success: true, message: 'Party created successfully.', data: party });
  } catch (err) { next(err); }
}

export async function updateParty(req, res, next) {
  try {
    const party = await mastersService.updateParty(req.params.id, req.body);
    res.json({ success: true, message: 'Party updated successfully.', data: party });
  } catch (err) { next(err); }
}

export async function deleteParty(req, res, next) {
  try {
    await mastersService.deleteParty(req.params.id);
    res.json({ success: true, message: 'Party deleted successfully.' });
  } catch (err) { next(err); }
}

// ============================================
// PRODUCTS
// ============================================

export async function listProducts(req, res, next) {
  try {
    const products = await mastersService.listProducts();
    res.json({ success: true, count: products.length, data: products });
  } catch (err) { next(err); }
}

export async function getProduct(req, res, next) {
  try {
    const product = await mastersService.getProduct(req.params.id);
    res.json({ success: true, data: product });
  } catch (err) { next(err); }
}

export async function createProduct(req, res, next) {
  try {
    const { name, price } = req.body;
    if (!name || price === undefined) {
      return res.status(400).json({ success: false, message: '"name" and "price" are required.' });
    }
    const product = await mastersService.createProduct(req.body);
    res.status(201).json({ success: true, message: 'Product created successfully.', data: product });
  } catch (err) { next(err); }
}

export async function updateProduct(req, res, next) {
  try {
    const product = await mastersService.updateProduct(req.params.id, req.body);
    res.json({ success: true, message: 'Product updated successfully.', data: product });
  } catch (err) { next(err); }
}

export async function deleteProduct(req, res, next) {
  try {
    await mastersService.deleteProduct(req.params.id);
    res.json({ success: true, message: 'Product deleted successfully.' });
  } catch (err) { next(err); }
}

// ============================================
// BATCHES
// ============================================

export async function listBatches(req, res, next) {
  try {
    const { productId } = req.query;
    const batches = await mastersService.listBatches({ productId });
    res.json({ success: true, count: batches.length, data: batches });
  } catch (err) { next(err); }
}

export async function getBatch(req, res, next) {
  try {
    const batch = await mastersService.getBatch(req.params.id);
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
    const batch = await mastersService.createBatch(req.body);
    res.status(201).json({ success: true, message: 'Batch created successfully.', data: batch });
  } catch (err) { next(err); }
}

export async function updateBatch(req, res, next) {
  try {
    const batch = await mastersService.updateBatch(req.params.id, req.body);
    res.json({ success: true, message: 'Batch updated successfully.', data: batch });
  } catch (err) { next(err); }
}

export async function deleteBatch(req, res, next) {
  try {
    await mastersService.deleteBatch(req.params.id);
    res.json({ success: true, message: 'Batch deleted successfully.' });
  } catch (err) { next(err); }
}

export async function syncMasters(req, res, next) {
  try {
    const result = await mastersService.syncFromVsArogya();
    res.json(result);
  } catch (err) { next(err); }
}
