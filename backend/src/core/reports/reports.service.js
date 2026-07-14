/**
 * reports.service.js
 * Financial reports: Balance Sheet, P&L, Stock Summary, Day Book,
 * Trial Balance, Outstanding Receivables/Payables, Cash Flow,
 * and individual Ledger Statements.
 *
 * All amounts are Decimal(14,2) rupees, computed with Prisma's Decimal
 * type to stay exact (never floating point).
 */
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../shared/database/prisma.js';

const ZERO = new Decimal(0);

// ── Helpers ────────────────────────────────────────────────────────────────────

function computeLedgerBalance(ledger, voucherLines) {
  let drBalance = ledger.openingBalanceType === 'DEBIT' ? new Decimal(ledger.openingBalance) : ZERO;
  let crBalance = ledger.openingBalanceType === 'CREDIT' ? new Decimal(ledger.openingBalance) : ZERO;

  for (const line of voucherLines) {
    if (line.type === 'DEBIT') drBalance = drBalance.add(line.amount);
    if (line.type === 'CREDIT') crBalance = crBalance.add(line.amount);
  }

  return { drBalance, crBalance, netDr: drBalance.sub(crBalance) };
}

async function fetchLedgersWithLines(companyId, endDate, startDate) {
  return prisma.ledger.findMany({
    where: { companyId },
    include: {
      group: true,
      voucherLines: {
        where: {
          voucher: {
            isDeleted: false,
            date: {
              ...(startDate ? { gte: new Date(startDate) } : {}),
              ...(endDate ? { lte: new Date(endDate) } : {}),
            },
          },
        },
        select: { type: true, amount: true },
      },
    },
  });
}

// ── Balance Sheet ─────────────────────────────────────────────────────────────

export async function getBalanceSheet({ companyId, asOfDate }) {
  const ledgers = await fetchLedgersWithLines(companyId, asOfDate);

  const assets = [];
  const liabilities = [];
  const equity = [];
  let totalAssets = ZERO;
  let totalLiabEq = ZERO;
  let totalIncome = ZERO;
  let totalExpenses = ZERO;

  for (const ledger of ledgers) {
    const { netDr, drBalance, crBalance } = computeLedgerBalance(ledger, ledger.voucherLines);
    const entry = {
      id: ledger.id,
      name: ledger.name,
      group: ledger.group.name,
      nature: ledger.group.nature,
      drBalance: drBalance.toFixed(2),
      crBalance: crBalance.toFixed(2),
      netDr: netDr.toFixed(2),
    };

    switch (ledger.group.nature) {
      case 'ASSET':
        if (netDr.gt(0)) { assets.push(entry); totalAssets = totalAssets.add(netDr); }
        break;
      case 'LIABILITY':
        if (netDr.lt(0)) { liabilities.push(entry); totalLiabEq = totalLiabEq.add(netDr.neg()); }
        break;
      case 'EQUITY':
        if (netDr.lt(0)) { equity.push(entry); totalLiabEq = totalLiabEq.add(netDr.neg()); }
        break;
      // Income/Expense ledgers don't sit on the balance sheet directly — their net
      // effect is folded into equity below as the current period's Profit & Loss,
      // which is what makes Assets = Liabilities + Equity hold at any point in time.
      case 'INCOME':
        totalIncome = totalIncome.add(netDr.neg());
        break;
      case 'EXPENSE':
        totalExpenses = totalExpenses.add(netDr);
        break;
    }
  }

  const netProfit = totalIncome.sub(totalExpenses);
  if (!netProfit.eq(0)) {
    equity.push({
      id: null,
      name: 'Profit & Loss A/c (Current Period)',
      group: 'Reserves & Surplus',
      nature: 'EQUITY',
      drBalance: netProfit.lt(0) ? netProfit.neg().toFixed(2) : '0.00',
      crBalance: netProfit.gt(0) ? netProfit.toFixed(2) : '0.00',
      netDr: netProfit.neg().toFixed(2),
    });
    totalLiabEq = totalLiabEq.add(netProfit);
  }

  return {
    asOfDate: asOfDate || new Date().toISOString(),
    assets,
    totalAssets: totalAssets.toFixed(2),
    liabilities,
    equity,
    totalLiabEq: totalLiabEq.toFixed(2),
    balanced: totalAssets.eq(totalLiabEq),
    difference: totalAssets.sub(totalLiabEq).toFixed(2),
  };
}

// ── Profit & Loss ─────────────────────────────────────────────────────────────

export async function getProfitLoss({ companyId, startDate, endDate }) {
  const ledgers = await fetchLedgersWithLines(companyId, endDate, startDate);

  const income = [];
  const expenses = [];
  let totalIncome = ZERO;
  let totalExpenses = ZERO;

  for (const ledger of ledgers) {
    const { netDr, drBalance, crBalance } = computeLedgerBalance(ledger, ledger.voucherLines);
    const base = {
      id: ledger.id,
      name: ledger.name,
      group: ledger.group.name,
      drBalance: drBalance.toFixed(2),
      crBalance: crBalance.toFixed(2),
    };

    if (ledger.group.nature === 'INCOME') {
      const incomeAmt = netDr.neg();
      if (incomeAmt.gt(0)) { income.push({ ...base, amount: incomeAmt.toFixed(2) }); totalIncome = totalIncome.add(incomeAmt); }
    } else if (ledger.group.nature === 'EXPENSE') {
      if (netDr.gt(0)) { expenses.push({ ...base, amount: netDr.toFixed(2) }); totalExpenses = totalExpenses.add(netDr); }
    }
  }

  const netProfit = totalIncome.sub(totalExpenses);

  return {
    startDate: startDate || null,
    endDate: endDate || null,
    income,
    totalIncome: totalIncome.toFixed(2),
    expenses,
    totalExpenses: totalExpenses.toFixed(2),
    netProfit: netProfit.toFixed(2),
    isProfit: netProfit.gte(0),
  };
}

// ── Stock Summary ─────────────────────────────────────────────────────────────

export async function getStockSummary({ companyId, asOfDate }) {
  const products = await prisma.product.findMany({
    where: { companyId },
    include: { batches: { select: { currentQty: true } } },
  });

  const entries = await prisma.stockLedgerEntry.findMany({
    where: {
      companyId,
      ...(asOfDate ? { createdAt: { lte: new Date(asOfDate) } } : {}),
    },
    select: { productId: true, movementType: true, qty: true, rate: true },
  });

  const byProduct = new Map();
  for (const e of entries) {
    if (!byProduct.has(e.productId)) {
      byProduct.set(e.productId, { inwardQty: 0, inwardVal: ZERO, outwardQty: 0, outwardVal: ZERO });
    }
    const agg = byProduct.get(e.productId);
    const value = new Decimal(e.rate).mul(e.qty);
    if (e.movementType === 'IN') {
      agg.inwardQty += e.qty;
      agg.inwardVal = agg.inwardVal.add(value);
    } else {
      agg.outwardQty += e.qty;
      agg.outwardVal = agg.outwardVal.add(value);
    }
  }

  return products.map((product) => {
    const agg = byProduct.get(product.id) || { inwardQty: 0, inwardVal: ZERO, outwardQty: 0, outwardVal: ZERO };
    const closingQty = asOfDate
      ? agg.inwardQty - agg.outwardQty
      : product.batches.reduce((sum, b) => sum + b.currentQty, 0);

    return {
      id: product.id,
      name: product.name,
      unit: product.unit,
      hsnCode: product.hsnCode,
      inwardQty: agg.inwardQty,
      inwardVal: agg.inwardVal.toFixed(2),
      outwardQty: agg.outwardQty,
      outwardVal: agg.outwardVal.toFixed(2),
      closingQty,
    };
  });
}

// ── Day Book ──────────────────────────────────────────────────────────────────

export async function getDayBook({ companyId, date }) {
  const targetDate = date ? new Date(date) : new Date();
  const dayStart = new Date(targetDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(targetDate);
  dayEnd.setHours(23, 59, 59, 999);

  const vouchers = await prisma.voucher.findMany({
    where: { companyId, isDeleted: false, date: { gte: dayStart, lte: dayEnd } },
    include: {
      party: { select: { name: true, type: true } },
      lines: { include: { ledger: { select: { id: true, name: true } } } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const totalDr = vouchers.reduce(
    (sum, v) => sum.add(v.lines.filter((l) => l.type === 'DEBIT').reduce((s, l) => s.add(l.amount), ZERO)),
    ZERO
  );

  return {
    date: dayStart.toISOString().split('T')[0],
    voucherCount: vouchers.length,
    totalDebit: totalDr.toFixed(2),
    totalCredit: totalDr.toFixed(2), // always equal by double-entry rule
    vouchers,
  };
}

// ── Trial Balance ─────────────────────────────────────────────────────────────

export async function getTrialBalance({ companyId, asOfDate }) {
  const ledgers = await fetchLedgersWithLines(companyId, asOfDate);

  let totalDr = ZERO;
  let totalCr = ZERO;

  const rows = ledgers.map((ledger) => {
    const { drBalance, crBalance } = computeLedgerBalance(ledger, ledger.voucherLines);
    const netDr = drBalance.sub(crBalance);
    const drCol = netDr.gt(0) ? netDr : ZERO;
    const crCol = netDr.lt(0) ? netDr.neg() : ZERO;
    totalDr = totalDr.add(drCol);
    totalCr = totalCr.add(crCol);
    return {
      id: ledger.id,
      name: ledger.name,
      group: ledger.group.name,
      nature: ledger.group.nature,
      dr: drCol.toFixed(2),
      cr: crCol.toFixed(2),
    };
  });

  return {
    asOfDate: asOfDate || new Date().toISOString(),
    rows,
    totalDr: totalDr.toFixed(2),
    totalCr: totalCr.toFixed(2),
    balanced: totalDr.eq(totalCr),
    difference: totalDr.sub(totalCr).toFixed(2),
  };
}

// ── Outstanding Receivables / Payables ───────────────────────────────────────

export async function getOutstandingReceivables({ companyId, asOfDate }) {
  return getOutstanding(companyId, 'CUSTOMER', asOfDate);
}

export async function getOutstandingPayables({ companyId, asOfDate }) {
  return getOutstanding(companyId, 'SUPPLIER', asOfDate);
}

async function getOutstanding(companyId, partyType, asOfDate) {
  const parties = await prisma.party.findMany({
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

  const result = parties
    .map((party) => {
      const { netDr, drBalance, crBalance } = computeLedgerBalance(party.ledger, party.ledger.voucherLines);
      const outstanding = partyType === 'CUSTOMER' ? netDr : netDr.neg();
      return {
        id: party.id,
        name: party.name,
        type: party.type,
        gstin: party.gstin,
        drBalance: drBalance.toFixed(2),
        crBalance: crBalance.toFixed(2),
        outstanding: outstanding.toFixed(2),
        _outstanding: outstanding,
      };
    })
    .filter((p) => p._outstanding.gt(0))
    .map(({ _outstanding, ...rest }) => rest);

  const total = result.reduce((s, p) => s.add(p.outstanding), ZERO);

  return {
    asOfDate: asOfDate || new Date().toISOString(),
    parties: result,
    total: total.toFixed(2),
  };
}

// ── Cash Flow (Simplified) ────────────────────────────────────────────────────

export async function getCashFlow({ companyId, startDate, endDate }) {
  const cashBankGroups = await prisma.ledgerGroup.findMany({
    where: { companyId, name: { in: ['Cash-in-Hand', 'Bank Accounts'] } },
  });
  const groupIds = cashBankGroups.map((g) => g.id);

  const cashLedgers = await prisma.ledger.findMany({
    where: { companyId, groupId: { in: groupIds } },
    include: {
      voucherLines: {
        where: {
          voucher: {
            isDeleted: false,
            date: {
              ...(startDate ? { gte: new Date(startDate) } : {}),
              ...(endDate ? { lte: new Date(endDate) } : {}),
            },
          },
        },
        include: { voucher: { select: { type: true, narration: true, date: true, voucherNumber: true } } },
      },
    },
  });

  let inflow = ZERO;
  let outflow = ZERO;
  const transactions = [];

  for (const ledger of cashLedgers) {
    for (const line of ledger.voucherLines) {
      if (line.type === 'DEBIT') {
        inflow = inflow.add(line.amount);
        transactions.push({ direction: 'INFLOW', amount: line.amount.toString(), ledger: ledger.name, voucher: line.voucher });
      } else {
        outflow = outflow.add(line.amount);
        transactions.push({ direction: 'OUTFLOW', amount: line.amount.toString(), ledger: ledger.name, voucher: line.voucher });
      }
    }
  }

  return {
    startDate: startDate || null,
    endDate: endDate || null,
    inflow: inflow.toFixed(2),
    outflow: outflow.toFixed(2),
    netCashFlow: inflow.sub(outflow).toFixed(2),
    transactions,
  };
}

// ── Ledger Statement ──────────────────────────────────────────────────────────

export async function getLedgerStatement({ companyId, ledgerId, startDate, endDate }) {
  const ledger = await prisma.ledger.findFirst({
    where: { id: ledgerId, companyId },
    include: { group: true },
  });
  if (!ledger) { const err = new Error('Ledger not found.'); err.status = 404; throw err; }

  const lines = await prisma.voucherLine.findMany({
    where: {
      ledgerId,
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
    },
    orderBy: { voucher: { date: 'asc' } },
  });

  let balance = ledger.openingBalanceType === 'DEBIT' ? new Decimal(ledger.openingBalance) : new Decimal(ledger.openingBalance).neg();
  const entries = lines.map((line) => {
    balance = line.type === 'DEBIT' ? balance.add(line.amount) : balance.sub(line.amount);
    return {
      ...line,
      amount: line.amount.toString(),
      runningBalance: balance.toFixed(2),
      balanceType: balance.gte(0) ? 'DR' : 'CR',
    };
  });

  return {
    ledger: { id: ledger.id, name: ledger.name, group: ledger.group.name, nature: ledger.group.nature },
    openingBalance: ledger.openingBalance.toString(),
    openingType: ledger.openingBalanceType,
    startDate: startDate || null,
    endDate: endDate || null,
    entries,
    closingBalance: balance.toFixed(2),
    closingType: balance.gte(0) ? 'DR' : 'CR',
  };
}

// ── GST Reports ───────────────────────────────────────────────────────────────
// GST Payable Summary, GSTR-1 (outward supply return), GSTR-3B (summary return).
// These read from the per-line tax breakup billing.service.js writes to
// SaleItem/PurchaseItem, plus the 6 system tax ledgers auto-seeded per company
// (Output/Input CGST/SGST/IGST) for the ledger-based summary.

const TAX_LEDGER_NAMES = {
  outputCgst: 'Output CGST', outputSgst: 'Output SGST', outputIgst: 'Output IGST',
  inputCgst: 'Input CGST', inputSgst: 'Input SGST', inputIgst: 'Input IGST',
};
// Current threshold (rule effective 01-Jan-2022) for classifying an unregistered,
// inter-state sale as B2CL (invoice-wise) vs B2CS (state+rate summary) in GSTR-1.
const B2CL_THRESHOLD = new Decimal(100000);

function gstPeriodRange(month, year) {
  const startDate = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
  const endDate = new Date(Date.UTC(Number(year), Number(month), 0, 23, 59, 59, 999));
  return { startDate, endDate };
}

function newTaxBucket() {
  return { taxableValue: ZERO, cgst: ZERO, sgst: ZERO, igst: ZERO };
}

function formatTaxBucket(b) {
  return {
    taxableValue: b.taxableValue.toFixed(2),
    cgst: b.cgst.toFixed(2),
    sgst: b.sgst.toFixed(2),
    igst: b.igst.toFixed(2),
    total: b.taxableValue.add(b.cgst).add(b.sgst).add(b.igst).toFixed(2),
  };
}

function formatTaxHead(h) {
  return { cgst: h.cgst.toFixed(2), sgst: h.sgst.toFixed(2), igst: h.igst.toFixed(2), total: h.cgst.add(h.sgst).add(h.igst).toFixed(2) };
}

// ── GST Payable Summary ─────────────────────────────────────────────────────
// The direct "how much GST do I need to pay" view: net movement on the 6 system
// tax ledgers over the period (Output = liability, grows on CREDIT; Input = ITC
// asset, grows on DEBIT).

export async function getGstSummary({ companyId, startDate, endDate }) {
  const ledgers = await prisma.ledger.findMany({
    where: { companyId, name: { in: Object.values(TAX_LEDGER_NAMES) } },
    include: {
      voucherLines: {
        where: {
          voucher: {
            isDeleted: false,
            date: {
              ...(startDate ? { gte: new Date(startDate) } : {}),
              ...(endDate ? { lte: new Date(endDate) } : {}),
            },
          },
        },
        select: { type: true, amount: true },
      },
    },
  });

  const byName = new Map(ledgers.map((l) => [l.name, l]));
  const netCredit = (name) => {
    const ledger = byName.get(name);
    if (!ledger) return ZERO;
    return ledger.voucherLines.reduce((sum, line) => (line.type === 'CREDIT' ? sum.add(line.amount) : sum.sub(line.amount)), ZERO);
  };

  const outputTax = {
    cgst: netCredit(TAX_LEDGER_NAMES.outputCgst),
    sgst: netCredit(TAX_LEDGER_NAMES.outputSgst),
    igst: netCredit(TAX_LEDGER_NAMES.outputIgst),
  };
  const inputTaxCredit = {
    cgst: netCredit(TAX_LEDGER_NAMES.inputCgst).neg(),
    sgst: netCredit(TAX_LEDGER_NAMES.inputSgst).neg(),
    igst: netCredit(TAX_LEDGER_NAMES.inputIgst).neg(),
  };
  const netPayable = {
    cgst: outputTax.cgst.sub(inputTaxCredit.cgst),
    sgst: outputTax.sgst.sub(inputTaxCredit.sgst),
    igst: outputTax.igst.sub(inputTaxCredit.igst),
  };

  return {
    startDate: startDate || null,
    endDate: endDate || null,
    outputTax: formatTaxHead(outputTax),
    inputTaxCredit: formatTaxHead(inputTaxCredit),
    // Negative netPayable means excess ITC carried forward to the next period.
    netPayable: formatTaxHead(netPayable),
  };
}

// ── GSTR-1 (Outward Supply Return) ──────────────────────────────────────────

export async function getGstr1({ companyId, month, year }) {
  const { startDate, endDate } = gstPeriodRange(month, year);
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { state: true } });
  const companyState = (company?.state || '').trim().toLowerCase();

  const sales = await prisma.sale.findMany({
    where: { companyId, isCancelled: false, saleDate: { gte: startDate, lte: endDate } },
    include: { customer: { select: { name: true, gstin: true } }, items: true },
    orderBy: { saleDate: 'asc' },
  });

  const b2bByGstin = new Map();
  const b2cl = [];
  const b2csMap = new Map();

  for (const sale of sales) {
    const taxableValue = sale.items.reduce((s, i) => s.add(i.taxableValue), ZERO);
    const cgst = sale.items.reduce((s, i) => s.add(i.cgstAmount), ZERO);
    const sgst = sale.items.reduce((s, i) => s.add(i.sgstAmount), ZERO);
    const igst = sale.items.reduce((s, i) => s.add(i.igstAmount), ZERO);
    const isInterState = sale.placeOfSupply ? sale.placeOfSupply.trim().toLowerCase() !== companyState : false;

    const invoiceRow = {
      invoiceNumber: sale.invoiceNumber,
      saleDate: sale.saleDate,
      placeOfSupply: sale.placeOfSupply,
      taxableValue: taxableValue.toFixed(2),
      cgst: cgst.toFixed(2),
      sgst: sgst.toFixed(2),
      igst: igst.toFixed(2),
      total: sale.totalAmount.toFixed(2),
    };

    if (sale.customer.gstin) {
      const key = sale.customer.gstin;
      if (!b2bByGstin.has(key)) {
        b2bByGstin.set(key, { gstin: key, partyName: sale.customer.name, invoices: [], ...newTaxBucket() });
      }
      const group = b2bByGstin.get(key);
      group.invoices.push(invoiceRow);
      group.taxableValue = group.taxableValue.add(taxableValue);
      group.cgst = group.cgst.add(cgst);
      group.sgst = group.sgst.add(sgst);
      group.igst = group.igst.add(igst);
    } else if (isInterState && new Decimal(sale.totalAmount).gt(B2CL_THRESHOLD)) {
      b2cl.push(invoiceRow);
    } else {
      for (const item of sale.items) {
        const key = `${sale.placeOfSupply}|${item.gstRate.toString()}`;
        if (!b2csMap.has(key)) b2csMap.set(key, { placeOfSupply: sale.placeOfSupply, gstRate: item.gstRate.toFixed(2), ...newTaxBucket() });
        const bucket = b2csMap.get(key);
        bucket.taxableValue = bucket.taxableValue.add(item.taxableValue);
        bucket.cgst = bucket.cgst.add(item.cgstAmount);
        bucket.sgst = bucket.sgst.add(item.sgstAmount);
        bucket.igst = bucket.igst.add(item.igstAmount);
      }
    }
  }

  const b2b = [...b2bByGstin.values()].map(({ gstin, partyName, invoices, ...bucket }) => ({
    gstin, partyName, invoices, ...formatTaxBucket(bucket),
  }));
  const b2cs = [...b2csMap.values()].map(({ placeOfSupply, gstRate, ...bucket }) => ({
    placeOfSupply, gstRate, ...formatTaxBucket(bucket),
  }));

  // HSN-wise summary across all line items in the period.
  const hsnMap = new Map();
  for (const sale of sales) {
    for (const item of sale.items) {
      const key = `${item.hsnCode || 'N/A'}|${item.gstRate.toString()}`;
      if (!hsnMap.has(key)) hsnMap.set(key, { hsnCode: item.hsnCode || 'N/A', gstRate: item.gstRate.toFixed(2), qty: 0, ...newTaxBucket() });
      const bucket = hsnMap.get(key);
      bucket.qty += item.qty;
      bucket.taxableValue = bucket.taxableValue.add(item.taxableValue);
      bucket.cgst = bucket.cgst.add(item.cgstAmount);
      bucket.sgst = bucket.sgst.add(item.sgstAmount);
      bucket.igst = bucket.igst.add(item.igstAmount);
    }
  }
  const hsn = [...hsnMap.values()].map(({ hsnCode, gstRate, qty, ...bucket }) => ({
    hsnCode, gstRate, qty, ...formatTaxBucket(bucket),
  }));

  // Credit/Debit notes — recorded via the generic Voucher API (CREDIT_NOTE/DEBIT_NOTE),
  // classified CDNR (registered party) vs CDNUR (unregistered) by the party's GSTIN.
  const notes = await prisma.voucher.findMany({
    where: { companyId, isDeleted: false, type: { in: ['CREDIT_NOTE', 'DEBIT_NOTE'] }, partyId: { not: null }, date: { gte: startDate, lte: endDate } },
    include: { party: { select: { name: true, gstin: true, ledgerId: true } }, lines: true },
    orderBy: { date: 'asc' },
  });

  const cdnr = [];
  const cdnur = [];
  for (const note of notes) {
    const bucket = newTaxBucket();
    for (const line of note.lines) {
      const lineTax = line.cgstAmount.add(line.sgstAmount).add(line.igstAmount);
      if (lineTax.gt(0)) {
        bucket.cgst = bucket.cgst.add(line.cgstAmount);
        bucket.sgst = bucket.sgst.add(line.sgstAmount);
        bucket.igst = bucket.igst.add(line.igstAmount);
      } else if (line.ledgerId !== note.party?.ledgerId) {
        bucket.taxableValue = bucket.taxableValue.add(line.amount);
      }
    }
    const row = {
      voucherNumber: note.voucherNumber,
      type: note.type,
      date: note.date,
      partyName: note.party?.name || null,
      gstin: note.party?.gstin || null,
      ...formatTaxBucket(bucket),
    };
    if (note.party?.gstin) cdnr.push(row); else cdnur.push(row);
  }

  const cancelledCount = await prisma.sale.count({ where: { companyId, isCancelled: true, saleDate: { gte: startDate, lte: endDate } } });

  return {
    month: Number(month),
    year: Number(year),
    startDate,
    endDate,
    b2b,
    b2cl,
    b2cs,
    cdnr,
    cdnur,
    hsn,
    docsIssued: {
      count: sales.length,
      fromInvoice: sales[0]?.invoiceNumber || null,
      toInvoice: sales[sales.length - 1]?.invoiceNumber || null,
      cancelledCount,
    },
  };
}

// ── GSTR-3B (Summary Return) ────────────────────────────────────────────────

export async function getGstr3b({ companyId, month, year }) {
  const { startDate, endDate } = gstPeriodRange(month, year);

  const sales = await prisma.sale.findMany({
    where: { companyId, isCancelled: false, saleDate: { gte: startDate, lte: endDate } },
    select: { supplyType: true, items: { select: { taxableValue: true, cgstAmount: true, sgstAmount: true, igstAmount: true } } },
  });

  const outwardTaxable = newTaxBucket();
  const outwardZeroRated = newTaxBucket();
  const outwardNilExempt = newTaxBucket();
  const outwardNonGst = newTaxBucket();

  for (const sale of sales) {
    let bucket;
    if (sale.supplyType === 'TAXABLE') bucket = outwardTaxable;
    else if (sale.supplyType === 'ZERO_RATED_EXPORT' || sale.supplyType === 'ZERO_RATED_SEZ') bucket = outwardZeroRated;
    else if (sale.supplyType === 'EXEMPT' || sale.supplyType === 'NIL_RATED') bucket = outwardNilExempt;
    else bucket = outwardNonGst;

    for (const item of sale.items) {
      bucket.taxableValue = bucket.taxableValue.add(item.taxableValue);
      bucket.cgst = bucket.cgst.add(item.cgstAmount);
      bucket.sgst = bucket.sgst.add(item.sgstAmount);
      bucket.igst = bucket.igst.add(item.igstAmount);
    }
  }

  // 3.1(d) Inward supplies liable to reverse charge (recipient pays as if it were output tax).
  const rcmPurchases = await prisma.purchase.findMany({
    where: { companyId, isCancelled: false, reverseCharge: true, purchaseDate: { gte: startDate, lte: endDate } },
    select: { items: { select: { taxableValue: true, cgstAmount: true, sgstAmount: true, igstAmount: true } } },
  });
  const inwardReverseCharge = newTaxBucket();
  for (const purchase of rcmPurchases) {
    for (const item of purchase.items) {
      inwardReverseCharge.taxableValue = inwardReverseCharge.taxableValue.add(item.taxableValue);
      inwardReverseCharge.cgst = inwardReverseCharge.cgst.add(item.cgstAmount);
      inwardReverseCharge.sgst = inwardReverseCharge.sgst.add(item.sgstAmount);
      inwardReverseCharge.igst = inwardReverseCharge.igst.add(item.igstAmount);
    }
  }

  // Table 4: ITC available vs reversed (blocked credits flagged itcEligible=false on the item).
  const purchaseItems = await prisma.purchaseItem.findMany({
    where: { purchase: { companyId, isCancelled: false, purchaseDate: { gte: startDate, lte: endDate } } },
    select: { itcEligible: true, cgstAmount: true, sgstAmount: true, igstAmount: true },
  });
  const itcAvailable = newTaxBucket();
  const itcReversed = newTaxBucket();
  for (const item of purchaseItems) {
    const target = item.itcEligible ? itcAvailable : itcReversed;
    target.cgst = target.cgst.add(item.cgstAmount);
    target.sgst = target.sgst.add(item.sgstAmount);
    target.igst = target.igst.add(item.igstAmount);
  }

  // Table 6.1: net tax payable = output tax (incl. RCM liability) − ITC available.
  // Negative means excess ITC carried forward, not cash payable.
  const netTaxPayable = {
    cgst: outwardTaxable.cgst.add(inwardReverseCharge.cgst).sub(itcAvailable.cgst),
    sgst: outwardTaxable.sgst.add(inwardReverseCharge.sgst).sub(itcAvailable.sgst),
    igst: outwardTaxable.igst.add(inwardReverseCharge.igst).sub(itcAvailable.igst),
  };

  return {
    month: Number(month),
    year: Number(year),
    startDate,
    endDate,
    outwardTaxableSupplies: formatTaxBucket(outwardTaxable),
    outwardZeroRatedSupplies: formatTaxBucket(outwardZeroRated),
    outwardNilExemptSupplies: formatTaxBucket(outwardNilExempt),
    outwardNonGstSupplies: formatTaxBucket(outwardNonGst),
    inwardReverseCharge: formatTaxBucket(inwardReverseCharge),
    itcAvailable: formatTaxHead(itcAvailable),
    itcReversed: formatTaxHead(itcReversed),
    netTaxPayable: formatTaxHead(netTaxPayable),
  };
}
