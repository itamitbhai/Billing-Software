// Return-period resolution. A GST return JSON is always bound to a statutory
// tax period (`fp` = MMYYYY): a month for monthly GSTR-1/IFF, or the last
// month of the quarter for quarterly (QRMP) GSTR-1. Arbitrary date ranges are
// only allowed for internal review and can never produce a return JSON.

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

/** "2026-27" → { startYear: 2026, endYear: 2027 } */
export function parseFinancialYear(fy) {
  const m = String(fy || '').match(/^(\d{4})-(\d{2})$/);
  if (!m) throw badRequest('financialYear must look like "2026-27".');
  const startYear = Number(m[1]);
  if ((startYear + 1) % 100 !== Number(m[2])) throw badRequest(`"${fy}" is not a valid financial year.`);
  return { startYear, endYear: startYear + 1 };
}

/** Months of a financial year in order (April → March) as { month, year }. */
export function financialYearMonths(fy) {
  const { startYear } = parseFinancialYear(fy);
  return Array.from({ length: 12 }, (_, i) => {
    const month = ((3 + i) % 12) + 1;
    return { month, year: month >= 4 ? startYear : startYear + 1 };
  });
}

const utcStart = (year, month) => new Date(Date.UTC(year, month - 1, 1));
const utcEnd = (year, month) => new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

/**
 * @param {object} p
 * @param {'GSTR1'|'IFF'} p.returnType
 * @param {'MONTHLY'|'QUARTERLY'} [p.frequency]
 * @param {string} p.financialYear  "2026-27"
 * @param {number} p.month          1-12; for QUARTERLY any month inside the quarter
 */
export function resolveReturnPeriod({ returnType, frequency = 'MONTHLY', financialYear, month }) {
  const m = Number(month);
  if (!Number.isInteger(m) || m < 1 || m > 12) throw badRequest('month must be 1-12.');
  const { startYear } = parseFinancialYear(financialYear);
  const year = m >= 4 ? startYear : startYear + 1;

  // Quarters of an Indian FY: Apr-Jun, Jul-Sep, Oct-Dec, Jan-Mar.
  const quarterStartMonth = [1, 4, 7, 10].filter((q) => q <= m).pop();
  const monthInQuarter = m - quarterStartMonth + 1;

  if (returnType === 'IFF') {
    if (monthInQuarter === 3) {
      throw badRequest('IFF is only furnished for the first two months of a quarter. Use quarterly GSTR-1 for the third month.');
    }
    return periodFor({ returnType, frequency: 'MONTHLY', fromMonth: m, fromYear: year, toMonth: m, toYear: year, financialYear });
  }

  if (returnType !== 'GSTR1') throw badRequest(`Unsupported return type "${returnType}".`);

  if (frequency === 'QUARTERLY') {
    const endMonth = quarterStartMonth + 2;
    return periodFor({ returnType, frequency, fromMonth: quarterStartMonth, fromYear: year, toMonth: endMonth, toYear: year, financialYear });
  }
  if (frequency !== 'MONTHLY') throw badRequest('frequency must be MONTHLY or QUARTERLY.');
  return periodFor({ returnType, frequency, fromMonth: m, fromYear: year, toMonth: m, toYear: year, financialYear });
}

function periodFor({ returnType, frequency, fromMonth, fromYear, toMonth, toYear, financialYear }) {
  const fp = `${String(toMonth).padStart(2, '0')}${toYear}`;
  const label = frequency === 'QUARTERLY'
    ? `${MONTH_NAMES[fromMonth - 1].slice(0, 3)}–${MONTH_NAMES[toMonth - 1].slice(0, 3)} ${toYear}`
    : `${MONTH_NAMES[toMonth - 1]} ${toYear}`;
  return {
    returnType,
    frequency,
    financialYear,
    fp,
    label,
    // yyyy-mm of the return period, used in file names
    periodKey: `${toYear}-${String(toMonth).padStart(2, '0')}`,
    startDate: utcStart(fromYear, fromMonth),
    endDate: utcEnd(toYear, toMonth),
  };
}

/** Internal-review range (no JSON can be generated from it). */
export function resolveCustomRange({ from, to }) {
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T23:59:59.999Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw badRequest('from/to must be YYYY-MM-DD dates.');
  if (start > end) throw badRequest('"from" must be on or before "to".');
  return { returnType: 'CUSTOM', frequency: null, financialYear: null, fp: null, label: `${from} to ${to}`, periodKey: `${from}_${to}`, startDate: start, endDate: end };
}
