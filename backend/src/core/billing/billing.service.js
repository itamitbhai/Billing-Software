import { prisma } from '../../shared/database/prisma.js';

// ============================================
// HELPERS FOR DOUBLE ENTRY POSTING
// ============================================

async function getOrCreateFinancialYear(tx, date) {
  const d = new Date(date);
  const year = d.getFullYear();
  let fyStart, fyEnd;
  
  if (d.getMonth() >= 3) { // April to March
    fyStart = new Date(year, 3, 1);
    fyEnd = new Date(year + 1, 2, 31, 23, 59, 59);
  } else {
    fyStart = new Date(year - 1, 3, 1);
    fyEnd = new Date(year, 2, 31, 23, 59, 59);
  }
  const name = `${fyStart.getFullYear()}-${String(fyEnd.getFullYear()).slice(-2)}`;

  let fy = await tx.financialYear.findUnique({
    where: { name }
  });
  if (!fy) {
    fy = await tx.financialYear.create({
      data: {
        name,
        startDate: fyStart,
        endDate: fyEnd,
        isActive: true
      }
    });
  }
  return fy;
}

async function getOrCreateSystemLedger(tx, ledgerName, groupName, nature) {
  let ledger = await tx.ledger.findUnique({ where: { name: ledgerName } });
  if (!ledger) {
    let group = await tx.ledgerGroup.findUnique({ where: { name: groupName } });
    if (!group) {
      group = await tx.ledgerGroup.create({
        data: { name: groupName, nature }
      });
    }
    ledger = await tx.ledger.create({
      data: {
        name: ledgerName,
        groupId: group.id,
        openingBalance: 0,
        openingBalanceType: 'DEBIT'
      }
    });
  }
  return ledger;
}

// ============================================
// PURCHASES (Stock IN)
// ============================================

export async function createPurchase({ supplierId, billNumber, purchaseDate, items }) {
  // Validate Supplier
  const supplier = await prisma.party.findUnique({ where: { id: supplierId } });
  if (!supplier || (supplier.type !== 'SUPPLIER' && supplier.type !== 'BOTH')) {
    const err = new Error('Valid supplier not found.');
    err.status = 400;
    throw err;
  }

  const totalAmount = items.reduce((sum, item) => sum + Number(item.amount), 0);

  return prisma.$transaction(async (tx) => {
    // 1. Create Purchase record
    const purchase = await tx.purchase.create({
      data: {
        supplierId,
        billNumber,
        purchaseDate: new Date(purchaseDate),
        totalAmount,
      },
    });

    // 2. Process items and update Batch inventory
    for (const item of items) {
      await tx.purchaseItem.create({
        data: {
          purchaseId: purchase.id,
          batchId: item.batchId,
          qty: item.qty,
          rate: item.rate,
          gstAmount: item.gstAmount || 0,
          amount: item.amount,
        },
      });

      await tx.batch.update({
        where: { id: item.batchId },
        data: {
          currentQty: {
            increment: item.qty,
          },
        },
      });
    }

    // 3. Double-Entry Posting:
    // Debit: Purchase Account
    // Credit: Supplier Ledger
    const fy = await getOrCreateFinancialYear(tx, purchaseDate);
    const purchaseLedger = await getOrCreateSystemLedger(tx, 'Purchase Ledger', 'Purchase Accounts', 'EXPENSE');

    const voucherNumber = `V-PUR-${purchase.id.slice(0, 8)}-${billNumber}`;
    
    const voucher = await tx.voucher.create({
      data: {
        voucherNumber,
        type: 'PURCHASE',
        date: new Date(purchaseDate),
        narration: `Purchase Invoice: ${billNumber}`,
        financialYearId: fy.id,
      }
    });

    // Debit Line (Purchase Ledger)
    await tx.voucherLine.create({
      data: {
        voucherId: voucher.id,
        ledgerId: purchaseLedger.id,
        type: 'DEBIT',
        amount: totalAmount,
      }
    });

    // Credit Line (Supplier Ledger)
    await tx.voucherLine.create({
      data: {
        voucherId: voucher.id,
        ledgerId: supplier.ledgerId,
        type: 'CREDIT',
        amount: totalAmount,
      }
    });

    return tx.purchase.findUnique({
      where: { id: purchase.id },
      include: {
        supplier: { select: { name: true } },
        items: {
          include: {
            batch: { select: { batchNumber: true } },
          },
        },
      },
    });
  });
}

export async function listPurchases() {
  return prisma.purchase.findMany({
    include: { supplier: { select: { name: true } } },
    orderBy: { purchaseDate: 'desc' },
  });
}

export async function getPurchase(id) {
  const purchase = await prisma.purchase.findUnique({
    where: { id },
    include: {
      supplier: true,
      items: {
        include: {
          batch: {
            include: { product: true },
          },
        },
      },
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

export async function createSale({ customerId, invoiceNumber, saleDate, items }) {
  // Validate Customer
  const customer = await prisma.party.findUnique({ where: { id: customerId } });
  if (!customer || (customer.type !== 'CUSTOMER' && customer.type !== 'BOTH')) {
    const err = new Error('Valid customer not found.');
    err.status = 400;
    throw err;
  }

  const totalAmount = items.reduce((sum, item) => sum + Number(item.amount), 0);

  return prisma.$transaction(async (tx) => {
    // 1. Validate Stock availability first
    for (const item of items) {
      const batch = await tx.batch.findUnique({ where: { id: item.batchId } });
      if (!batch) {
        throw new Error(`Batch ID ${item.batchId} not found.`);
      }
      if (batch.currentQty < item.qty) {
        throw new Error(`Insufficient stock in Batch ${batch.batchNumber}. Available: ${batch.currentQty}, Requested: ${item.qty}`);
      }
    }

    // 2. Create Sale record
    const sale = await tx.sale.create({
      data: {
        customerId,
        invoiceNumber,
        saleDate: new Date(saleDate),
        totalAmount,
        status: 'UNPAID',
      },
    });

    // 3. Process items and decrement Batch inventory
    for (const item of items) {
      await tx.saleItem.create({
        data: {
          saleId: sale.id,
          batchId: item.batchId,
          qty: item.qty,
          rate: item.rate,
          gstAmount: item.gstAmount || 0,
          amount: item.amount,
        },
      });

      await tx.batch.update({
        where: { id: item.batchId },
        data: {
          currentQty: {
            decrement: item.qty,
          },
        },
      });
    }

    // 4. Double-Entry Posting:
    // Debit: Customer Ledger
    // Credit: Sales Ledger
    const fy = await getOrCreateFinancialYear(tx, saleDate);
    const salesLedger = await getOrCreateSystemLedger(tx, 'Sales Ledger', 'Sales Accounts', 'INCOME');

    const voucherNumber = `V-SALES-${sale.id.slice(0, 8)}-${invoiceNumber}`;

    const voucher = await tx.voucher.create({
      data: {
        voucherNumber,
        type: 'SALES',
        date: new Date(saleDate),
        narration: `Sales Invoice: ${invoiceNumber}`,
        financialYearId: fy.id,
      }
    });

    // Debit Line (Customer Ledger)
    await tx.voucherLine.create({
      data: {
        voucherId: voucher.id,
        ledgerId: customer.ledgerId,
        type: 'DEBIT',
        amount: totalAmount,
      }
    });

    // Credit Line (Sales Ledger)
    await tx.voucherLine.create({
      data: {
        voucherId: voucher.id,
        ledgerId: salesLedger.id,
        type: 'CREDIT',
        amount: totalAmount,
      }
    });

    return tx.sale.findUnique({
      where: { id: sale.id },
      include: {
        customer: { select: { name: true } },
        items: {
          include: {
            batch: { select: { batchNumber: true } },
          },
        },
      },
    });
  });
}

export async function listSales() {
  return prisma.sale.findMany({
    include: { customer: { select: { name: true } } },
    orderBy: { saleDate: 'desc' },
  });
}

export async function getSale(id) {
  const sale = await prisma.sale.findUnique({
    where: { id },
    include: {
      customer: true,
      items: {
        include: {
          batch: {
            include: { product: true },
          },
        },
      },
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

export async function createPayment({ partyId, saleId, amount, method, referenceNumber, paymentDate, notes, recordedById }) {
  // Validate Party
  const party = await prisma.party.findUnique({ where: { id: partyId } });
  if (!party) {
    const err = new Error('Party not found.');
    err.status = 400;
    throw err;
  }

  return prisma.$transaction(async (tx) => {
    // 1. Create Payment record
    const payment = await tx.payment.create({
      data: {
        partyId,
        saleId: saleId || null,
        amount,
        method,
        referenceNumber: referenceNumber || null,
        paymentDate: new Date(paymentDate),
        notes: notes || null,
        recordedById: recordedById || null,
      },
    });

    // 2. If payment is linked to a sale, update sale payment status
    if (saleId) {
      const sale = await tx.sale.findUnique({
        where: { id: saleId },
        include: { payments: true },
      });

      if (sale) {
        // Sum all payments for this sale (including the new one)
        const totalPaid = sale.payments.reduce((sum, p) => sum + Number(p.amount), 0) + Number(amount);
        const saleTotal = Number(sale.totalAmount);

        let newStatus = 'UNPAID';
        if (totalPaid >= saleTotal) {
          newStatus = 'PAID';
        } else if (totalPaid > 0) {
          newStatus = 'PARTIALLY_PAID';
        }

        await tx.sale.update({
          where: { id: saleId },
          data: { status: newStatus },
        });
      }
    }

    // 3. Double-Entry Posting:
    // Determine if Receipt (we receive money from Customer) or Payment (we pay Supplier)
    const isReceipt = party.type === 'CUSTOMER' || party.type === 'BOTH';
    const vType = isReceipt ? 'RECEIPT' : 'PAYMENT';

    // Get Cash/Bank Ledger
    const isCash = method === 'CASH';
    const cashBankLedgerName = isCash ? 'Cash-in-Hand Ledger' : 'Bank Account Ledger';
    const cashBankGroupName = isCash ? 'Cash-in-Hand' : 'Bank Accounts';
    const cashBankLedger = await getOrCreateSystemLedger(tx, cashBankLedgerName, cashBankGroupName, 'ASSET');

    const fy = await getOrCreateFinancialYear(tx, paymentDate);
    const refText = referenceNumber ? ` Ref: ${referenceNumber}` : '';
    const voucherNumber = `V-${vType.slice(0, 3)}-${payment.id.slice(0, 8)}`;

    const voucher = await tx.voucher.create({
      data: {
        voucherNumber,
        type: vType,
        date: new Date(paymentDate),
        narration: `${vType} from Party: ${party.name}.${refText}`,
        financialYearId: fy.id,
      }
    });

    if (isReceipt) {
      // Debit: Cash/Bank Ledger
      await tx.voucherLine.create({
        data: {
          voucherId: voucher.id,
          ledgerId: cashBankLedger.id,
          type: 'DEBIT',
          amount,
        }
      });
      // Credit: Customer Ledger
      await tx.voucherLine.create({
        data: {
          voucherId: voucher.id,
          ledgerId: party.ledgerId,
          type: 'CREDIT',
          amount,
        }
      });
    } else {
      // Debit: Supplier Ledger
      await tx.voucherLine.create({
        data: {
          voucherId: voucher.id,
          ledgerId: party.ledgerId,
          type: 'DEBIT',
          amount,
        }
      });
      // Credit: Cash/Bank Ledger
      await tx.voucherLine.create({
        data: {
          voucherId: voucher.id,
          ledgerId: cashBankLedger.id,
          type: 'CREDIT',
          amount,
        }
      });
    }

    return payment;
  });
}

export async function listPayments() {
  return prisma.payment.findMany({
    include: {
      party: { select: { name: true, type: true } },
      sale: { select: { invoiceNumber: true } },
    },
    orderBy: { paymentDate: 'desc' },
  });
}

export async function getPayment(id) {
  const payment = await prisma.payment.findUnique({
    where: { id },
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

export async function getLastSale(customerId) {
  return prisma.sale.findFirst({
    where: { customerId },
    orderBy: { saleDate: 'desc' },
    include: {
      items: {
        include: {
          batch: {
            include: { product: true },
          },
        },
      },
    },
  });
}
