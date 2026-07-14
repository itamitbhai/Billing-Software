/**
 * banking.service.js
 * Bank accounts, statements, and reconciliation.
 */
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../shared/database/prisma.js';

export async function listBankAccounts({ companyId }) {
  return prisma.bankAccount.findMany({
    where: { companyId },
    include: { ledger: { select: { id: true, name: true } } },
    orderBy: { name: 'asc' },
  });
}

export async function getBankAccount({ id, companyId }) {
  const account = await prisma.bankAccount.findFirst({
    where: { id, companyId },
    include: { ledger: { select: { id: true, name: true } } },
  });
  if (!account) { const err = new Error('Bank account not found.'); err.status = 404; throw err; }
  return account;
}

export async function createBankAccount({ companyId, name, ledgerId, bankName, accountNumber, ifsc, branch, openingBalance }) {
  const ledger = await prisma.ledger.findFirst({
    where: { id: ledgerId, companyId },
    include: { group: true },
  });
  if (!ledger) { const err = new Error('Ledger not found.'); err.status = 404; throw err; }
  if (ledger.group.name !== 'Bank Accounts') {
    const err = new Error('The selected ledger must belong to the "Bank Accounts" group.');
    err.status = 400;
    throw err;
  }

  const dup = await prisma.bankAccount.findUnique({ where: { companyId_accountNumber: { companyId, accountNumber } } });
  if (dup) { const err = new Error('A bank account with this account number already exists.'); err.status = 400; throw err; }

  return prisma.bankAccount.create({
    data: {
      companyId, name, ledgerId, bankName, accountNumber,
      ifsc: ifsc || null,
      branch: branch || null,
      openingBalance: openingBalance || 0,
    },
    include: { ledger: { select: { id: true, name: true } } },
  });
}

export async function updateBankAccount({ id, companyId, name, bankName, ifsc, branch, openingBalance }) {
  const account = await prisma.bankAccount.findFirst({ where: { id, companyId } });
  if (!account) { const err = new Error('Bank account not found.'); err.status = 404; throw err; }
  return prisma.bankAccount.update({
    where: { id },
    data: {
      name: name ?? account.name,
      bankName: bankName ?? account.bankName,
      ifsc: ifsc ?? account.ifsc,
      branch: branch ?? account.branch,
      openingBalance: openingBalance !== undefined ? openingBalance : account.openingBalance,
    },
  });
}

/**
 * Bank Statement — all voucher lines linked to a ledger within a date range.
 * Returns a running balance for each transaction.
 */
export async function getBankStatement({ bankAccountId, companyId, startDate, endDate }) {
  const account = await prisma.bankAccount.findFirst({ where: { id: bankAccountId, companyId } });
  if (!account) { const err = new Error('Bank account not found.'); err.status = 404; throw err; }

  const lines = await prisma.voucherLine.findMany({
    where: {
      ledgerId: account.ledgerId,
      voucher: {
        isDeleted: false,
        ...(startDate || endDate ? {
          date: {
            ...(startDate ? { gte: new Date(startDate) } : {}),
            ...(endDate ? { lte: new Date(endDate) } : {}),
          },
        } : {}),
      },
    },
    include: {
      voucher: { select: { id: true, voucherNumber: true, type: true, date: true, narration: true, party: { select: { name: true } } } },
      reconciliation: { select: { isReconciled: true, statementDate: true } },
    },
    orderBy: { voucher: { date: 'asc' } },
  });

  // For a Bank Account (ASSET): DEBIT increases, CREDIT decreases
  let balance = new Decimal(account.openingBalance);
  const statement = lines.map((line) => {
    balance = line.type === 'DEBIT' ? balance.add(line.amount) : balance.sub(line.amount);
    return { ...line, runningBalance: balance.toFixed(2) };
  });

  return {
    bankAccount: account,
    openingBalance: account.openingBalance.toString(),
    closingBalance: balance.toFixed(2),
    transactions: statement,
  };
}

/**
 * Get unreconciled voucher lines for a bank account.
 */
export async function getPendingReconciliation({ bankAccountId, companyId }) {
  const account = await prisma.bankAccount.findFirst({ where: { id: bankAccountId, companyId } });
  if (!account) { const err = new Error('Bank account not found.'); err.status = 404; throw err; }

  const lines = await prisma.voucherLine.findMany({
    where: {
      ledgerId: account.ledgerId,
      voucher: { isDeleted: false },
      reconciliation: { is: null },
    },
    include: {
      voucher: { select: { id: true, voucherNumber: true, type: true, date: true, narration: true } },
    },
    orderBy: { voucher: { date: 'asc' } },
  });

  return lines;
}

/**
 * Mark a voucher line as reconciled with a bank statement entry.
 */
export async function reconcileEntry({ bankAccountId, companyId, voucherLineId, statementDate, statementAmount }) {
  const account = await prisma.bankAccount.findFirst({ where: { id: bankAccountId, companyId } });
  if (!account) { const err = new Error('Bank account not found.'); err.status = 404; throw err; }

  const line = await prisma.voucherLine.findFirst({ where: { id: voucherLineId, ledgerId: account.ledgerId } });
  if (!line) { const err = new Error('Voucher line not found or does not belong to this bank account.'); err.status = 404; throw err; }

  return prisma.bankReconciliation.upsert({
    where: { voucherLineId },
    create: {
      companyId, bankAccountId, voucherLineId,
      statementDate: statementDate ? new Date(statementDate) : null,
      statementAmount: statementAmount ?? null,
      isReconciled: true,
      reconciledAt: new Date(),
    },
    update: {
      statementDate: statementDate ? new Date(statementDate) : null,
      statementAmount: statementAmount ?? null,
      isReconciled: true,
      reconciledAt: new Date(),
    },
  });
}

/**
 * Cheque register — PAYMENT/RECEIPT vouchers within a date range.
 */
export async function getChequeRegister({ companyId, startDate, endDate }) {
  return prisma.voucher.findMany({
    where: {
      companyId,
      isDeleted: false,
      type: { in: ['PAYMENT', 'RECEIPT'] },
      ...(startDate || endDate ? {
        date: {
          ...(startDate ? { gte: new Date(startDate) } : {}),
          ...(endDate ? { lte: new Date(endDate) } : {}),
        },
      } : {}),
    },
    include: {
      party: { select: { id: true, name: true } },
      lines: {
        where: { ledger: { group: { name: 'Bank Accounts' } } },
        include: { ledger: { select: { id: true, name: true } } },
      },
    },
    orderBy: { date: 'desc' },
  });
}
