/**
 * reports.service.js
 * Financial reports: Balance Sheet, P&L, Stock Summary, Day Book,
 * Trial Balance, Outstanding Receivables/Payables, Cash Flow,
 * and individual Ledger Statements.
 *
 * All amounts are in paise (BigInt). The UI layer converts to rupees.
 */

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Compute a ledger's closing balance (in paise, as BigInt).
 * Returns { drBalance, crBalance, netDr } where netDr = drBalance - crBalance
 * (positive = net debit, negative = net credit).
 */
function computeLedgerBalance(ledger, voucherLines) {
  // Opening balance contribution
  let drBalance = ledger.openingBalanceType === 'DEBIT'  ? BigInt(ledger.openingBalance) : 0n;
  let crBalance = ledger.openingBalanceType === 'CREDIT' ? BigInt(ledger.openingBalance) : 0n;

  for (const line of voucherLines) {
    if (line.type === 'DEBIT')  drBalance += BigInt(line.amount);
    if (line.type === 'CREDIT') crBalance += BigInt(line.amount);
  }

  return {
    drBalance,
    crBalance,
    netDr: drBalance - crBalance,  // positive = debit balance, negative = credit balance
  };
}

/**
 * Fetch all ledgers with their group nature and voucher lines within a date range.
 */
async function fetchLedgersWithLines(tenantPrisma, companyId, endDate, startDate) {
  return tenantPrisma.ledger.findMany({
    where: { companyId },
    include: {
      group: true,
      voucherLines: {
        where: {
          voucher: {
            isDeleted: false,
            date: {
              ...(startDate ? { gte: new Date(startDate) } : {}),
              ...(endDate   ? { lte: new Date(endDate)   } : {}),
            },
          },
        },
        select: { type: true, amount: true },
      },
    },
  });
}

// ── Balance Sheet ─────────────────────────────────────────────────────────────

export async function getBalanceSheet({ tenantPrisma, companyId, asOfDate }) {
  const ledgers = await fetchLedgersWithLines(tenantPrisma, companyId, asOfDate);

  const assets       = [];
  const liabilities  = [];
  const equity       = [];
  let totalAssets    = 0n;
  let totalLiabEq    = 0n;

  for (const ledger of ledgers) {
    const { netDr, drBalance, crBalance } = computeLedgerBalance(ledger, ledger.voucherLines);
    const entry = {
      id:       ledger.id,
      name:     ledger.name,
      group:    ledger.group.name,
      nature:   ledger.group.nature,
      drBalance: drBalance.toString(),
      crBalance: crBalance.toString(),
      netDr:     netDr.toString(),
    };

    switch (ledger.group.nature) {
      case 'ASSET':
        if (netDr > 0n) { assets.push(entry); totalAssets += netDr; }
        break;
      case 'LIABILITY':
        if (netDr < 0n) { liabilities.push(entry); totalLiabEq += (-netDr); }
        break;
      case 'EQUITY':
        if (netDr < 0n) { equity.push(entry); totalLiabEq += (-netDr); }
        break;
    }
  }

  return {
    asOfDate:       asOfDate || new Date().toISOString(),
    assets:         assets,
    totalAssets:    totalAssets.toString(),
    liabilities:    liabilities,
    equity:         equity,
    totalLiabEq:    totalLiabEq.toString(),
    balanced:       totalAssets === totalLiabEq,
    difference:     (totalAssets - totalLiabEq).toString(),
  };
}

// ── Profit & Loss ─────────────────────────────────────────────────────────────

export async function getProfitLoss({ tenantPrisma, companyId, startDate, endDate }) {
  const ledgers = await fetchLedgersWithLines(tenantPrisma, companyId, endDate, startDate);

  const income   = [];
  const expenses = [];
  let totalIncome   = 0n;
  let totalExpenses = 0n;

  for (const ledger of ledgers) {
    const { netDr, drBalance, crBalance } = computeLedgerBalance(ledger, ledger.voucherLines);
    const entry = {
      id:       ledger.id,
      name:     ledger.name,
      group:    ledger.group.name,
      drBalance: drBalance.toString(),
      crBalance: crBalance.toString(),
      amount:    netDr.toString(),
    };

    if (ledger.group.nature === 'INCOME') {
      // Income: net credit means positive income (netDr negative)
      const incomeAmt = -netDr;
      if (incomeAmt > 0n) { income.push({ ...entry, amount: incomeAmt.toString() }); totalIncome += incomeAmt; }
    } else if (ledger.group.nature === 'EXPENSE') {
      // Expense: net debit is positive expense
      if (netDr > 0n) { expenses.push({ ...entry, amount: netDr.toString() }); totalExpenses += netDr; }
    }
  }

  const grossProfit = totalIncome - totalExpenses;

  return {
    startDate:     startDate || null,
    endDate:       endDate   || null,
    income,
    totalIncome:    totalIncome.toString(),
    expenses,
    totalExpenses:  totalExpenses.toString(),
    netProfit:      grossProfit.toString(),
    isProfit:       grossProfit >= 0n,
  };
}

// ── Stock Summary ─────────────────────────────────────────────────────────────

export async function getStockSummary({ tenantPrisma, companyId, asOfDate }) {
  const items = await tenantPrisma.stockItem.findMany({
    where: { companyId },
    include: {
      unit:       { select: { symbol: true } },
      stockGroup: { select: { name: true } },
      voucherLineItems: {
        where: {
          voucherLine: {
            voucher: {
              isDeleted: false,
              ...(asOfDate ? { date: { lte: new Date(asOfDate) } } : {}),
            },
          },
        },
        include: {
          voucherLine: { select: { type: true, voucher: { select: { type: true } } } },
        },
      },
    },
  });

  return items.map((item) => {
    let inwardQty   = 0;
    let outwardQty  = 0;
    let inwardVal   = 0n;
    let outwardVal  = 0n;

    for (const li of item.voucherLineItems) {
      const vType = li.voucherLine.voucher.type;
      if (['PURCHASE', 'DEBIT_NOTE'].includes(vType)) {
        inwardQty  += Number(li.quantity);
        inwardVal  += BigInt(li.amount);
      } else if (['SALES', 'CREDIT_NOTE'].includes(vType)) {
        outwardQty += Number(li.quantity);
        outwardVal += BigInt(li.amount);
      }
    }

    const openQty = Number(item.openingQuantity);
    const openVal = BigInt(item.openingValue);
    const closingQty = openQty + inwardQty - outwardQty;
    const closingVal = openVal + inwardVal  - outwardVal;

    return {
      id:           item.id,
      name:         item.name,
      group:        item.stockGroup?.name || 'Primary',
      unit:         item.unit?.symbol     || '-',
      openingQty,
      openingVal:   openVal.toString(),
      inwardQty,
      inwardVal:    inwardVal.toString(),
      outwardQty,
      outwardVal:   outwardVal.toString(),
      closingQty,
      closingVal:   closingVal.toString(),
    };
  });
}

// ── Day Book ──────────────────────────────────────────────────────────────────

export async function getDayBook({ tenantPrisma, companyId, date }) {
  const targetDate = date ? new Date(date) : new Date();
  const dayStart   = new Date(targetDate.setHours(0, 0, 0, 0));
  const dayEnd     = new Date(targetDate.setHours(23, 59, 59, 999));

  const vouchers = await tenantPrisma.voucher.findMany({
    where: { companyId, isDeleted: false, date: { gte: dayStart, lte: dayEnd } },
    include: {
      party: { select: { name: true, type: true } },
      lines: {
        include: { ledger: { select: { id: true, name: true } } },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const totalDr = vouchers.reduce((sum, v) =>
    sum + v.lines.filter(l => l.type === 'DEBIT').reduce((s, l) => s + BigInt(l.amount), 0n), 0n);

  return {
    date:          dayStart.toISOString().split('T')[0],
    voucherCount:  vouchers.length,
    totalDebit:    totalDr.toString(),
    totalCredit:   totalDr.toString(), // always equal by double-entry rule
    vouchers,
  };
}

// ── Trial Balance ─────────────────────────────────────────────────────────────

export async function getTrialBalance({ tenantPrisma, companyId, asOfDate }) {
  const ledgers = await fetchLedgersWithLines(tenantPrisma, companyId, asOfDate);

  let totalDr = 0n;
  let totalCr = 0n;

  const rows = ledgers.map((ledger) => {
    const { drBalance, crBalance } = computeLedgerBalance(ledger, ledger.voucherLines);
    // In trial balance, show either Dr or Cr (net)
    const netDr = drBalance - crBalance;
    const drCol = netDr > 0n ? netDr : 0n;
    const crCol = netDr < 0n ? (-netDr) : 0n;
    totalDr += drCol;
    totalCr += crCol;
    return {
      id:     ledger.id,
      name:   ledger.name,
      group:  ledger.group.name,
      nature: ledger.group.nature,
      dr:     drCol.toString(),
      cr:     crCol.toString(),
    };
  });

  return {
    asOfDate:   asOfDate || new Date().toISOString(),
    rows,
    totalDr:    totalDr.toString(),
    totalCr:    totalCr.toString(),
    balanced:   totalDr === totalCr,
    difference: (totalDr - totalCr).toString(),
  };
}

// ── Outstanding Receivables ───────────────────────────────────────────────────

export async function getOutstandingReceivables({ tenantPrisma, companyId, asOfDate }) {
  return getOutstanding(tenantPrisma, companyId, 'CUSTOMER', asOfDate);
}

export async function getOutstandingPayables({ tenantPrisma, companyId, asOfDate }) {
  return getOutstanding(tenantPrisma, companyId, 'SUPPLIER', asOfDate);
}

async function getOutstanding(tenantPrisma, companyId, partyType, asOfDate) {
  const parties = await tenantPrisma.party.findMany({
    where: { companyId, type: { in: partyType === 'CUSTOMER' ? ['CUSTOMER', 'BOTH'] : ['SUPPLIER', 'BOTH'] } },
    include: {
      ledger: {
        include: {
          voucherLines: {
            where: {
              voucher: {
                isDeleted: false,
                ...(asOfDate ? { date: { lte: new Date(asOfDate) } } : {}),
              },
            },
            select: { type: true, amount: true },
          },
        },
      },
    },
  });

  const result = parties.map((party) => {
    const { netDr, drBalance, crBalance } = computeLedgerBalance(party.ledger, party.ledger.voucherLines);
    // Debtors: positive netDr = amount receivable
    // Creditors: negative netDr = amount payable
    const outstanding = partyType === 'CUSTOMER' ? netDr : -netDr;
    return {
      id:          party.id,
      name:        party.name,
      type:        party.type,
      gstin:       party.gstin,
      drBalance:   drBalance.toString(),
      crBalance:   crBalance.toString(),
      outstanding: outstanding.toString(),
    };
  }).filter(p => BigInt(p.outstanding) > 0n);

  const total = result.reduce((s, p) => s + BigInt(p.outstanding), 0n);

  return {
    asOfDate: asOfDate || new Date().toISOString(),
    parties:  result,
    total:    total.toString(),
  };
}

// ── Cash Flow (Simplified) ────────────────────────────────────────────────────

export async function getCashFlow({ tenantPrisma, companyId, startDate, endDate }) {
  // Cash & Bank ledgers
  const cashBankGroups = await tenantPrisma.ledgerGroup.findMany({
    where: { companyId, name: { in: ['Cash-in-Hand', 'Bank Accounts'] } },
  });
  const groupIds = cashBankGroups.map(g => g.id);

  const cashLedgers = await tenantPrisma.ledger.findMany({
    where: { companyId, groupId: { in: groupIds } },
    include: {
      voucherLines: {
        where: {
          voucher: {
            isDeleted: false,
            date: {
              ...(startDate ? { gte: new Date(startDate) } : {}),
              ...(endDate   ? { lte: new Date(endDate)   } : {}),
            },
          },
        },
        include: { voucher: { select: { type: true, narration: true, date: true, voucherNumber: true } } },
      },
    },
  });

  let inflow  = 0n;
  let outflow = 0n;
  const transactions = [];

  for (const ledger of cashLedgers) {
    for (const line of ledger.voucherLines) {
      // For Cash/Bank (ASSET): DEBIT = inflow, CREDIT = outflow
      if (line.type === 'DEBIT') {
        inflow += BigInt(line.amount);
        transactions.push({ direction: 'INFLOW', amount: line.amount.toString(), ledger: ledger.name, voucher: line.voucher });
      } else {
        outflow += BigInt(line.amount);
        transactions.push({ direction: 'OUTFLOW', amount: line.amount.toString(), ledger: ledger.name, voucher: line.voucher });
      }
    }
  }

  return {
    startDate:   startDate || null,
    endDate:     endDate   || null,
    inflow:      inflow.toString(),
    outflow:     outflow.toString(),
    netCashFlow: (inflow - outflow).toString(),
    transactions,
  };
}

// ── Ledger Statement ──────────────────────────────────────────────────────────

export async function getLedgerStatement({ tenantPrisma, ledgerId, companyId, startDate, endDate }) {
  const ledger = await tenantPrisma.ledger.findFirst({
    where: { id: ledgerId, companyId },
    include: { group: true },
  });
  if (!ledger) { const err = new Error('Ledger not found.'); err.status = 404; throw err; }

  const lines = await tenantPrisma.voucherLine.findMany({
    where: {
      ledgerId,
      voucher: {
        isDeleted: false,
        ...(startDate || endDate ? {
          date: {
            ...(startDate ? { gte: new Date(startDate) } : {}),
            ...(endDate   ? { lte: new Date(endDate)   } : {}),
          },
        } : {}),
      },
    },
    include: {
      voucher: { select: { id: true, voucherNumber: true, type: true, date: true, narration: true, party: { select: { name: true } } } },
    },
    orderBy: { voucher: { date: 'asc' } },
  });

  let balance = ledger.openingBalanceType === 'DEBIT' ? BigInt(ledger.openingBalance) : -BigInt(ledger.openingBalance);
  const entries = lines.map((line) => {
    if (line.type === 'DEBIT')  balance += BigInt(line.amount);
    else                        balance -= BigInt(line.amount);
    return {
      ...line,
      amount:         line.amount.toString(),
      runningBalance: balance.toString(),
      balanceType:    balance >= 0n ? 'DR' : 'CR',
    };
  });

  return {
    ledger:         { id: ledger.id, name: ledger.name, group: ledger.group.name, nature: ledger.group.nature },
    openingBalance: ledger.openingBalance.toString(),
    openingType:    ledger.openingBalanceType,
    startDate:      startDate || null,
    endDate:        endDate   || null,
    entries,
    closingBalance: balance.toString(),
    closingType:    balance >= 0n ? 'DR' : 'CR',
  };
}
