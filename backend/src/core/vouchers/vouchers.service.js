import { prisma } from '../../shared/database/prisma.js';
import { paginate, paginatedResult } from '../../shared/utils/pagination.js';
import { getOrCreateFinancialYear, nextVoucherNumber } from '../../shared/utils/voucher-sequence.js';

const MANUAL_TYPES = ['CONTRA', 'JOURNAL', 'CREDIT_NOTE', 'DEBIT_NOTE'];

function validateDoubleEntry(lines) {
  let totalDebit = 0;
  let totalCredit = 0;
  for (const line of lines) {
    if (line.type === 'DEBIT') totalDebit += Number(line.amount);
    if (line.type === 'CREDIT') totalCredit += Number(line.amount);
  }
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    const err = new Error(`Double-entry violation: Total Debit (${totalDebit}) ≠ Total Credit (${totalCredit}).`);
    err.status = 400;
    throw err;
  }
}

export async function listVouchers({ companyId, type, startDate, endDate, page = 1, limit = 50 } = {}) {
  const { take, skip, page: currentPage } = paginate({ page, limit });

  const where = {
    companyId,
    isDeleted: false,
    ...(type ? { type } : {}),
    ...(startDate || endDate ? {
      date: {
        ...(startDate ? { gte: new Date(startDate) } : {}),
        ...(endDate ? { lte: new Date(endDate) } : {}),
      }
    } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.voucher.findMany({
      where,
      include: { lines: { include: { ledger: { select: { id: true, name: true } } } }, party: { select: { id: true, name: true } } },
      orderBy: { date: 'desc' },
      take,
      skip,
    }),
    prisma.voucher.count({ where }),
  ]);

  return paginatedResult({ rows, total, page: currentPage, limit: take });
}

export async function getVoucher(companyId, id) {
  const voucher = await prisma.voucher.findFirst({
    where: { id, companyId },
    include: { lines: { include: { ledger: true, costCentre: true } }, party: true },
  });
  if (!voucher) {
    const err = new Error('Voucher not found.');
    err.status = 404;
    throw err;
  }
  return voucher;
}

export async function createVoucher(companyId, data, createdBy) {
  const { type, date, narration, partyId, lines } = data;

  if (!MANUAL_TYPES.includes(type)) {
    const err = new Error(`${type} vouchers are created automatically from Sales/Purchases/Payments. Use the billing module instead.`);
    err.status = 400;
    throw err;
  }
  if (!lines || lines.length < 2) {
    const err = new Error('A voucher must contain at least 2 entry lines.');
    err.status = 400;
    throw err;
  }
  validateDoubleEntry(lines);

  return prisma.$transaction(async (tx) => {
    const fy = await getOrCreateFinancialYear(tx, companyId, date);
    const { voucherNumber } = await nextVoucherNumber(tx, { companyId, financialYear: fy, type });

    const voucher = await tx.voucher.create({
      data: {
        companyId,
        voucherNumber,
        type,
        date: new Date(date),
        narration: narration || null,
        partyId: partyId || null,
        financialYearId: fy.id,
        createdBy: createdBy || null,
      }
    });

    for (const line of lines) {
      await tx.voucherLine.create({
        data: {
          voucherId: voucher.id,
          ledgerId: line.ledgerId,
          type: line.type,
          amount: line.amount,
          cgstAmount: line.cgstAmount || 0,
          sgstAmount: line.sgstAmount || 0,
          igstAmount: line.igstAmount || 0,
          costCentreId: line.costCentreId || null,
          description: line.description || null,
        }
      });
    }

    return tx.voucher.findUnique({
      where: { id: voucher.id },
      include: { lines: { include: { ledger: true } } }
    });
  });
}

export async function updateVoucher(companyId, id, data) {
  const { date, narration, lines } = data;
  const voucher = await prisma.voucher.findFirst({
    where: { id, companyId },
    include: { sale: true, purchase: true, payment: true },
  });
  if (!voucher) {
    const err = new Error('Voucher not found.');
    err.status = 404;
    throw err;
  }
  if (voucher.isDeleted) {
    const err = new Error('Cannot edit a cancelled voucher.');
    err.status = 400;
    throw err;
  }
  if (voucher.sale || voucher.purchase || voucher.payment) {
    const err = new Error('This voucher was auto-generated from a Sale/Purchase/Payment. Edit the source record instead.');
    err.status = 400;
    throw err;
  }

  if (lines) {
    if (lines.length < 2) {
      const err = new Error('A voucher must contain at least 2 entry lines.');
      err.status = 400;
      throw err;
    }
    validateDoubleEntry(lines);
  }

  return prisma.$transaction(async (tx) => {
    const updatedVoucher = await tx.voucher.update({
      where: { id },
      data: {
        date: date ? new Date(date) : undefined,
        narration: narration !== undefined ? narration : undefined,
      }
    });

    if (lines) {
      await tx.voucherLine.deleteMany({ where: { voucherId: id } });
      for (const line of lines) {
        await tx.voucherLine.create({
          data: {
            voucherId: id,
            ledgerId: line.ledgerId,
            type: line.type,
            amount: line.amount,
            cgstAmount: line.cgstAmount || 0,
            sgstAmount: line.sgstAmount || 0,
            igstAmount: line.igstAmount || 0,
            costCentreId: line.costCentreId || null,
            description: line.description || null,
          }
        });
      }
    }

    return tx.voucher.findUnique({
      where: { id },
      include: { lines: { include: { ledger: true } } }
    });
  });
}

/** Soft-delete ("cancel") a voucher — never hard-delete posted accounting entries. */
export async function deleteVoucher(companyId, id, deletedBy) {
  const voucher = await prisma.voucher.findFirst({
    where: { id, companyId },
    include: { sale: true, purchase: true, payment: true },
  });
  if (!voucher) {
    const err = new Error('Voucher not found.');
    err.status = 404;
    throw err;
  }
  if (voucher.isDeleted) {
    const err = new Error('Voucher is already cancelled.');
    err.status = 400;
    throw err;
  }

  return prisma.$transaction(async (tx) => {
    const cancelled = await tx.voucher.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date(), deletedBy: deletedBy || null },
    });

    if (voucher.sale) await tx.sale.update({ where: { id: voucher.sale.id }, data: { isCancelled: true } });
    if (voucher.purchase) await tx.purchase.update({ where: { id: voucher.purchase.id }, data: { isCancelled: true } });

    return cancelled;
  });
}
