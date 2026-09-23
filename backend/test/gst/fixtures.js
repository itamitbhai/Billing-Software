// Prisma-shaped test data (the same shape gst.service.js loads), so tests run
// through normalize.js exactly like production data does.
import { Decimal } from '@prisma/client/runtime/library';
import { invoiceFromSale, noteFromVoucher } from '../../src/core/gst/gstr1/normalize.js';
import { resolveReturnPeriod } from '../../src/core/gst/gst-period.js';

export const COMPANY = { name: 'VS Arogya Meda', gstin: '27AAPFU0939F1ZV', state: 'Maharashtra' };

export const PARTIES = {
  abcMedical: { id: 'p1', name: 'ABC Medical', gstin: '27AAACR5055K1Z7', state: 'Maharashtra', type: 'CUSTOMER', ledgerId: 'L-p1' },
  karnatakaPharma: { id: 'p2', name: 'Karnataka Pharma', gstin: '29AABCT1332L1ZA', state: 'Karnataka', type: 'CUSTOMER', ledgerId: 'L-p2' },
  walkIn: { id: 'p3', name: 'Walk-in Customer', gstin: null, state: 'Maharashtra', type: 'CUSTOMER', ledgerId: 'L-p3' },
  gujaratRetail: { id: 'p4', name: 'Gujarat Retail', gstin: null, state: 'Gujarat', type: 'CUSTOMER', ledgerId: 'L-p4' },
  overseas: { id: 'p5', name: 'Dubai Health LLC', gstin: null, state: 'Foreign Country', type: 'CUSTOMER', ledgerId: 'L-p5' },
  sezUnit: { id: 'p6', name: 'Chennai SEZ Unit', gstin: '33AABCS1234K1ZN', state: 'Tamil Nadu', type: 'CUSTOMER', ledgerId: 'L-p6' },
  supplier: { id: 'p7', name: 'Pharma Supplier', gstin: '24AAACC1206D1ZM', state: 'Gujarat', type: 'SUPPLIER', ledgerId: 'L-p7' },
};

export const PRODUCTS = {
  paracetamol: { name: 'Paracetamol 500', hsnCode: '30049099', unit: 'STRIP', gstRate: 5 },
  syrup: { name: 'Cough Syrup', hsnCode: '30049011', unit: 'BTL', gstRate: 12 },
  device: { name: 'BP Monitor', hsnCode: '90189099', unit: 'NOS', gstRate: 18 },
  bandage: { name: 'Bandage', hsnCode: '3005', unit: 'PCS', gstRate: 12 },
  freshFruit: { name: 'Fresh Fruit', hsnCode: '08109090', unit: 'KGS', gstRate: 0 },
};

let seq = 0;

/** Builds a Sale the way billing.service.js stores it (per-line tax split). */
export function sale({ number, date, customer, product = PRODUCTS.paracetamol, lines, supplyType = 'TAXABLE', placeOfSupply, cancelled = false, override = {} }) {
  const pos = placeOfSupply ?? customer.state;
  const intra = pos === COMPANY.state;
  const zeroTax = supplyType !== 'TAXABLE';
  const items = (lines || [{ product, qty: 10, rate: 100 }]).map((l) => {
    const p = l.product || product;
    const taxable = new Decimal(l.qty).mul(l.rate);
    const gstRate = zeroTax ? new Decimal(0) : new Decimal(l.gstRate ?? p.gstRate);
    const tax = taxable.mul(gstRate).div(100);
    const cgst = intra ? tax.div(2) : new Decimal(0);
    return {
      qty: l.qty, rate: new Decimal(l.rate), taxableValue: taxable, gstRate, hsnCode: 'hsnCode' in l ? l.hsnCode : p.hsnCode,
      cgstAmount: cgst, sgstAmount: intra ? tax.sub(cgst) : new Decimal(0), igstAmount: intra ? new Decimal(0) : tax,
      product: { name: p.name, unit: p.unit, hsnCode: 'hsnCode' in l ? l.hsnCode : p.hsnCode },
      ...(l.override || {}),
    };
  });
  const subTotal = items.reduce((s, i) => s.add(i.taxableValue), new Decimal(0));
  const tax = items.reduce((s, i) => s.add(i.cgstAmount).add(i.sgstAmount).add(i.igstAmount), new Decimal(0));
  return {
    id: `s${++seq}`, invoiceNumber: number, saleDate: new Date(`${date}T00:00:00.000Z`), isCancelled: cancelled, supplyType,
    placeOfSupply: pos, subTotal, totalAmount: subTotal.add(tax), customer, items, ...override,
  };
}

/** A CREDIT_NOTE/DEBIT_NOTE voucher posted via the Vouchers module. */
export function note({ type = 'CREDIT_NOTE', number, date, party, taxable, rate, deleted = false }) {
  const intra = party.state === COMPANY.state;
  const t = new Decimal(taxable);
  const tax = t.mul(rate).div(100);
  const credit = type === 'CREDIT_NOTE';
  const partySide = credit ? 'CREDIT' : 'DEBIT';
  const otherSide = credit ? 'DEBIT' : 'CREDIT';
  const lines = [
    { ledgerId: party.ledgerId, ledger: { name: party.name }, type: partySide, amount: t.add(tax) },
    { ledgerId: 'L-sales-return', ledger: { name: 'Sales Return' }, type: otherSide, amount: t },
  ];
  if (intra) {
    lines.push({ ledgerId: 'L-ocgst', ledger: { name: 'Output CGST' }, type: otherSide, amount: tax.div(2) });
    lines.push({ ledgerId: 'L-osgst', ledger: { name: 'Output SGST' }, type: otherSide, amount: tax.div(2) });
  } else if (tax.gt(0)) {
    lines.push({ ledgerId: 'L-oigst', ledger: { name: 'Output IGST' }, type: otherSide, amount: tax });
  }
  return { id: `v${++seq}`, voucherNumber: number, type, date: new Date(`${date}T00:00:00.000Z`), isDeleted: deleted, party, lines };
}

export const JULY_2026 = () => resolveReturnPeriod({ returnType: 'GSTR1', financialYear: '2026-27', month: 7 });

export function docs({ sales = [], notes = [] }) {
  return { invoices: sales.map(invoiceFromSale), notes: notes.map(noteFromVoucher) };
}
