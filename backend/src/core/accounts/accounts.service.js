import { prisma } from '../../shared/database/prisma.js';

// ============================================
// LEDGER GROUPS
// ============================================

export async function listGroups(companyId) {
  return prisma.ledgerGroup.findMany({
    where: { companyId },
    include: {
      parent: { select: { id: true, name: true } },
      children: { select: { id: true, name: true, nature: true } },
      _count: { select: { ledgers: true } },
    },
    orderBy: [{ nature: 'asc' }, { name: 'asc' }],
  });
}

export async function getGroup(companyId, id) {
  const group = await prisma.ledgerGroup.findFirst({
    where: { id, companyId },
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

export async function createGroup(companyId, { name, nature, parentId }) {
  if (parentId) {
    const parent = await prisma.ledgerGroup.findFirst({ where: { id: parentId, companyId } });
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

  const duplicate = await prisma.ledgerGroup.findUnique({ where: { companyId_name: { companyId, name } } });
  if (duplicate) {
    const err = new Error(`A ledger group named "${name}" already exists.`);
    err.status = 400;
    throw err;
  }

  return prisma.ledgerGroup.create({
    data: { companyId, name, nature, parentId: parentId || null },
  });
}

export async function updateGroup(companyId, id, { name, parentId }) {
  const group = await prisma.ledgerGroup.findFirst({ where: { id, companyId } });
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

export async function deleteGroup(companyId, id) {
  const group = await prisma.ledgerGroup.findFirst({
    where: { id, companyId },
    include: { _count: { select: { ledgers: true, children: true } } },
  });
  if (!group) {
    const err = new Error('Ledger group not found.');
    err.status = 404;
    throw err;
  }
  if (group.isSystem) {
    const err = new Error('Cannot delete a system-defined ledger group.');
    err.status = 400;
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

export async function listLedgers(companyId, { groupId } = {}) {
  return prisma.ledger.findMany({
    where: { companyId, ...(groupId ? { groupId } : {}) },
    include: { group: { select: { id: true, name: true, nature: true } } },
    orderBy: { name: 'asc' },
  });
}

export async function getLedger(companyId, id) {
  const ledger = await prisma.ledger.findFirst({
    where: { id, companyId },
    include: { group: true },
  });
  if (!ledger) {
    const err = new Error('Ledger not found.');
    err.status = 404;
    throw err;
  }
  return ledger;
}

export async function createLedger(companyId, { name, groupId, openingBalance, openingBalanceType, description }) {
  const group = await prisma.ledgerGroup.findFirst({ where: { id: groupId, companyId } });
  if (!group) {
    const err = new Error('Ledger group not found.');
    err.status = 404;
    throw err;
  }

  const duplicate = await prisma.ledger.findUnique({ where: { companyId_name: { companyId, name } } });
  if (duplicate) {
    const err = new Error(`A ledger named "${name}" already exists.`);
    err.status = 400;
    throw err;
  }

  return prisma.ledger.create({
    data: {
      companyId,
      name,
      groupId,
      openingBalance: openingBalance || 0,
      openingBalanceType: openingBalanceType || 'DEBIT',
      description: description || null,
    },
  });
}

export async function updateLedger(companyId, id, { name, groupId, openingBalance, openingBalanceType, description }) {
  const ledger = await prisma.ledger.findFirst({ where: { id, companyId } });
  if (!ledger) {
    const err = new Error('Ledger not found.');
    err.status = 404;
    throw err;
  }

  if (groupId) {
    const group = await prisma.ledgerGroup.findFirst({ where: { id: groupId, companyId } });
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
      description: description !== undefined ? description : ledger.description,
    },
  });
}

export async function deleteLedger(companyId, id) {
  const ledger = await prisma.ledger.findFirst({
    where: { id, companyId },
    include: { party: true, bankAccount: true },
  });
  if (!ledger) {
    const err = new Error('Ledger not found.');
    err.status = 404;
    throw err;
  }
  if (ledger.isSystem) {
    const err = new Error('Cannot delete a system-defined ledger.');
    err.status = 400;
    throw err;
  }
  if (ledger.party) {
    const err = new Error('Cannot delete ledger linked to a Customer/Supplier party.');
    err.status = 400;
    throw err;
  }
  if (ledger.bankAccount) {
    const err = new Error('Cannot delete ledger linked to a Bank Account.');
    err.status = 400;
    throw err;
  }

  const hasVouchers = await prisma.voucherLine.findFirst({ where: { ledgerId: id } });
  if (hasVouchers) {
    const err = new Error('Cannot delete ledger with existing voucher postings.');
    err.status = 400;
    throw err;
  }

  return prisma.ledger.delete({ where: { id } });
}
