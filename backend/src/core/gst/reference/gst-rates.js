// Tax rates accepted by the GSTR-1 rate fields. 40% was introduced with the
// rate rationalisation effective 22-Sep-2025; 12%/28% remain valid for
// documents and goods that still carry them.
export const GST_RATES = [0, 0.1, 0.25, 1, 1.5, 3, 5, 6, 7.5, 12, 18, 28, 40];

export function isValidGstRate(rate) {
  return GST_RATES.includes(Number(rate));
}

/** Nearest valid rate for an effective rate derived from amounts, or null if none is within 0.05%. */
export function matchGstRate(effectiveRate) {
  const hit = GST_RATES.find((r) => Math.abs(r - effectiveRate) <= 0.05);
  return hit === undefined ? null : hit;
}
