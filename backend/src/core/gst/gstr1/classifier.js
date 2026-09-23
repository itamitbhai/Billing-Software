// Decides which GSTR-1 table each document belongs to. Pure: works on the
// normalized documents from normalize.js plus the company's state code.

import { resolveStateCode } from '../reference/state-codes.js';
import { matchGstRate } from '../reference/gst-rates.js';
import { B2CL_THRESHOLD, SECTIONS, ZERO } from './constants.js';

const sumTax = (x) => x.cgst.add(x.sgst).add(x.igst);

/**
 * @returns {{
 *   section: string, posCode: string|null, interState: boolean, registered: boolean,
 *   invTyp?: string, expTyp?: string, nilKind?: 'nil'|'expt'|'ngsup', nilSplyTy: string,
 *   taxItems: object[], nilItems: object[], hsnTable: 'b2b'|'b2c'
 * }}
 */
export function classifyInvoice(doc, { companyStateCode }) {
  const registered = !!doc.party.gstin;
  const isExport = doc.supplyType === 'ZERO_RATED_EXPORT';
  const posCode = isExport ? (resolveStateCode(doc.placeOfSupply) || '96') : resolveStateCode(doc.placeOfSupply);
  const interState = isExport || doc.supplyType === 'ZERO_RATED_SEZ' || (posCode !== null && posCode !== companyStateCode);
  const nilSplyTy = `${interState ? 'INTR' : 'INTRA'}${registered ? 'B2B' : 'B2C'}`;
  const invoiceTax = doc.items.reduce((s, i) => s.add(sumTax(i)), ZERO);
  const base = { posCode, interState, registered, nilSplyTy, hsnTable: registered && !isExport ? 'b2b' : 'b2c' };

  switch (doc.supplyType) {
    case 'ZERO_RATED_EXPORT':
      return { ...base, section: SECTIONS.EXP, expTyp: invoiceTax.gt(0) ? 'WPAY' : 'WOPAY', taxItems: doc.items, nilItems: [] };
    case 'ZERO_RATED_SEZ':
      return { ...base, section: SECTIONS.B2B, invTyp: invoiceTax.gt(0) ? 'SEZWP' : 'SEZWOP', taxItems: doc.items, nilItems: [] };
    case 'NIL_RATED':
      return { ...base, section: SECTIONS.NIL, nilKind: 'nil', taxItems: [], nilItems: doc.items };
    case 'EXEMPT':
      return { ...base, section: SECTIONS.NIL, nilKind: 'expt', taxItems: [], nilItems: doc.items };
    case 'NON_GST':
      return { ...base, section: SECTIONS.NIL, nilKind: 'ngsup', taxItems: [], nilItems: doc.items };
    default: {
      // A taxable invoice can still carry 0%-rated products; those lines are
      // nil-rated supplies (Table 8), the rest go to the invoice's table.
      const taxItems = doc.items.filter((i) => i.rate.gt(0));
      const nilItems = doc.items.filter((i) => !i.rate.gt(0));
      if (!taxItems.length) return { ...base, section: SECTIONS.NIL, nilKind: 'nil', taxItems: [], nilItems };
      let section = SECTIONS.B2CS;
      if (registered) section = SECTIONS.B2B;
      else if (interState && doc.value.gt(B2CL_THRESHOLD)) section = SECTIONS.B2CL;
      return { ...base, section, invTyp: registered ? 'R' : undefined, nilKind: 'nil', taxItems, nilItems };
    }
  }
}

/**
 * Credit/debit notes raised on customers. Registered → CDNR. Unregistered
 * notes go to CDNUR (B2CL) when they are inter-state above the B2CL limit;
 * otherwise they adjust the B2CS summary, as GSTN requires for notes against
 * B2CS supplies.
 */
export function classifyNote(note, { companyStateCode }) {
  if (note.direction === 'INWARD') return { section: null, skipReason: 'INWARD' };

  const registered = !!note.party.gstin;
  const posCode = resolveStateCode(note.placeOfSupply);
  const interState = posCode !== null && posCode !== companyStateCode;
  const tax = sumTax(note);
  const effectiveRate = note.taxable.gt(0) ? Number(tax.div(note.taxable).mul(100).toFixed(4)) : null;
  const rate = effectiveRate === null ? null : matchGstRate(effectiveRate);

  let section = SECTIONS.B2CS;
  if (registered) section = SECTIONS.CDNR;
  else if (interState && note.value.gt(B2CL_THRESHOLD)) section = SECTIONS.CDNUR;

  return { section, posCode, interState, registered, effectiveRate, rate };
}
