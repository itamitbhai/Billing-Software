import { prisma } from '../../shared/database/prisma.js';

const VOUCHER_TYPE_PREFIXES = {
  SALES:       'SL',
  PURCHASE:    'PU',
  RECEIPT:     'RC',
  PAYMENT:     'PY',
  CONTRA:      'CT',
  JOURNAL:     'JL',
  CREDIT_NOTE: 'CN',
  DEBIT_NOTE:  'DN',
};

async function generateVoucherNumber(tx, type) {
  const prefix = VOUCHER_TYPE_PREFIXES[type] || 'VN';
  const count = await tx.voucher.count({ where: { type } });
  return `${prefix}-${String(count + 1).padStart(4, '0')}`;
}

async function getActiveFinancialYear(tx, date) {
  const d = new Date(date);
  const year = d.getFullYear();
  let fyStart, fyEnd;
  if (d.getMonth() >= 3) {
    fyStart = new Date(year, 3, 1);
    fyEnd = new Date(year + 1, 2, 31, 23, 59, 59);
  } else {
    fyStart = new Date(year - 1, 3, 1);
    fyEnd = new Date(year, 2, 31, 23, 59, 59);
  }
  const name = `${fyStart.getFullYear()}-${String(fyEnd.getFullYear()).slice(-2)}`;

  let fy = await tx.financialYear.findUnique({ where: { name } });
  if (!fy) {
    fy = await tx.financialYear.create({
      data: { name, startDate: fyStart, endDate: fyEnd, isActive: true }
    });
  }
  return fy;
}

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

export async function listVouchers({ type, startDate, endDate, page = 1, limit = 50 } = {}) {
  const take = Math.min(parseInt(limit) || 50, 200);
  const skip = (parseInt(page) - 1 || 0) * take;

  const where = {
    ...(type ? { type } : {}),
    ...(startDate || endDate ? {
      date: {
        ...(startDate ? { gte: new Date(startDate) } : {}),
        ...(endDate ? { lte: new Date(endDate) } : {}),
      }
    } : {}),
  };

  const [vouchers, total] = await Promise.all([
    prisma.voucher.findMany({
      where,
      include: {
        lines: {
          include: { ledger: { select: { id: true, name: true } } }
        }
      },
      orderBy: { date: 'desc' },
      take,
      skip,
    }),
    prisma.voucher.count({ where }),
  ]);

  return {
    vouchers,
    total,
    page: parseInt(page) || 1,
    limit: take,
    totalPages: Math.ceil(total / take)
  };
}

export async function getVoucher(id) {
  const voucher = await prisma.voucher.findUnique({
    where: { id },
    include: {
      lines: {
        include: { ledger: true }
      }
    }
  });
  if (!voucher) {
    const err = new Error('Voucher not found.');
    err.status = 404;
    throw err;
  }
  return voucher;
}

export async function createVoucher(data) {
  const { type, date, narration, lines } = data;
  if (!lines || lines.length < 2) {
    const err = new Error('A voucher must contain at least 2 entry lines.');
    err.status = 400;
    throw err;
  }

  validateDoubleEntry(lines);

  return prisma.$transaction(async (tx) => {
    const fy = await getActiveFinancialYear(tx, date);
    const voucherNumber = await generateVoucherNumber(tx, type);

    const voucher = await tx.voucher.create({
      data: {
        voucherNumber,
        type,
        date: new Date(date),
        narration: narration || null,
        financialYearId: fy.id,
      }
    });

    for (const line of lines) {
      await tx.voucherLine.create({
        data: {
          voucherId: voucher.id,
          ledgerId: line.ledgerId,
          type: line.type,
          amount: line.amount,
        }
      });
    }

    return tx.voucher.findUnique({
      where: { id: voucher.id },
      include: { lines: { include: { ledger: true } } }
    });
  });
}

export async function updateVoucher(id, data) {
  const { type, date, narration, lines } = data;
  const voucher = await prisma.voucher.findUnique({ where: { id } });
  if (!voucher) {
    const err = new Error('Voucher not found.');
    err.status = 404;
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
        type: type ?? undefined,
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

export async function deleteVoucher(id) {
  const voucher = await prisma.voucher.findUnique({ where: { id } });
  if (!voucher) {
    const err = new Error('Voucher not found.');
    err.status = 404;
    throw err;
  }
  return prisma.voucher.delete({ where: { id } });
}
