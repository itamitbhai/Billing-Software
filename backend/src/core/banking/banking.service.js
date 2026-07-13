/**
 * banking.service.js
 * Bank accounts, statements, and reconciliation.
 */

export async function listBankAccounts({ tenantPrisma, companyId }) {
  return tenantPrisma.bankAccount.findMany({
    where: { companyId },
    include: { ledger: { select: { id: true, name: true } } },
    orderBy: { name: 'asc' },
  });
}

export async function getBankAccount({ tenantPrisma, id, companyId }) {
  const account = await tenantPrisma.bankAccount.findFirst({
    where: { id, companyId },
    include: { ledger: { select: { id: true, name: true } } },
  });
  if (!account) { const err = new Error('Bank account not found.'); err.status = 404; throw err; }
  return account;
}

export async function createBankAccount({ tenantPrisma, companyId, name, ledgerId, bankName, accountNumber, ifsc, branch, openingBalance }) {
  // Verify ledger exists and belongs to "Bank Accounts" group
  const ledger = await tenantPrisma.ledger.findFirst({
    where: { id: ledgerId, companyId },
    include: { group: true },
  });
  if (!ledger) { const err = new Error('Ledger not found.'); err.status = 404; throw err; }
  if (ledger.group.name !== 'Bank Accounts') {
    const err = new Error('The selected ledger must belong to the "Bank Accounts" group.');
    err.status = 400;
    throw err;
  }

  const dup = await tenantPrisma.bankAccount.findFirst({ where: { accountNumber, companyId } });
  if (dup) { const err = new Error('A bank account with this account number already exists.'); err.status = 400; throw err; }

  return tenantPrisma.bankAccount.create({
    data: {
      name, ledgerId, bankName, accountNumber,
      ifsc:           ifsc    || null,
      branch:         branch  || null,
      openingBalance: BigInt(openingBalance || 0),
      companyId,
    },
    include: { ledger: { select: { id: true, name: true } } },
  });
}

export async function updateBankAccount({ tenantPrisma, id, companyId, name, bankName, ifsc, branch, openingBalance }) {
  const account = await tenantPrisma.bankAccount.findFirst({ where: { id, companyId } });
  if (!account) { const err = new Error('Bank account not found.'); err.status = 404; throw err; }
  return tenantPrisma.bankAccount.update({
    where: { id },
    data: {
      name:           name           ?? account.name,
      bankName:       bankName       ?? account.bankName,
      ifsc:           ifsc           ?? account.ifsc,
      branch:         branch         ?? account.branch,
      openingBalance: openingBalance !== undefined ? BigInt(openingBalance) : account.openingBalance,
    },
  });
}

/**
 * Bank Statement — all voucher lines linked to a ledger within a date range.
 * Returns a running balance for each transaction.
 */
export async function getBankStatement({ tenantPrisma, bankAccountId, companyId, startDate, endDate }) {
  const account = await tenantPrisma.bankAccount.findFirst({ where: { id: bankAccountId, companyId } });
  if (!account) { const err = new Error('Bank account not found.'); err.status = 404; throw err; }

  const where = {
    ledgerId: account.ledgerId,
    voucher: { isDeleted: false },
    ...(startDate || endDate ? {
      voucher: {
        isDeleted: false,
        date: {
          ...(startDate ? { gte: new Date(startDate) } : {}),
          ...(endDate   ? { lte: new Date(endDate)   } : {}),
        },
      },
    } : {}),
  };

  const lines = await tenantPrisma.voucherLine.findMany({
    where,
    include: {
      voucher: { select: { id: true, voucherNumber: true, type: true, date: true, narration: true, party: { select: { name: true } } } },
      reconciliation: { select: { isReconciled: true, statementDate: true } },
    },
    orderBy: { voucher: { date: 'asc' } },
  });

  // Compute running balance (opening balance + transactions)
  let balance = account.openingBalance;
  const statement = lines.map((line) => {
    // For a Bank Account (ASSET): DEBIT increases, CREDIT decreases
    if (line.type === 'DEBIT')  balance += line.amount;
    else                        balance -= line.amount;
    return { ...line, runningBalance: balance };
  });

  return {
    bankAccount:    account,
    openingBalance: account.openingBalance,
    closingBalance: balance,
    transactions:   statement,
  };
}

/**
 * Get unreconciled voucher lines for a bank account.
 */
export async function getPendingReconciliation({ tenantPrisma, bankAccountId, companyId }) {
  const account = await tenantPrisma.bankAccount.findFirst({ where: { id: bankAccountId, companyId } });
  if (!account) { const err = new Error('Bank account not found.'); err.status = 404; throw err; }

  const lines = await tenantPrisma.voucherLine.findMany({
    where: {
      ledgerId:       account.ledgerId,
      voucher:        { isDeleted: false },
      reconciliation: { is: null },   // not yet in reconciliation table
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
export async function reconcileEntry({ tenantPrisma, bankAccountId, companyId, voucherLineId, statementDate, statementAmount }) {
  const account = await tenantPrisma.bankAccount.findFirst({ where: { id: bankAccountId, companyId } });
  if (!account) { const err = new Error('Bank account not found.'); err.status = 404; throw err; }

  const line = await tenantPrisma.voucherLine.findFirst({ where: { id: voucherLineId, ledgerId: account.ledgerId } });
  if (!line) { const err = new Error('Voucher line not found or does not belong to this bank account.'); err.status = 404; throw err; }

  // Upsert reconciliation entry
  return tenantPrisma.bankReconciliation.upsert({
    where:  { voucherLineId },
    create: {
      bankAccountId, voucherLineId, companyId,
      statementDate:   statementDate ? new Date(statementDate) : null,
      statementAmount: statementAmount ? BigInt(statementAmount) : null,
      isReconciled:    true,
      reconciledAt:    new Date(),
    },
    update: {
      statementDate:   statementDate ? new Date(statementDate) : null,
      statementAmount: statementAmount ? BigInt(statementAmount) : null,
      isReconciled:    true,
      reconciledAt:    new Date(),
    },
  });
}

/**
 * Cheque register — PAYMENT/RECEIPT vouchers within a date range.
 */
export async function getChequeRegister({ tenantPrisma, companyId, startDate, endDate }) {
  return tenantPrisma.voucher.findMany({
    where: {
      companyId,
      isDeleted: false,
      type:      { in: ['PAYMENT', 'RECEIPT'] },
      ...(startDate || endDate ? {
        date: {
          ...(startDate ? { gte: new Date(startDate) } : {}),
          ...(endDate   ? { lte: new Date(endDate)   } : {}),
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
