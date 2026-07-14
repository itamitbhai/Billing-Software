import { prisma } from '../../shared/database/prisma.js';

// ============================================
// PARTIES
// ============================================

export async function listParties({ type }) {
  return prisma.party.findMany({
    where: type ? { type } : {},
    include: { ledger: true },
    orderBy: { name: 'asc' },
  });
}

export async function getParty(id) {
  const party = await prisma.party.findUnique({
    where: { id },
  });
  if (!party) {
    const err = new Error('Party not found.');
    err.status = 404;
    throw err;
  }
  return party;
}

export async function createParty(data) {
  const groupName = data.type === 'SUPPLIER' ? 'Sundry Creditors' : 'Sundry Debtors';
  const nature = data.type === 'SUPPLIER' ? 'LIABILITY' : 'ASSET';
  const balanceType = data.type === 'SUPPLIER' ? 'CREDIT' : 'DEBIT';

  return prisma.$transaction(async (tx) => {
    // 1. Resolve or create Ledger Group
    let group = await tx.ledgerGroup.findUnique({ where: { name: groupName } });
    if (!group) {
      group = await tx.ledgerGroup.create({
        data: { name: groupName, nature },
      });
    }

    // 2. Create Backing Ledger
    const ledger = await tx.ledger.create({
      data: {
        name: `${data.name} Ledger`,
        groupId: group.id,
        openingBalance: data.openingBalance || 0,
        openingBalanceType: balanceType,
      },
    });

    // 3. Create Party
    return tx.party.create({
      data: {
        externalId: data.externalId || null,
        name: data.name,
        gstin: data.gstin || null,
        phone: data.phone || null,
        email: data.email || null,
        address: data.address || null,
        state: data.state || null,
        type: data.type || 'CUSTOMER',
        creditLimit: data.creditLimit || null,
        creditPeriodDays: data.creditPeriodDays || 30,
        openingBalance: data.openingBalance || 0,
        ledgerId: ledger.id,
      },
    });
  });
}

export async function updateParty(id, data) {
  const party = await prisma.party.findUnique({ where: { id } });
  if (!party) {
    const err = new Error('Party not found.');
    err.status = 404;
    throw err;
  }

  return prisma.$transaction(async (tx) => {
    // Sync ledger name if party name changes
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
        phone: data.phone,
        email: data.email,
        address: data.address,
        state: data.state,
        type: data.type,
        creditLimit: data.creditLimit,
        creditPeriodDays: data.creditPeriodDays,
        openingBalance: data.openingBalance,
      },
    });
  });
}

export async function deleteParty(id) {
  const party = await prisma.party.findUnique({ where: { id } });
  if (!party) {
    const err = new Error('Party not found.');
    err.status = 404;
    throw err;
  }

  return prisma.$transaction(async (tx) => {
    // Delete Party first
    const deleted = await tx.party.delete({ where: { id } });
    // Delete backing Ledger
    await tx.ledger.delete({ where: { id: party.ledgerId } });
    return deleted;
  });
}

// ============================================
// PRODUCTS
// ============================================

export async function listProducts() {
  return prisma.product.findMany({
    orderBy: { name: 'asc' },
  });
}

export async function getProduct(id) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: { batches: true },
  });
  if (!product) {
    const err = new Error('Product not found.');
    err.status = 404;
    throw err;
  }
  return product;
}

export async function createProduct(data) {
  return prisma.product.create({
    data: {
      externalId: data.externalId || null,
      name: data.name,
      type: data.type || null,
      price: data.price,
      unit: data.unit || 'PCS',
      hsnCode: data.hsnCode || null,
      gstRate: data.gstRate || 0,
      reorderLevel: data.reorderLevel || 0,
    },
  });
}

export async function updateProduct(id, data) {
  return prisma.product.update({
    where: { id },
    data: {
      externalId: data.externalId !== undefined ? data.externalId : undefined,
      name: data.name,
      type: data.type,
      price: data.price,
      unit: data.unit,
      hsnCode: data.hsnCode,
      gstRate: data.gstRate,
      reorderLevel: data.reorderLevel,
    },
  });
}

export async function deleteProduct(id) {
  return prisma.product.delete({
    where: { id },
  });
}

// ============================================
// BATCHES
// ============================================

export async function listBatches({ productId }) {
  return prisma.batch.findMany({
    where: productId ? { productId } : {},
    include: { product: { select: { name: true, type: true } } },
    orderBy: { expiryDate: 'asc' },
  });
}

export async function getBatch(id) {
  const batch = await prisma.batch.findUnique({
    where: { id },
    include: { product: true },
  });
  if (!batch) {
    const err = new Error('Batch not found.');
    err.status = 404;
    throw err;
  }
  return batch;
}

export async function createBatch(data) {
  return prisma.batch.create({
    data: {
      productId: data.productId,
      batchNumber: data.batchNumber,
      expiryDate: new Date(data.expiryDate),
      mrp: data.mrp,
      currentQty: data.currentQty || 0,
    },
  });
}

export async function updateBatch(id, data) {
  return prisma.batch.update({
    where: { id },
    data: {
      productId: data.productId,
      batchNumber: data.batchNumber,
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
      mrp: data.mrp,
      currentQty: data.currentQty,
    },
  });
}

export async function deleteBatch(id) {
  return prisma.batch.delete({
    where: { id },
  });
}

export async function syncFromVsArogya() {
  const apiUrl = process.env.VS_AROGYA_API_URL;
  const apiKey = process.env.VS_AROGYA_API_KEY;

  let externalParties = [];
  let externalProducts = [];

  if (apiUrl) {
    try {
      // 1. Fetch Parties
      const partiesRes = await fetch(`${apiUrl}/api/sync/parties`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      if (partiesRes.ok) {
        const json = await partiesRes.ok ? await partiesRes.json() : {};
        externalParties = json.data || [];
      }

      // 2. Fetch Products
      const productsRes = await fetch(`${apiUrl}/api/sync/products`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      if (productsRes.ok) {
        const json = await productsRes.ok ? await productsRes.json() : {};
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

  // 3. Upsert synced Parties
  let syncedPartiesCount = 0;
  for (const party of externalParties) {
    if (!party.externalId || !party.name) continue;

    await prisma.party.upsert({
      where: { externalId: party.externalId },
      update: {
        name: party.name,
        gstin: party.gstin,
        phone: party.phone,
        email: party.email,
        address: party.address,
        state: party.state,
        type: party.type || 'CUSTOMER',
        creditLimit: party.creditLimit,
        creditPeriodDays: party.creditPeriodDays,
        openingBalance: party.openingBalance,
      },
      create: {
        externalId: party.externalId,
        name: party.name,
        gstin: party.gstin,
        phone: party.phone,
        email: party.email,
        address: party.address,
        state: party.state,
        type: party.type || 'CUSTOMER',
        creditLimit: party.creditLimit,
        creditPeriodDays: party.creditPeriodDays,
        openingBalance: party.openingBalance || 0,
      }
    });
    syncedPartiesCount++;
  }

  // 4. Upsert synced Products
  let syncedProductsCount = 0;
  for (const prod of externalProducts) {
    if (!prod.externalId || !prod.name) continue;

    await prisma.product.upsert({
      where: { externalId: prod.externalId },
      update: {
        name: prod.name,
        type: prod.type,
        price: prod.price,
        unit: prod.unit,
        hsnCode: prod.hsnCode,
        gstRate: prod.gstRate,
        reorderLevel: prod.reorderLevel,
      },
      create: {
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
