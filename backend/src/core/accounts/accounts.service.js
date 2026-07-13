import { prisma } from '../../shared/database/prisma.js';

// ============================================
// LEDGER GROUPS
// ============================================

export async function listGroups() {
  return prisma.ledgerGroup.findMany({
    include: {
      parent: { select: { id: true, name: true } },
      children: { select: { id: true, name: true, nature: true } },
      _count: { select: { ledgers: true } },
    },
    orderBy: [{ nature: 'asc' }, { name: 'asc' }],
  });
}

export async function getGroup(id) {
  const group = await prisma.ledgerGroup.findUnique({
    where: { id },
    include: {
      parent: { select: { id: true, name: true } },
      children: { select: { id: true, name: true, nature: true } },
      ledgers: { select: { id: true, name: true, openingBalance: true, openingBalanceType: true } },
    },
  });
  if (!group) {
    const err = new Error('Ledger group not found.');
    err.status = 404;
    throw err;
  }
  return group;
}

export async function createGroup({ name, nature, parentId }) {
  if (parentId) {
    const parent = await prisma.ledgerGroup.findUnique({ where: { id: parentId } });
    if (!parent) {
      const err = new Error('Parent ledger group not found.');
      err.status = 404;
      throw err;
    }
    if (parent.nature !== nature) {
      const err = new Error(`Child group nature (${nature}) must match parent nature (${parent.nature}).`);
      err.status = 400;
      throw err;
    }
  }

  const duplicate = await prisma.ledgerGroup.findUnique({ where: { name } });
  if (duplicate) {
    const err = new Error(`A ledger group named "${name}" already exists.`);
    err.status = 400;
    throw err;
  }

  return prisma.ledgerGroup.create({
    data: { name, nature, parentId: parentId || null },
  });
}

export async function updateGroup(id, { name, parentId }) {
  const group = await prisma.ledgerGroup.findUnique({ where: { id } });
  if (!group) {
    const err = new Error('Ledger group not found.');
    err.status = 404;
    throw err;
  }
  if (parentId === id) {
    const err = new Error('A group cannot be its own parent.');
    err.status = 400;
    throw err;
  }
  return prisma.ledgerGroup.update({
    where: { id },
    data: { name: name ?? group.name, parentId: parentId !== undefined ? parentId : group.parentId },
  });
}

export async function deleteGroup(id) {
  const group = await prisma.ledgerGroup.findUnique({
    where: { id },
    include: { _count: { select: { ledgers: true, children: true } } },
  });
  if (!group) {
    const err = new Error('Ledger group not found.');
    err.status = 404;
    throw err;
  }
  if (group._count.ledgers > 0 || group._count.children > 0) {
    const err = new Error('Cannot delete group containing child groups or ledgers.');
    err.status = 400;
    throw err;
  }
  return prisma.ledgerGroup.delete({ where: { id } });
}

// ============================================
// LEDGERS
// ============================================

export async function listLedgers({ groupId } = {}) {
  return prisma.ledger.findMany({
    where: groupId ? { groupId } : {},
    include: { group: { select: { id: true, name: true, nature: true } } },
    orderBy: { name: 'asc' },
  });
}

export async function getLedger(id) {
  const ledger = await prisma.ledger.findUnique({
    where: { id },
    include: { group: true },
  });
  if (!ledger) {
    const err = new Error('Ledger not found.');
    err.status = 404;
    throw err;
  }
  return ledger;
}

export async function createLedger({ name, groupId, openingBalance, openingBalanceType }) {
  const group = await prisma.ledgerGroup.findUnique({ where: { id: groupId } });
  if (!group) {
    const err = new Error('Ledger group not found.');
    err.status = 404;
    throw err;
  }

  const duplicate = await prisma.ledger.findUnique({ where: { name } });
  if (duplicate) {
    const err = new Error(`A ledger named "${name}" already exists.`);
    err.status = 400;
    throw err;
  }

  return prisma.ledger.create({
    data: {
      name,
      groupId,
      openingBalance: openingBalance || 0,
      openingBalanceType: openingBalanceType || 'DEBIT',
    },
  });
}

export async function updateLedger(id, { name, groupId, openingBalance, openingBalanceType }) {
  const ledger = await prisma.ledger.findUnique({ where: { id } });
  if (!ledger) {
    const err = new Error('Ledger not found.');
    err.status = 404;
    throw err;
  }

  if (groupId) {
    const group = await prisma.ledgerGroup.findUnique({ where: { id: groupId } });
    if (!group) {
      const err = new Error('Ledger group not found.');
      err.status = 404;
      throw err;
    }
  }

  return prisma.ledger.update({
    where: { id },
    data: {
      name: name ?? ledger.name,
      groupId: groupId ?? ledger.groupId,
      openingBalance: openingBalance ?? ledger.openingBalance,
      openingBalanceType: openingBalanceType ?? ledger.openingBalanceType,
    },
  });
}

export async function deleteLedger(id) {
  const ledger = await prisma.ledger.findUnique({
    where: { id },
    include: { party: true },
  });
  if (!ledger) {
    const err = new Error('Ledger not found.');
    err.status = 404;
    throw err;
  }
  if (ledger.party) {
    const err = new Error('Cannot delete ledger linked to a Customer/Supplier party.');
    err.status = 400;
    throw err;
  }

  // Check if ledger has any vouchers
  const hasVouchers = await prisma.voucherLine.findFirst({ where: { ledgerId: id } });
  if (hasVouchers) {
    const err = new Error('Cannot delete ledger with existing voucher postings.');
    err.status = 400;
    throw err;
  }

  return prisma.ledger.delete({ where: { id } });
}
