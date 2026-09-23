import { toCsv, downloadCsv } from '../../utils/csv';

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const RETURN_LABELS = { GSTR1: 'GSTR-1', IFF: 'IFF', CUSTOM: 'Custom range (internal review)' };

export const SECTION_LABELS = {
  B2B: 'B2B', B2CL: 'B2C Large', B2CS: 'B2C Small', EXP: 'Exports', NIL: 'Nil / Exempt / Non-GST',
  CDNR: 'Credit/Debit Notes (Registered)', CDNUR: 'Credit/Debit Notes (Unregistered)', HSN: 'HSN Summary',
  DOC_ISSUE: 'Documents Issued', COMPANY: 'Company', INVOICE: 'Invoice', CDN: 'Credit/Debit Note', HEADER: 'Header',
};

/** "2026-27" for the financial year containing `date`. */
export function financialYearOf(date = new Date()) {
  const y = date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
  return `${y}-${String(y + 1).slice(-2)}`;
}

export function financialYearOptions(count = 4) {
  const current = Number(financialYearOf().slice(0, 4));
  return Array.from({ length: count }, (_, i) => {
    const y = current - i;
    return `${y}-${String(y + 1).slice(-2)}`;
  });
}

/** April → March of a financial year as { month, year, label }. */
export function monthsOfFinancialYear(fy) {
  const start = Number(fy.slice(0, 4));
  return Array.from({ length: 12 }, (_, i) => {
    const month = ((3 + i) % 12) + 1;
    const year = month >= 4 ? start : start + 1;
    return { month, year, label: `${MONTH_NAMES[month - 1]} ${year}` };
  });
}

export function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

const ISSUE_COLUMNS = [
  { key: 'documentNumber', label: 'Invoice Number' }, { key: 'documentDate', label: 'Invoice Date' },
  { key: 'documentType', label: 'Document Type' }, { key: 'party', label: 'Customer' }, { key: 'gstin', label: 'GSTIN' },
  { key: 'section', label: 'Section' }, { key: 'field', label: 'Field' }, { key: 'severity', label: 'Severity' },
  { key: 'message', label: 'Error' }, { key: 'suggestion', label: 'Suggested Fix' },
];

export function downloadIssuesCsv(issues, periodKey) {
  downloadCsv(`GST_Export_Errors_${periodKey}.csv`, toCsv(issues, ISSUE_COLUMNS));
}
