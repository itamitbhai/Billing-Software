import { prisma } from '../../shared/database/prisma.js';
import { paginate, paginatedResult } from '../../shared/utils/pagination.js';

// ============================================
// PARTIES
// ============================================

export async function listParties({ companyId, type, page, limit }) {
  const { take, skip } = paginate({ page, limit });
  const where = { companyId, ...(type ? { type } : {}) };

  const [rows, total] = await Promise.all([
    prisma.party.findMany({
      where,
      include: { ledger: true },
      orderBy: { name: 'asc' },
      take,
      skip,
    }),
    prisma.party.count({ where }),
  ]);

  return paginatedResult({ rows, total, page: paginate({ page, limit }).page, limit: take });
}

export async function getParty(companyId, id) {
  const party = await prisma.party.findFirst({ where: { id, companyId } });
  if (!party) {
    const err = new Error('Party not found.');
    err.status = 404;
    throw err;
  }
  return party;
}

async function getOrCreateGroup(tx, companyId, name, nature) {
  let group = await tx.ledgerGroup.findUnique({ where: { companyId_name: { companyId, name } } });
  if (!group) {
    group = await tx.ledgerGroup.create({ data: { companyId, name, nature, isSystem: true } });
  }
  return group;
}

export async function createParty(companyId, data) {
  const groupName = data.type === 'SUPPLIER' ? 'Sundry Creditors' : 'Sundry Debtors';
  const nature = data.type === 'SUPPLIER' ? 'LIABILITY' : 'ASSET';
  const balanceType = data.type === 'SUPPLIER' ? 'CREDIT' : 'DEBIT';

  return prisma.$transaction(async (tx) => {
    const group = await getOrCreateGroup(tx, companyId, groupName, nature);

    const ledger = await tx.ledger.create({
      data: {
        companyId,
        name: `${data.name} Ledger`,
        groupId: group.id,
        openingBalance: data.openingBalance || 0,
        openingBalanceType: balanceType,
      },
    });

    return tx.party.create({
      data: {
        companyId,
        externalId: data.externalId || null,
        name: data.name,
        gstin: data.gstin || null,
        pan: data.pan || null,
        phone: data.phone || null,
        email: data.email || null,
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        pincode: data.pincode || null,
        dlNumber: data.dlNumber || null,
        type: data.type || 'CUSTOMER',
        creditLimit: data.creditLimit || null,
        creditPeriodDays: data.creditPeriodDays || 30,
        openingBalance: data.openingBalance || 0,
        ledgerId: ledger.id,
      },
    });
  });
}

export async function updateParty(companyId, id, data) {
  const party = await prisma.party.findFirst({ where: { id, companyId } });
  if (!party) {
    const err = new Error('Party not found.');
    err.status = 404;
    throw err;
  }

  return prisma.$transaction(async (tx) => {
    if (data.name && data.name !== party.name) {
      await tx.ledger.update({
        where: { id: party.ledgerId },
        data: { name: `${data.name} Ledger` },
      });
    }

    return tx.party.update({
      where: { id },
      data: {
        externalId: data.externalId !== undefined ? data.externalId : undefined,
        name: data.name,
        gstin: data.gstin,
        pan: data.pan,
        phone: data.phone,
        email: data.email,
        address: data.address,
        city: data.city,
        state: data.state,
        pincode: data.pincode,
        dlNumber: data.dlNumber,
        type: data.type,
        creditLimit: data.creditLimit,
        creditPeriodDays: data.creditPeriodDays,
        openingBalance: data.openingBalance,
        isActive: data.isActive,
      },
    });
  });
}

export async function deleteParty(companyId, id) {
  const party = await prisma.party.findFirst({ where: { id, companyId } });
  if (!party) {
    const err = new Error('Party not found.');
    err.status = 404;
    throw err;
  }

  return prisma.$transaction(async (tx) => {
    const deleted = await tx.party.delete({ where: { id } });
    await tx.ledger.delete({ where: { id: party.ledgerId } });
    return deleted;
  });
}

// ============================================
// PRODUCTS
// ============================================

export async function listProducts({ companyId, page, limit }) {
  const { take, skip, page: currentPage } = paginate({ page, limit });
  const where = { companyId };

  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { batches: { select: { currentQty: true } } },
      orderBy: { name: 'asc' },
      take,
      skip,
    }),
    prisma.product.count({ where }),
  ]);

  return paginatedResult({ rows, total, page: currentPage, limit: take });
}

export async function getProduct(companyId, id) {
  const product = await prisma.product.findFirst({
    where: { id, companyId },
    include: { batches: true },
  });
  if (!product) {
    const err = new Error('Product not found.');
    err.status = 404;
    throw err;
  }
  return product;
}

export async function createProduct(companyId, data) {
  return prisma.product.create({
    data: {
      companyId,
      externalId: data.externalId || null,
      name: data.name,
      sku: data.sku || null,
      type: data.type || null,
      price: data.price,
      unit: data.unit || 'PCS',
      hsnCode: data.hsnCode || null,
      gstRate: data.gstRate || 0,
      reorderLevel: data.reorderLevel || 0,
    },
  });
}

export async function updateProduct(companyId, id, data) {
  await getProduct(companyId, id);
  return prisma.product.update({
    where: { id },
    data: {
      externalId: data.externalId !== undefined ? data.externalId : undefined,
      name: data.name,
      sku: data.sku,
      type: data.type,
      price: data.price,
      unit: data.unit,
      hsnCode: data.hsnCode,
      gstRate: data.gstRate,
      reorderLevel: data.reorderLevel,
      isActive: data.isActive,
    },
  });
}

export async function deleteProduct(companyId, id) {
  await getProduct(companyId, id);
  return prisma.product.delete({ where: { id } });
}

// ============================================
// BATCHES
// ============================================

export async function listBatches({ companyId, productId }) {
  return prisma.batch.findMany({
    where: { companyId, ...(productId ? { productId } : {}) },
    include: { product: { select: { name: true, type: true } } },
    orderBy: { expiryDate: 'asc' },
  });
}

export async function getBatch(companyId, id) {
  const batch = await prisma.batch.findFirst({
    where: { id, companyId },
    include: { product: true },
  });
  if (!batch) {
    const err = new Error('Batch not found.');
    err.status = 404;
    throw err;
  }
  return batch;
}

export async function createBatch(companyId, data) {
  const product = await prisma.product.findFirst({ where: { id: data.productId, companyId } });
  if (!product) {
    const err = new Error('Product not found.');
    err.status = 404;
    throw err;
  }

  return prisma.batch.create({
    data: {
      companyId,
      productId: data.productId,
      batchNumber: data.batchNumber,
      expiryDate: new Date(data.expiryDate),
      mrp: data.mrp,
      currentQty: data.currentQty || 0,
    },
  });
}

export async function updateBatch(companyId, id, data) {
  await getBatch(companyId, id);
  return prisma.batch.update({
    where: { id },
    data: {
      batchNumber: data.batchNumber,
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
      mrp: data.mrp,
      currentQty: data.currentQty,
    },
  });
}

export async function deleteBatch(companyId, id) {
  await getBatch(companyId, id);
  return prisma.batch.delete({ where: { id } });
}

// ============================================
// COST CENTRES
// ============================================

export async function listCostCentres(companyId) {
  return prisma.costCentre.findMany({
    where: { companyId },
    orderBy: { name: 'asc' },
  });
}

export async function createCostCentre(companyId, { name, parentId }) {
  return prisma.costCentre.create({
    data: { companyId, name, parentId: parentId || null },
  });
}

export async function updateCostCentre(companyId, id, { name, parentId }) {
  const costCentre = await prisma.costCentre.findFirst({ where: { id, companyId } });
  if (!costCentre) {
    const err = new Error('Cost centre not found.');
    err.status = 404;
    throw err;
  }
  if (parentId === id) {
    const err = new Error('A cost centre cannot be its own parent.');
    err.status = 400;
    throw err;
  }
  return prisma.costCentre.update({
    where: { id },
    data: {
      name: name ?? costCentre.name,
      parentId: parentId !== undefined ? parentId : costCentre.parentId,
    },
  });
}

export async function deleteCostCentre(companyId, id) {
  const costCentre = await prisma.costCentre.findFirst({ where: { id, companyId } });
  if (!costCentre) {
    const err = new Error('Cost centre not found.');
    err.status = 404;
    throw err;
  }
  const hasVouchers = await prisma.voucherLine.findFirst({ where: { costCentreId: id } });
  if (hasVouchers) {
    const err = new Error('Cannot delete cost centre with existing voucher postings.');
    err.status = 400;
    throw err;
  }
  return prisma.costCentre.delete({ where: { id } });
}

// ============================================
// SYNC (external VS Arogya integration)
// ============================================

export async function syncFromVsArogya(companyId) {
  const apiUrl = process.env.VS_AROGYA_API_URL;
  const apiKey = process.env.VS_AROGYA_API_KEY;

  let externalParties = [];
  let externalProducts = [];

  if (apiUrl) {
    try {
      const partiesRes = await fetch(`${apiUrl}/api/sync/parties`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      if (partiesRes.ok) {
        const json = await partiesRes.json();
        externalParties = json.data || [];
      }

      const productsRes = await fetch(`${apiUrl}/api/sync/products`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      if (productsRes.ok) {
        const json = await productsRes.json();
        externalProducts = json.data || [];
      }
    } catch (error) {
      console.error('Error fetching data from VS Arogya API:', error);
      throw new Error('Failed to connect to VS Arogya API.');
    }
  } else {
    // Mock / Seed Fallback Data
    externalParties = [
      {
        externalId: "vs-arogya-party-apollo",
        name: "Apollo Pharmacy Mumbai",
        gstin: "27AAAPA9876C1Z3",
        phone: "+91 9999888777",
        email: "mumbai@apollopharmacy.com",
        address: "Dharavi, Mumbai",
        state: "Maharashtra",
        type: "CUSTOMER",
        creditLimit: 75000.00,
        creditPeriodDays: 30,
        openingBalance: 500.00
      },
      {
        externalId: "vs-arogya-party-cipla",
        name: "Cipla Pharmaceuticals Ltd",
        gstin: "27AAACC2233M1Z5",
        phone: "+91 2222333444",
        email: "orders@cipla.com",
        address: "Cipla House, Mumbai",
        state: "Maharashtra",
        type: "SUPPLIER",
        creditLimit: 200000.00,
        creditPeriodDays: 60,
        openingBalance: 0
      }
    ];

    externalProducts = [
      {
        externalId: "vs-arogya-prod-amox",
        name: "Amoxycillin 500mg",
        type: "Capsule",
        price: 85.00,
        unit: "STRIP",
        hsnCode: "30041010",
        gstRate: 12.00,
        reorderLevel: 100
      },
      {
        externalId: "vs-arogya-prod-cetr",
        name: "Cetirizine 10mg",
        type: "Tablet",
        price: 15.20,
        unit: "STRIP",
        hsnCode: "30049039",
        gstRate: 12.00,
        reorderLevel: 200
      }
    ];
  }

  let syncedPartiesCount = 0;
  for (const party of externalParties) {
    if (!party.externalId || !party.name) continue;

    const existing = await prisma.party.findUnique({
      where: { companyId_externalId: { companyId, externalId: party.externalId } },
    });

    if (existing) {
      await prisma.party.update({
        where: { id: existing.id },
        data: {
          name: party.name,
          gstin: party.gstin,
          phone: party.phone,
          email: party.email,
          address: party.address,
          state: party.state,
          type: party.type || 'CUSTOMER',
          creditLimit: party.creditLimit,
          creditPeriodDays: party.creditPeriodDays,
          lastSyncedAt: new Date(),
        },
      });
    } else {
      await createParty(companyId, {
        ...party,
        openingBalance: party.openingBalance || 0,
      });
    }
    syncedPartiesCount++;
  }

  let syncedProductsCount = 0;
  for (const prod of externalProducts) {
    if (!prod.externalId || !prod.name) continue;

    await prisma.product.upsert({
      where: { companyId_externalId: { companyId, externalId: prod.externalId } },
      update: {
        name: prod.name,
        type: prod.type,
        price: prod.price,
        unit: prod.unit,
        hsnCode: prod.hsnCode,
        gstRate: prod.gstRate,
        reorderLevel: prod.reorderLevel,
        lastSyncedAt: new Date(),
      },
      create: {
        companyId,
        externalId: prod.externalId,
        name: prod.name,
        type: prod.type,
        price: prod.price,
        unit: prod.unit || 'PCS',
        hsnCode: prod.hsnCode,
        gstRate: prod.gstRate || 0,
        reorderLevel: prod.reorderLevel || 0,
      }
    });
    syncedProductsCount++;
  }

  return {
    success: true,
    message: 'Synchronization completed.',
    syncedPartiesCount,
    syncedProductsCount,
    mode: apiUrl ? 'LIVE' : 'MOCK'
  };
}
