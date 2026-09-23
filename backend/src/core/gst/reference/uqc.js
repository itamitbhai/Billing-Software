// GST Unit Quantity Codes accepted in the HSN summary (Table 12).
// NA is used for services (SAC codes starting with 99).
export const UQC_CODES = [
  'BAG', 'BAL', 'BDL', 'BKL', 'BOU', 'BOX', 'BTL', 'BUN', 'CAN', 'CBM', 'CCM', 'CMS', 'CTN', 'DOZ',
  'DRM', 'GGK', 'GMS', 'GRS', 'GYD', 'KGS', 'KLR', 'KME', 'LTR', 'MLT', 'MTR', 'MTS', 'NOS', 'OTH',
  'PAC', 'PCS', 'PRS', 'QTL', 'ROL', 'SET', 'SQF', 'SQM', 'SQY', 'TBS', 'TGM', 'THD', 'TON', 'TUB',
  'UGS', 'UNT', 'YDS', 'NA',
];

// Unambiguous spellings of a UQC. Anything not listed here (STRIP, TAB, INJ,
// VIAL…) has no GST equivalent and is reported as OTH with a warning, so the
// user can see the substitution instead of it happening silently.
const ALIASES = {
  NO: 'NOS', NUMBER: 'NOS', NUMBERS: 'NOS',
  PC: 'PCS', PIECE: 'PCS', PIECES: 'PCS',
  KG: 'KGS', KILOGRAM: 'KGS', KILOGRAMS: 'KGS',
  G: 'GMS', GM: 'GMS', GRAM: 'GMS', GRAMS: 'GMS',
  L: 'LTR', LITRE: 'LTR', LITER: 'LTR', LITRES: 'LTR', LITERS: 'LTR',
  ML: 'MLT', MILLILITRE: 'MLT', MILLILITER: 'MLT',
  BOTTLE: 'BTL', BOTTLES: 'BTL',
  TUBE: 'TUB', TUBES: 'TUB',
  PACK: 'PAC', PACKS: 'PAC', PACKET: 'PAC', PACKETS: 'PAC',
  DOZEN: 'DOZ', DOZENS: 'DOZ',
  BOXES: 'BOX',
  CARTON: 'CTN', CARTONS: 'CTN',
  UNIT: 'UNT', UNITS: 'UNT',
  M: 'MTR', METER: 'MTR', METRE: 'MTR', METERS: 'MTR', METRES: 'MTR',
};

/** @returns {{ uqc: string, exact: boolean }} */
export function resolveUqc(unit, { isService = false } = {}) {
  if (isService) return { uqc: 'NA', exact: true };
  const u = String(unit || '').trim().toUpperCase();
  if (UQC_CODES.includes(u)) return { uqc: u, exact: true };
  if (ALIASES[u]) return { uqc: ALIASES[u], exact: true };
  return { uqc: 'OTH', exact: false };
}
