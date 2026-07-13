import { format as dfFormat } from 'date-fns';

/**
 * Formats paise (BigInt or Number) into standard Indian Rupees (₹) format.
 * E.g., 100000 paise -> ₹1,000.00
 */
export function formatRupees(paise) {
  if (paise === undefined || paise === null) return '₹0.00';
  const val = Number(paise) / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  }).format(val);
}

/**
 * Formats a date string or object into standard dd-MMM-yyyy format.
 */
export function formatDate(date) {
  if (!date) return '-';
  return dfFormat(new Date(date), 'dd-MMM-yyyy');
}

/**
 * Converts rupees input value to paise integer for backend.
 */
export function rupeesToPaise(rupees) {
  if (!rupees) return 0n;
  return BigInt(Math.round(Number(rupees) * 100));
}
