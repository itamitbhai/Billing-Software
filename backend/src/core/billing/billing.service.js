import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../shared/database/prisma.js';
import { paginate, paginatedResult } from '../../shared/utils/pagination.js';
import { getOrCreateFinancialYear, nextVoucherNumber, formatInvoiceNumber } from '../../shared/utils/voucher-sequence.js';
import { recordStockMovement } from '../../shared/utils/stock-ledger.js';

const ZERO = new Decimal(0);

// ============================================
// HELPERS
// ============================================

async function getOrCreateSystemLedger(tx, companyId, ledgerName, groupName, nature) {
  let ledger = await tx.ledger.findUnique({ where: { companyId_name: { companyId, name: ledgerName } } });
  if (!ledger) {
    let group = await tx.ledgerGroup.findUnique({ where: { companyId_name: { companyId, name: groupName } } });
    if (!group) {
      group = await tx.ledgerGroup.create({ data: { companyId, name: groupName, nature, isSystem: true } });
    }
    ledger = await tx.ledger.create({
      data: { companyId, name: ledgerName, groupId: group.id, openingBalance: 0, openingBalanceType: 'DEBIT', isSystem: true },
    });
  }
  return ledger;
}

/** Intra-state sales/purchases split GST into CGST+SGST; inter-state uses IGST. */
async function isIntraState(companyId, otherPartyState) {
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { state: true } });
  if (!company?.state || !otherPartyState) return true; // default to CGST/SGST when state is unknown
  return company.state.trim().toLowerCase() === otherPartyState.trim().toLowerCase();
}

/**
 * Prices each line from its own product's HSN/GST rate (never trusts a client-supplied
 * tax amount) and splits the tax into CGST+SGST (intra-state) or IGST (inter-state).
 * Each line keeps its own taxable value/rate/tax split, since a single blended
 * per-invoice total can't be reconstructed into a rate-wise/HSN-wise GST return once an
 * invoice mixes products taxed at different rates. `forceZeroTax` is used for Sale
 * invoices classified as zero-rated/exempt/nil-rated/non-GST — no tax applies to those
 * regardless of the product's configured rate.
 */
async function priceItems(companyId, items, { intraState, forceZeroTax = false } = {}) {
  let subTotal = ZERO, cgstTotal = ZERO, sgstTotal = ZERO, igstTotal = ZERO;
  const priced = [];

  for (const item of items) {
    const batch = await prisma.batch.findFirst({ where: { id: item.batchId, companyId }, include: { product: true } });
    if (!batch) {
      const err = new Error(`Batch ID ${item.batchId} not found.`);
      err.status = 400;
      throw err;
    }

    const qty = new Decimal(item.qty);
    const rate = new Decimal(item.rate);
    const taxableValue = qty.mul(rate);
    const gstRate = forceZeroTax ? ZERO : new Decimal(item.gstRate ?? batch.product.gstRate);
    const taxAmount = taxableValue.mul(gstRate).div(100);

    let cgstAmount = ZERO, sgstAmount = ZERO, igstAmount = ZERO;
    if (taxAmount.gt(0)) {
      if (intraState) {
        cgstAmount = taxAmount.div(2);
        sgstAmount = taxAmount.sub(cgstAmount);
      } else {
        igstAmount = taxAmount;
      }
    }
    const gstAmount = cgstAmount.add(sgstAmount).add(igstAmount);

    subTotal = subTotal.add(taxableValue);
    cgstTotal = cgstTotal.add(cgstAmount);
    sgstTotal = sgstTotal.add(sgstAmount);
    igstTotal = igstTotal.add(igstAmount);

    priced.push({
      ...item,
      batch,
      hsnCode: batch.product.hsnCode || null,
      taxableValue,
      gstRate,
      gstAmount,
      cgstAmount,
      sgstAmount,
      igstAmount,
      amount: taxableValue.add(gstAmount),
      itcEligible: item.itcEligible !== false,
    });
  }

  const gstAmount = cgstTotal.add(sgstTotal).add(igstTotal);
  return { priced, subTotal, gstAmount, cgstTotal, sgstTotal, igstTotal, totalAmount: subTotal.add(gstAmount) };
}

async function postGstLines(tx, { voucherId, companyId, cgstTotal, sgstTotal, igstTotal, direction }) {
  // direction: 'OUTPUT' (sales, liability increases on CREDIT) | 'INPUT' (purchase, ITC asset increases on DEBIT)
  const entryType = direction === 'OUTPUT' ? 'CREDIT' : 'DEBIT';
  const groupName = direction === 'OUTPUT' ? 'Duties & Taxes' : 'Duties & Taxes (Input)';
  const nature = direction === 'OUTPUT' ? 'LIABILITY' : 'ASSET';
  const prefix = direction === 'OUTPUT' ? 'Output' : 'Input';

  if (cgstTotal.gt(0)) {
    const ledger = await getOrCreateSystemLedger(tx, companyId, `${prefix} CGST`, groupName, nature);
    await tx.voucherLine.create({ data: { voucherId, ledgerId: ledger.id, type: entryType, amount: cgstTotal, cgstAmount: cgstTotal } });
  }
  if (sgstTotal.gt(0)) {
    const ledger = await getOrCreateSystemLedger(tx, companyId, `${prefix} SGST`, groupName, nature);
    await tx.voucherLine.create({ data: { voucherId, ledgerId: ledger.id, type: entryType, amount: sgstTotal, sgstAmount: sgstTotal } });
  }
  if (igstTotal.gt(0)) {
    const ledger = await getOrCreateSystemLedger(tx, companyId, `${prefix} IGST`, groupName, nature);
    await tx.voucherLine.create({ data: { voucherId, ledgerId: ledger.id, type: entryType, amount: igstTotal, igstAmount: igstTotal } });
  }
}

// ============================================
// PURCHASES (Stock IN)
// ============================================

export async function createPurchase(companyId, { supplierId, billNumber, purchaseDate, items, reverseCharge }, createdBy) {
  const supplier = await prisma.party.findFirst({ where: { id: supplierId, companyId } });
  if (!supplier || (supplier.type !== 'SUPPLIER' && supplier.type !== 'BOTH')) {
    const err = new Error('Valid supplier not found.');
    err.status = 400;
    throw err;
  }

  const duplicateBill = await prisma.purchase.findUnique({
    where: { companyId_supplierId_billNumber: { companyId, supplierId, billNumber } },
  });
  if (duplicateBill) {
    const err = new Error(`Bill number "${billNumber}" has already been recorded for this supplier.`);
    err.status = 400;
    throw err;
  }

  const intraState = await isIntraState(companyId, supplier.state);
  const { priced, subTotal, gstAmount, cgstTotal, sgstTotal, igstTotal, totalAmount } = await priceItems(companyId, items, { intraState });

  return prisma.$transaction(async (tx) => {
    const fy = await getOrCreateFinancialYear(tx, companyId, purchaseDate);
    const purchaseLedger = await getOrCreateSystemLedger(tx, companyId, 'Purchase Ledger', 'Purchase Accounts', 'EXPENSE');

    const { voucherNumber } = await nextVoucherNumber(tx, { companyId, financialYear: fy, type: 'PURCHASE' });

    const voucher = await tx.voucher.create({
      data: {
        companyId,
        voucherNumber,
        type: 'PURCHASE',
        date: new Date(purchaseDate),
        narration: `Purchase Bill: ${billNumber}`,
        partyId: supplierId,
        financialYearId: fy.id,
        createdBy: createdBy || null,
      },
    });

    // Debit: Purchase Ledger (taxable value) + Input GST
    await tx.voucherLine.create({ data: { voucherId: voucher.id, ledgerId: purchaseLedger.id, type: 'DEBIT', amount: subTotal } });
    await postGstLines(tx, { voucherId: voucher.id, companyId, cgstTotal, sgstTotal, igstTotal, direction: 'INPUT' });
    // Credit: Supplier Ledger (total payable)
    await tx.voucherLine.create({ data: { voucherId: voucher.id, ledgerId: supplier.ledgerId, type: 'CREDIT', amount: totalAmount } });

    const purchase = await tx.purchase.create({
      data: {
        companyId,
        financialYearId: fy.id,
        supplierId,
        billNumber,
        purchaseDate: new Date(purchaseDate),
        subTotal,
        gstAmount,
        totalAmount,
        reverseCharge: !!reverseCharge,
        voucherId: voucher.id,
        createdBy: createdBy || null,
      },
    });

    for (const item of priced) {
      await tx.purchaseItem.create({
        data: {
          purchaseId: purchase.id,
          batchId: item.batchId,
          qty: item.qty,
          rate: item.rate,
          gstAmount: item.gstAmount,
          amount: item.amount,
          hsnCode: item.hsnCode,
          taxableValue: item.taxableValue,
          gstRate: item.gstRate,
          cgstAmount: item.cgstAmount,
          sgstAmount: item.sgstAmount,
          igstAmount: item.igstAmount,
          itcEligible: item.itcEligible,
        },
      });

      await recordStockMovement(tx, {
        companyId,
        productId: item.batch.productId,
        batchId: item.batchId,
        movementType: 'IN',
        referenceType: 'PURCHASE',
        referenceId: purchase.id,
        qty: item.qty,
        rate: item.rate,
      });
    }

    return tx.purchase.findUnique({
      where: { id: purchase.id },
      include: {
        supplier: { select: { name: true } },
        items: { include: { batch: { select: { batchNumber: true } } } },
      },
    });
  });
}

export async function listPurchases({ companyId, page, limit }) {
  const { take, skip, page: currentPage } = paginate({ page, limit });
  const where = { companyId };

  const [rows, total] = await Promise.all([
    prisma.purchase.findMany({
      where,
      include: { supplier: { select: { name: true } } },
      orderBy: { purchaseDate: 'desc' },
      take,
      skip,
    }),
    prisma.purchase.count({ where }),
  ]);

  return paginatedResult({ rows, total, page: currentPage, limit: take });
}

export async function getPurchase(companyId, id) {
  const purchase = await prisma.purchase.findFirst({
    where: { id, companyId },
    include: {
      supplier: true,
      items: { include: { batch: { include: { product: true } } } },
    },
  });
  if (!purchase) {
    const err = new Error('Purchase not found.');
    err.status = 404;
    throw err;
  }
  return purchase;
}

// ============================================
// SALES (Stock OUT)
// ============================================

export async function createSale(companyId, { customerId, saleDate, items, placeOfSupply, supplyType }, createdBy) {
  const customer = await prisma.party.findFirst({ where: { id: customerId, companyId } });
  if (!customer || (customer.type !== 'CUSTOMER' && customer.type !== 'BOTH')) {
    const err = new Error('Valid customer not found.');
    err.status = 400;
    throw err;
  }

  const resolvedSupplyType = supplyType || 'TAXABLE';
  const resolvedPlaceOfSupply = placeOfSupply || customer.state || '';
  const intraState = await isIntraState(companyId, resolvedPlaceOfSupply);
  const forceZeroTax = resolvedSupplyType !== 'TAXABLE';
  const { priced, subTotal, gstAmount, cgstTotal, sgstTotal, igstTotal, totalAmount } =
    await priceItems(companyId, items, { intraState, forceZeroTax });

  return prisma.$transaction(async (tx) => {
    // Validate stock availability up front so the whole sale fails cleanly.
    for (const item of priced) {
      const batch = await tx.batch.findFirst({ where: { id: item.batchId, companyId } });
      if (!batch) {
        const err = new Error(`Batch ID ${item.batchId} not found.`);
        err.status = 400;
        throw err;
      }
      if (batch.currentQty < item.qty) {
        const err = new Error(`Insufficient stock in Batch ${batch.batchNumber}. Available: ${batch.currentQty}, Requested: ${item.qty}`);
        err.status = 400;
        throw err;
      }
    }

    const company = await tx.company.findUnique({ where: { id: companyId }, select: { invoicePrefix: true } });
    const fy = await getOrCreateFinancialYear(tx, companyId, saleDate);
    const salesLedger = await getOrCreateSystemLedger(tx, companyId, 'Sales Ledger', 'Sales Accounts', 'INCOME');

    const { voucherNumber, number } = await nextVoucherNumber(tx, { companyId, financialYear: fy, type: 'SALES' });
    const invoiceNumber = formatInvoiceNumber(company.invoicePrefix, fy, number);

    const voucher = await tx.voucher.create({
      data: {
        companyId,
        voucherNumber,
        type: 'SALES',
        date: new Date(saleDate),
        narration: `Sales Invoice: ${invoiceNumber}`,
        partyId: customerId,
        financialYearId: fy.id,
        createdBy: createdBy || null,
      },
    });

    // Debit: Customer Ledger (total receivable)
    await tx.voucherLine.create({ data: { voucherId: voucher.id, ledgerId: customer.ledgerId, type: 'DEBIT', amount: totalAmount } });
    // Credit: Sales Ledger (taxable value) + Output GST
    await tx.voucherLine.create({ data: { voucherId: voucher.id, ledgerId: salesLedger.id, type: 'CREDIT', amount: subTotal } });
    await postGstLines(tx, { voucherId: voucher.id, companyId, cgstTotal, sgstTotal, igstTotal, direction: 'OUTPUT' });

    const sale = await tx.sale.create({
      data: {
        companyId,
        financialYearId: fy.id,
        customerId,
        invoiceNumber,
        saleDate: new Date(saleDate),
        subTotal,
        gstAmount,
        totalAmount,
        status: 'UNPAID',
        placeOfSupply: resolvedPlaceOfSupply,
        supplyType: resolvedSupplyType,
        voucherId: voucher.id,
        createdBy: createdBy || null,
      },
    });

    for (const item of priced) {
      await tx.saleItem.create({
        data: {
          saleId: sale.id,
          batchId: item.batchId,
          qty: item.qty,
          rate: item.rate,
          gstAmount: item.gstAmount,
          amount: item.amount,
          hsnCode: item.hsnCode,
          taxableValue: item.taxableValue,
          gstRate: item.gstRate,
          cgstAmount: item.cgstAmount,
          sgstAmount: item.sgstAmount,
          igstAmount: item.igstAmount,
        },
      });

      await recordStockMovement(tx, {
        companyId,
        productId: item.batch.productId,
        batchId: item.batchId,
        movementType: 'OUT',
        referenceType: 'SALE',
        referenceId: sale.id,
        qty: item.qty,
        rate: item.rate,
      });
    }

    return tx.sale.findUnique({
      where: { id: sale.id },
      include: {
        customer: { select: { name: true } },
        items: { include: { batch: { select: { batchNumber: true } } } },
      },
    });
  });
}

export async function listSales({ companyId, status, page, limit }) {
  const { take, skip, page: currentPage } = paginate({ page, limit });
  const where = { companyId, ...(status ? { status } : {}) };

  const [rows, total] = await Promise.all([
    prisma.sale.findMany({
      where,
      include: { customer: { select: { name: true } } },
      orderBy: { saleDate: 'desc' },
      take,
      skip,
    }),
    prisma.sale.count({ where }),
  ]);

  return paginatedResult({ rows, total, page: currentPage, limit: take });
}

export async function getSale(companyId, id) {
  const sale = await prisma.sale.findFirst({
    where: { id, companyId },
    include: {
      customer: true,
      items: { include: { batch: { include: { product: true } } } },
      payments: true,
    },
  });
  if (!sale) {
    const err = new Error('Sale not found.');
    err.status = 404;
    throw err;
  }
  return sale;
}

// ============================================
// PAYMENTS
// ============================================

export async function createPayment(companyId, { partyId, saleId, amount, method, referenceNumber, paymentDate, notes }, recordedById) {
  const party = await prisma.party.findFirst({ where: { id: partyId, companyId } });
  if (!party) {
    const err = new Error('Party not found.');
    err.status = 400;
    throw err;
  }

  if (saleId) {
    const sale = await prisma.sale.findFirst({ where: { id: saleId, companyId } });
    if (!sale) {
      const err = new Error('Sale not found for this company.');
      err.status = 400;
      throw err;
    }
  }

  return prisma.$transaction(async (tx) => {
    const fy = await getOrCreateFinancialYear(tx, companyId, paymentDate);

    const isReceipt = party.type === 'CUSTOMER' || party.type === 'BOTH';
    const vType = isReceipt ? 'RECEIPT' : 'PAYMENT';

    const isCash = method === 'CASH';
    const cashBankLedgerName = isCash ? 'Cash' : 'Bank Account Ledger';
    const cashBankGroupName = isCash ? 'Cash-in-Hand' : 'Bank Accounts';
    const cashBankLedger = await getOrCreateSystemLedger(tx, companyId, cashBankLedgerName, cashBankGroupName, 'ASSET');

    const { voucherNumber } = await nextVoucherNumber(tx, { companyId, financialYear: fy, type: vType });
    const refText = referenceNumber ? ` Ref: ${referenceNumber}` : '';

    const voucher = await tx.voucher.create({
      data: {
        companyId,
        voucherNumber,
        type: vType,
        date: new Date(paymentDate),
        narration: `${vType} ${isReceipt ? 'from' : 'to'} ${party.name}.${refText}`,
        partyId,
        financialYearId: fy.id,
        createdBy: recordedById || null,
      },
    });

    if (isReceipt) {
      await tx.voucherLine.create({ data: { voucherId: voucher.id, ledgerId: cashBankLedger.id, type: 'DEBIT', amount } });
      await tx.voucherLine.create({ data: { voucherId: voucher.id, ledgerId: party.ledgerId, type: 'CREDIT', amount } });
    } else {
      await tx.voucherLine.create({ data: { voucherId: voucher.id, ledgerId: party.ledgerId, type: 'DEBIT', amount } });
      await tx.voucherLine.create({ data: { voucherId: voucher.id, ledgerId: cashBankLedger.id, type: 'CREDIT', amount } });
    }

    const payment = await tx.payment.create({
      data: {
        companyId,
        partyId,
        saleId: saleId || null,
        voucherId: voucher.id,
        amount,
        method,
        referenceNumber: referenceNumber || null,
        paymentDate: new Date(paymentDate),
        notes: notes || null,
        recordedById: recordedById || null,
      },
    });

    if (saleId) {
      const sale = await tx.sale.findUnique({ where: { id: saleId }, include: { payments: true } });
      const totalPaid = sale.payments.reduce((sum, p) => sum + Number(p.amount), 0) + Number(amount);
      const saleTotal = Number(sale.totalAmount);

      let newStatus = 'UNPAID';
      if (totalPaid >= saleTotal) newStatus = 'PAID';
      else if (totalPaid > 0) newStatus = 'PARTIALLY_PAID';

      await tx.sale.update({ where: { id: saleId }, data: { status: newStatus } });
    }

    return payment;
  });
}

export async function listPayments({ companyId, page, limit }) {
  const { take, skip, page: currentPage } = paginate({ page, limit });
  const where = { companyId };

  const [rows, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: {
        party: { select: { name: true, type: true } },
        sale: { select: { invoiceNumber: true } },
      },
      orderBy: { paymentDate: 'desc' },
      take,
      skip,
    }),
    prisma.payment.count({ where }),
  ]);

  return paginatedResult({ rows, total, page: currentPage, limit: take });
}

export async function getPayment(companyId, id) {
  const payment = await prisma.payment.findFirst({
    where: { id, companyId },
    include: {
      party: true,
      sale: true,
      recordedBy: { select: { id: true, name: true, role: true } },
    },
  });
  if (!payment) {
    const err = new Error('Payment not found.');
    err.status = 404;
    throw err;
  }
  return payment;
}

export async function getLastSale(companyId, customerId) {
  return prisma.sale.findFirst({
    where: { companyId, customerId },
    orderBy: { saleDate: 'desc' },
    include: {
      items: { include: { batch: { include: { product: true } } } },
    },
  });
}
