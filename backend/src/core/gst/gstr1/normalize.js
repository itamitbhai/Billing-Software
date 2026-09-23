// Converts billing-module Prisma records into the neutral document shape the
// GSTR-1 pipeline works on. This is the only file that knows internal
// database field names; everything downstream is independent of the schema.

import { ZERO, dec } from './constants.js';

const TAX_LEDGERS = {
  'Output CGST': { head: 'cgst', direction: 'OUTWARD' },
  'Output SGST': { head: 'sgst', direction: 'OUTWARD' },
  'Output IGST': { head: 'igst', direction: 'OUTWARD' },
  'Input CGST': { head: 'cgst', direction: 'INWARD' },
  'Input SGST': { head: 'sgst', direction: 'INWARD' },
  'Input IGST': { head: 'igst', direction: 'INWARD' },
};

function party(p) {
  return {
    id: p?.id || null,
    name: p?.name || '',
    gstin: (p?.gstin || '').trim() || null,
    state: p?.state || null,
    type: p?.type || null,
    ledgerId: p?.ledgerId || null,
  };
}

const VALID_HSN = /^\d{4}$|^\d{6}$|^\d{8}$/;

/**
 * The HSN copied onto the invoice line wins. When it is missing or malformed
 * and the product master now holds a valid code (the user corrected it), the
 * master code is used and `invoicedHsn` keeps the original so the validator
 * can report the substitution instead of hiding it.
 */
function resolveHsn(lineHsn, masterHsn) {
  const line = (lineHsn || '').toString().trim();
  const master = (masterHsn || '').toString().trim();
  if (VALID_HSN.test(line) || !VALID_HSN.test(master)) return { hsn: line || master, invoicedHsn: null };
  return { hsn: master, invoicedHsn: line || null };
}

/** Sale (with customer, items → product) → invoice document. */
export function invoiceFromSale(sale) {
  return {
    kind: 'INVOICE',
    id: sale.id,
    number: sale.invoiceNumber,
    date: new Date(sale.saleDate),
    cancelled: !!sale.isCancelled,
    supplyType: sale.supplyType || 'TAXABLE',
    placeOfSupply: sale.placeOfSupply || '',
    value: dec(sale.totalAmount),
    subTotal: dec(sale.subTotal),
    party: party(sale.customer),
    items: (sale.items || []).map((i) => ({
      ...resolveHsn(i.hsnCode, i.product?.hsnCode),
      name: i.product?.name || '',
      unit: i.product?.unit || '',
      qty: Number(i.qty),
      rate: dec(i.gstRate),
      taxable: dec(i.taxableValue),
      cgst: dec(i.cgstAmount),
      sgst: dec(i.sgstAmount),
      igst: dec(i.igstAmount),
      cess: ZERO, // billing module does not levy compensation cess
    })),
  };
}

/**
 * CREDIT_NOTE / DEBIT_NOTE voucher (with party, lines → ledger) → note document.
 * Tax is read from the Output/Input tax ledgers (or the line's explicit tax
 * columns); the taxable value is every other non-party line.
 */
export function noteFromVoucher(voucher) {
  const p = party(voucher.party);
  let cgst = ZERO, sgst = ZERO, igst = ZERO, taxable = ZERO, value = ZERO;
  let direction = 'UNKNOWN';
  let partySide = null;

  for (const line of voucher.lines || []) {
    const amount = dec(line.amount);
    const taxLedger = TAX_LEDGERS[line.ledger?.name];
    if (line.ledgerId === p.ledgerId) {
      value = value.add(amount);
      partySide = line.type;
    } else if (taxLedger) {
      direction = taxLedger.direction;
      if (taxLedger.head === 'cgst') cgst = cgst.add(amount);
      if (taxLedger.head === 'sgst') sgst = sgst.add(amount);
      if (taxLedger.head === 'igst') igst = igst.add(amount);
    } else if (dec(line.cgstAmount).add(dec(line.sgstAmount)).add(dec(line.igstAmount)).gt(0)) {
      cgst = cgst.add(dec(line.cgstAmount));
      sgst = sgst.add(dec(line.sgstAmount));
      igst = igst.add(dec(line.igstAmount));
    } else {
      taxable = taxable.add(amount);
    }
  }

  // A note with no tax ledger is outward only if it was raised on a customer.
  if (direction === 'UNKNOWN' && (p.type === 'CUSTOMER' || p.type === 'BOTH')) direction = 'OUTWARD';
  if (direction === 'UNKNOWN' && p.type === 'SUPPLIER') direction = 'INWARD';

  return {
    kind: 'NOTE',
    noteType: voucher.type === 'CREDIT_NOTE' ? 'C' : 'D',
    id: voucher.id,
    number: voucher.voucherNumber,
    date: new Date(voucher.date),
    cancelled: !!voucher.isDeleted,
    party: p,
    placeOfSupply: p.state || '',
    direction,
    partySide,
    value,
    taxable,
    cgst,
    sgst,
    igst,
    cess: ZERO,
  };
}
