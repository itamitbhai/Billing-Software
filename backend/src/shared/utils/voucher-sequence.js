// ============================================
// voucher-sequence.js
// Financial-year resolution + race-free voucher numbering.
//
// Numbers are generated with an atomic `UPDATE ... SET lastNumber = lastNumber + 1`
// against a per-(company, financialYear, type) row that is seeded up front when the
// financial year is created. Because the row always already exists, Postgres's
// row-level locking inside the transaction serializes concurrent callers instead
// of racing on a count()-then-pad pattern.
// ============================================

export const VOUCHER_TYPE_PREFIXES = {
  SALES: 'SL',
  PURCHASE: 'PU',
  RECEIPT: 'RC',
  PAYMENT: 'PY',
  CONTRA: 'CT',
  JOURNAL: 'JL',
  CREDIT_NOTE: 'CN',
  DEBIT_NOTE: 'DN',
};

const ALL_VOUCHER_TYPES = Object.keys(VOUCHER_TYPE_PREFIXES);

function financialYearBounds(date) {
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
  return { fyStart, fyEnd, name };
}

/**
 * Finds (or creates) the financial year covering `date` for this company,
 * seeding one VoucherSequence counter per voucher type on creation.
 */
export async function getOrCreateFinancialYear(tx, companyId, date) {
  const { fyStart, fyEnd, name } = financialYearBounds(date);

  let fy = await tx.financialYear.findUnique({
    where: { companyId_name: { companyId, name } },
  });

  if (!fy) {
    fy = await tx.financialYear.create({
      data: { companyId, name, startDate: fyStart, endDate: fyEnd, isActive: true },
    });
    await Promise.all(
      ALL_VOUCHER_TYPES.map((type) =>
        tx.voucherSequence.create({
          data: { companyId, financialYearId: fy.id, type, lastNumber: 0 },
        })
      )
    );
  }

  if (fy.isClosed) {
    const err = new Error(`Financial year ${fy.name} is closed. No new entries can be posted.`);
    err.status = 400;
    throw err;
  }

  return fy;
}

/**
 * Atomically claims the next number for (companyId, financialYearId, type)
 * and returns both the raw number and a formatted internal voucher number.
 */
export async function nextVoucherNumber(tx, { companyId, financialYear, type }) {
  const seq = await tx.voucherSequence.update({
    where: {
      companyId_financialYearId_type: {
        companyId,
        financialYearId: financialYear.id,
        type,
      },
    },
    data: { lastNumber: { increment: 1 } },
  });

  const prefix = VOUCHER_TYPE_PREFIXES[type] || 'VN';
  const fyCode = financialYear.name.replace('-', '');
  const voucherNumber = `${prefix}-${fyCode}-${String(seq.lastNumber).padStart(5, '0')}`;

  return { number: seq.lastNumber, voucherNumber };
}

/**
 * Formats a customer-facing invoice number from the company's own prefix,
 * reusing the same underlying counter value as the linked SALES voucher.
 */
export function formatInvoiceNumber(invoicePrefix, financialYear, number) {
  const fyCode = financialYear.name.replace('-', '');
  return `${invoicePrefix}/${fyCode}/${String(number).padStart(5, '0')}`;
}
