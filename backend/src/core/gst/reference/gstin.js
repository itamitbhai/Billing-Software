// GSTIN structure: 2-digit state code + 10-char PAN + entity number + 'Z' + check character.
// The check character is a mod-36 Luhn-style checksum over the first 14 characters.

export const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function gstinCheckChar(first14) {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const value = CHARSET.indexOf(first14[i]) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(value / 36) + (value % 36);
  }
  return CHARSET[(36 - (sum % 36)) % 36];
}

/** Returns null when valid, otherwise a short reason string. */
export function gstinError(gstin) {
  if (!gstin) return 'GSTIN is missing';
  if (gstin !== gstin.trim() || gstin !== gstin.toUpperCase()) return 'GSTIN must be 15 upper-case characters without spaces';
  if (gstin.length !== 15) return `GSTIN must be 15 characters (found ${gstin.length})`;
  if (!GSTIN_PATTERN.test(gstin)) return 'GSTIN does not match the GSTIN format (SS-PAN-E-Z-C)';
  if (gstinCheckChar(gstin.slice(0, 14)) !== gstin[14]) return 'GSTIN check digit is incorrect';
  return null;
}
