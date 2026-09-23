import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { runGstr1Pipeline } from '../../src/core/gst/gstr1/pipeline.js';
import { validateGstr1Json } from '../../src/core/gst/gstr1/schema-validator.js';
import { splitPayload, byteSize } from '../../src/core/gst/gstr1/splitter.js';
import { resolveReturnPeriod, resolveCustomRange } from '../../src/core/gst/gst-period.js';
import { gstinError } from '../../src/core/gst/reference/gstin.js';
import { resolveStateCode } from '../../src/core/gst/reference/state-codes.js';
import { COMPANY, PARTIES, PRODUCTS, sale, note, docs, JULY_2026 } from './fixtures.js';

const run = ({ sales = [], notes = [], period = JULY_2026(), ...rest } = {}) =>
  runGstr1Pipeline({ company: COMPANY, period, ...docs({ sales, notes }), ...rest });

const errorsFor = (result, number) => result.issues.filter((i) => i.documentNumber === number && i.severity === 'error');

describe('reference data', () => {
  test('GSTIN checksum validation', () => {
    assert.equal(gstinError('27AAPFU0939F1ZV'), null);
    assert.match(gstinError('27AAPFU0939F1ZX'), /check digit/);
    assert.match(gstinError('27AAPFU0939F1Z'), /15 characters/);
    assert.match(gstinError('27aapfu0939f1zv'), /upper-case/);
  });
  test('state names resolve to GST codes', () => {
    assert.equal(resolveStateCode('Maharashtra'), '27');
    assert.equal(resolveStateCode('27-Maharashtra'), '27');
    assert.equal(resolveStateCode('orissa'), '21');
    assert.equal(resolveStateCode('Atlantis'), null);
  });
});

describe('GSTR-1 classification and mapping', () => {
  test('1. B2B intra-state → b2b with CGST+SGST', () => {
    const r = run({ sales: [sale({ number: 'INV/202627/00001', date: '2026-07-05', customer: PARTIES.abcMedical })] });
    const inv = r.payload.b2b[0].inv[0];
    assert.equal(r.payload.b2b[0].ctin, PARTIES.abcMedical.gstin);
    assert.deepEqual(inv, {
      inum: 'INV/202627/00001', idt: '05-07-2026', val: 1050, pos: '27', rchrg: 'N', inv_typ: 'R',
      itms: [{ num: 1, itm_det: { txval: 1000, rt: 5, camt: 25, samt: 25, csamt: 0 } }],
    });
    assert.equal(r.schema.valid, true, JSON.stringify(r.schema.errors));
    assert.equal(r.canGenerate, true);
  });

  test('2. B2B inter-state → b2b with IGST and POS of recipient state', () => {
    const r = run({ sales: [sale({ number: 'INV/202627/00002', date: '2026-07-06', customer: PARTIES.karnatakaPharma })] });
    const inv = r.payload.b2b[0].inv[0];
    assert.equal(inv.pos, '29');
    assert.deepEqual(inv.itms[0].itm_det, { txval: 1000, rt: 5, iamt: 50, csamt: 0 });
    assert.equal(r.schema.valid, true);
  });

  test('3. B2C: intra-state and small inter-state → b2cs; large inter-state → b2cl', () => {
    const r = run({ sales: [
      sale({ number: 'INV/202627/00003', date: '2026-07-07', customer: PARTIES.walkIn }),
      sale({ number: 'INV/202627/00004', date: '2026-07-07', customer: PARTIES.gujaratRetail }),
      sale({ number: 'INV/202627/00005', date: '2026-07-08', customer: PARTIES.gujaratRetail, lines: [{ qty: 1000, rate: 100 }] }), // 1,05,000
    ] });
    assert.deepEqual(r.payload.b2cs.map((x) => [x.sply_ty, x.pos, x.rt, x.txval]), [['INTER', '24', 5, 1000], ['INTRA', '27', 5, 1000]]);
    assert.equal(r.payload.b2cl[0].pos, '24');
    assert.equal(r.payload.b2cl[0].inv[0].inum, 'INV/202627/00005');
    assert.equal(r.payload.b2cl[0].inv[0].val, 105000);
    assert.equal(r.schema.valid, true, JSON.stringify(r.schema.errors));
  });

  test('4. Export without payment of tax → exp WOPAY; SEZ → b2b SEZWOP', () => {
    const r = run({ sales: [
      sale({ number: 'EXP/1', date: '2026-07-09', customer: PARTIES.overseas, supplyType: 'ZERO_RATED_EXPORT' }),
      sale({ number: 'SEZ/1', date: '2026-07-09', customer: PARTIES.sezUnit, supplyType: 'ZERO_RATED_SEZ' }),
    ] });
    assert.equal(r.payload.exp[0].exp_typ, 'WOPAY');
    assert.deepEqual(r.payload.exp[0].inv[0].itms, [{ txval: 1000, rt: 0, iamt: 0, csamt: 0 }]);
    assert.equal(r.payload.b2b[0].inv[0].inv_typ, 'SEZWOP');
    assert.ok(r.issues.some((i) => i.field === 'Shipping Bill' && i.severity === 'warning'));
    assert.equal(r.schema.valid, true, JSON.stringify(r.schema.errors));
    // Exports go to the B2C tab of Table 12, SEZ supplies to the B2B tab.
    assert.equal(r.payload.hsn.hsn_b2c[0].txval, 1000);
    assert.equal(r.payload.hsn.hsn_b2b[0].txval, 1000);
  });

  test('5/6. Credit note (registered) → cdnr; debit note (unregistered, small) → b2cs adjustment', () => {
    const r = run({
      sales: [sale({ number: 'INV/202627/00010', date: '2026-07-01', customer: PARTIES.walkIn, lines: [{ qty: 50, rate: 100 }] })],
      notes: [
        note({ type: 'CREDIT_NOTE', number: 'CN-202627-00001', date: '2026-07-15', party: PARTIES.abcMedical, taxable: 200, rate: 12 }),
        note({ type: 'DEBIT_NOTE', number: 'DN-202627-00001', date: '2026-07-16', party: PARTIES.walkIn, taxable: 100, rate: 5 }),
      ],
    });
    assert.deepEqual(r.payload.cdnr[0].nt[0], {
      ntty: 'C', nt_num: 'CN-202627-00001', nt_dt: '15-07-2026', val: 224, pos: '27', rchrg: 'N', inv_typ: 'R',
      itms: [{ num: 1, itm_det: { txval: 200, rt: 12, camt: 12, samt: 12, csamt: 0 } }],
    });
    // 5000 invoice + 100 debit note in the same B2CS bucket
    assert.equal(r.payload.b2cs[0].txval, 5100);
    assert.deepEqual(r.payload.doc_issue.doc_det.map((d) => d.doc_num), [1, 4, 5]);
    assert.equal(r.schema.valid, true, JSON.stringify(r.schema.errors));
  });

  test('5b. Large inter-state unregistered credit note → cdnur B2CL', () => {
    const r = run({ notes: [note({ number: 'CN-202627-00002', date: '2026-07-20', party: PARTIES.gujaratRetail, taxable: 100000, rate: 12 })],
      sales: [sale({ number: 'INV/202627/00011', date: '2026-07-01', customer: PARTIES.abcMedical })] });
    assert.deepEqual(r.payload.cdnur[0], {
      typ: 'B2CL', ntty: 'C', nt_num: 'CN-202627-00002', nt_dt: '20-07-2026', val: 112000, pos: '24',
      itms: [{ num: 1, itm_det: { txval: 100000, rt: 12, iamt: 12000, csamt: 0 } }],
    });
    assert.equal(r.schema.valid, true);
  });

  test('5c. Purchase-side debit note (Input tax ledgers) is not part of GSTR-1', () => {
    const v = note({ type: 'DEBIT_NOTE', number: 'DN-202627-00009', date: '2026-07-20', party: PARTIES.supplier, taxable: 1000, rate: 12 });
    v.lines = v.lines.map((l) => (l.ledger.name.startsWith('Output') ? { ...l, ledger: { name: l.ledger.name.replace('Output', 'Input') } } : l));
    const r = run({ notes: [v], sales: [sale({ number: 'INV/202627/00012', date: '2026-07-01', customer: PARTIES.abcMedical })] });
    assert.equal(r.payload.cdnr, undefined);
    assert.equal(r.counts.inwardNotesSkipped, 1);
  });

  test('7. Multiple GST rates on one invoice → one item per rate, never merged', () => {
    const r = run({ sales: [sale({ number: 'INV/202627/00020', date: '2026-07-10', customer: PARTIES.abcMedical, lines: [
      { product: PRODUCTS.paracetamol, qty: 10, rate: 100 },
      { product: PRODUCTS.syrup, qty: 5, rate: 100 },
      { product: PRODUCTS.device, qty: 1, rate: 2000 },
      { product: PRODUCTS.paracetamol, qty: 2, rate: 50 },
    ] })] });
    const itms = r.payload.b2b[0].inv[0].itms;
    assert.deepEqual(itms.map((i) => [i.itm_det.rt, i.itm_det.txval]), [[5, 1100], [12, 500], [18, 2000]]);
    assert.equal(r.payload.b2b[0].inv[0].val, 1100 * 1.05 + 500 * 1.12 + 2000 * 1.18);
    assert.equal(r.schema.valid, true);
  });

  test('8. Multiple HSNs → HSN summary per HSN+rate, B2B tab, UQC mapped', () => {
    const r = run({ sales: [sale({ number: 'INV/202627/00021', date: '2026-07-10', customer: PARTIES.abcMedical, lines: [
      { product: PRODUCTS.paracetamol, qty: 10, rate: 100 },
      { product: PRODUCTS.syrup, qty: 5, rate: 100 },
      { product: PRODUCTS.bandage, qty: 4, rate: 25 },
    ] })] });
    const rows = r.payload.hsn.hsn_b2b;
    assert.deepEqual(rows.map((h) => [h.hsn_sc, h.uqc, h.qty, h.rt, h.txval]), [
      ['30049011', 'BTL', 5, 12, 500], ['30049099', 'OTH', 10, 5, 1000], ['3005', 'PCS', 4, 12, 100],
    ]);
    assert.equal(r.payload.hsn.hsn_b2c, undefined);
    // STRIP is not a UQC → reported, not silently changed; 4-digit HSN → AATO warning
    assert.ok(r.issues.some((i) => i.field === 'UQC' && /STRIP/.test(i.message)));
    assert.ok(r.issues.some((i) => i.field === 'HSN' && /4-digit/.test(i.message)));
  });

  test('9/10. Exempt and nil-rated supplies → nil table (and 0% lines on taxable invoices)', () => {
    const r = run({ sales: [
      sale({ number: 'INV/202627/00030', date: '2026-07-11', customer: PARTIES.walkIn, supplyType: 'EXEMPT' }),
      sale({ number: 'INV/202627/00031', date: '2026-07-11', customer: PARTIES.karnatakaPharma, supplyType: 'NIL_RATED' }),
      sale({ number: 'INV/202627/00032', date: '2026-07-11', customer: PARTIES.abcMedical, lines: [
        { product: PRODUCTS.paracetamol, qty: 10, rate: 100 }, { product: PRODUCTS.freshFruit, qty: 3, rate: 100 },
      ] }),
    ] });
    assert.deepEqual(r.payload.nil.inv, [
      { sply_ty: 'INTRB2B', expt_amt: 0, nil_amt: 1000, ngsup_amt: 0 },
      { sply_ty: 'INTRAB2B', expt_amt: 0, nil_amt: 300, ngsup_amt: 0 },
      { sply_ty: 'INTRAB2C', expt_amt: 1000, nil_amt: 0, ngsup_amt: 0 },
    ]);
    const b2bInv = r.payload.b2b[0].inv[0];
    assert.equal(b2bInv.itms.length, 1); // 0% line is not an itm of the B2B invoice
    assert.equal(b2bInv.val, 1350); // invoice value stays the full document value
    assert.equal(r.schema.valid, true, JSON.stringify(r.schema.errors));
  });
});

describe('GSTR-1 validation', () => {
  test('11. Missing GSTIN on SEZ supply is an error and the invoice is excluded', () => {
    const r = run({ sales: [
      sale({ number: 'SEZ/2', date: '2026-07-09', customer: { ...PARTIES.sezUnit, gstin: null }, supplyType: 'ZERO_RATED_SEZ' }),
      sale({ number: 'INV/202627/00040', date: '2026-07-09', customer: PARTIES.abcMedical }),
    ] });
    assert.ok(errorsFor(r, 'SEZ/2').some((i) => i.field === 'GSTIN'));
    assert.equal(r.records.withErrors, 1);
    assert.equal(r.payload.b2b.length, 1);
    assert.equal(r.payload.b2b[0].inv[0].inum, 'INV/202627/00040');
  });

  test('12. Invalid GSTIN is reported (not exported), with section/field/suggestion', () => {
    const r = run({ sales: [sale({ number: 'INV-1025', date: '2026-07-12', customer: { ...PARTIES.abcMedical, gstin: '27AAACR5055K1Z8' } })] });
    const [e] = errorsFor(r, 'INV-1025');
    assert.equal(e.section, 'B2B');
    assert.equal(e.field, 'GSTIN');
    assert.match(e.message, /check digit/);
    assert.ok(e.suggestion);
    assert.equal(r.payload.b2b, undefined);
    assert.equal(r.canGenerate, false); // nothing left to report
  });

  test('13. Missing HSN: error for B2B, warning for B2C', () => {
    const r = run({ sales: [
      sale({ number: 'INV/202627/00050', date: '2026-07-12', customer: PARTIES.abcMedical, lines: [{ qty: 1, rate: 100, hsnCode: '' }] }),
      sale({ number: 'INV/202627/00051', date: '2026-07-12', customer: PARTIES.walkIn, lines: [{ qty: 1, rate: 100, hsnCode: null }] }),
    ] });
    assert.ok(errorsFor(r, 'INV/202627/00050').some((i) => i.field === 'HSN'));
    assert.deepEqual(errorsFor(r, 'INV/202627/00051'), []);
    assert.ok(r.issues.some((i) => i.documentNumber === 'INV/202627/00051' && i.field === 'HSN' && i.severity === 'warning'));
    assert.equal(r.payload.b2cs[0].txval, 100);
  });

  test('13b. Malformed HSN on the invoice: error until the product master is corrected, then used with a warning', () => {
    const bad = () => sale({ number: 'INV/202627/00052', date: '2026-07-12', customer: PARTIES.abcMedical, lines: [{ qty: 1, rate: 100, hsnCode: '48949' }] });
    const before = run({ sales: [bad()] });
    assert.ok(errorsFor(before, 'INV/202627/00052').some((i) => i.field === 'HSN'));

    const fixed = bad();
    fixed.items[0].product.hsnCode = '30049099'; // user corrects the product master; the line still says 48949
    const after = run({ sales: [fixed] });
    assert.deepEqual(errorsFor(after, 'INV/202627/00052'), []);
    assert.ok(after.issues.some((i) => i.severity === 'warning' && /48949/.test(i.message) && /30049099/.test(i.message)));
    assert.equal(after.payload.hsn.hsn_b2b[0].hsn_sc, '30049099');
  });

  test('14. Tax that does not reconcile with the rate is an error, not corrected', () => {
    const bad = sale({ number: 'INV/202627/00060', date: '2026-07-13', customer: PARTIES.abcMedical });
    bad.items[0].cgstAmount = bad.items[0].cgstAmount.add(10);
    const r = run({ sales: [bad] });
    const fields = errorsFor(r, 'INV/202627/00060').map((i) => i.field);
    assert.ok(fields.includes('Tax Amount'));
    assert.ok(fields.includes('CGST/SGST'));
    assert.equal(r.payload.b2b, undefined);
  });

  test('14b. IGST on an intra-state supply is flagged', () => {
    const bad = sale({ number: 'INV/202627/00061', date: '2026-07-13', customer: PARTIES.abcMedical });
    bad.items[0].igstAmount = bad.items[0].cgstAmount.add(bad.items[0].sgstAmount);
    bad.items[0].cgstAmount = bad.items[0].sgstAmount = bad.items[0].igstAmount.mul(0);
    const r = run({ sales: [bad] });
    assert.ok(errorsFor(r, 'INV/202627/00061').some((i) => i.field === 'Tax Type'));
  });

  test('15. Cancelled invoice excluded from tables but counted in Table 13', () => {
    const r = run({ sales: [
      sale({ number: 'INV/202627/00070', date: '2026-07-14', customer: PARTIES.abcMedical }),
      sale({ number: 'INV/202627/00071', date: '2026-07-14', customer: PARTIES.abcMedical, cancelled: true }),
      sale({ number: 'INV/202627/00072', date: '2026-07-14', customer: PARTIES.abcMedical }),
    ] });
    assert.deepEqual(r.payload.b2b[0].inv.map((i) => i.inum), ['INV/202627/00070', 'INV/202627/00072']);
    assert.deepEqual(r.payload.doc_issue.doc_det[0].docs[0], { num: 1, from: 'INV/202627/00070', to: 'INV/202627/00072', totnum: 3, cancel: 1, net_issue: 2 });
  });

  test('15b. Numbering gaps: never-issued numbers count as cancelled; numbers dated in another period do not', () => {
    const inv = (n, date = '2026-08-10') => sale({ number: `INV/202627/0000${n}`, date, customer: PARTIES.abcMedical });
    const aug = resolveReturnPeriod({ returnType: 'GSTR1', financialYear: '2026-27', month: 8 });
    const r = run({ period: aug, sales: [inv(1), inv(2), inv(4), inv(6)] });
    assert.deepEqual(r.payload.doc_issue.doc_det[0].docs[0], { num: 1, from: 'INV/202627/00001', to: 'INV/202627/00006', totnum: 6, cancel: 2, net_issue: 4 });
    assert.ok(r.issues.some((i) => i.field === 'Series' && /00003, INV\/202627\/00005/.test(i.message)));

    const r2 = run({ period: aug, sales: [inv(1), inv(2), inv(4), inv(6)], otherNumbersInFy: new Set(['INVOICE|INV/202627/00003']) });
    assert.deepEqual(r2.payload.doc_issue.doc_det[0].docs[0], { num: 1, from: 'INV/202627/00001', to: 'INV/202627/00006', totnum: 5, cancel: 1, net_issue: 4 });
    assert.ok(r2.issues.some((i) => i.field === 'Series' && /dated in another period/.test(i.message)));
  });

  test('POS different from a registered customer\'s GSTIN state is flagged for review', () => {
    const r = run({ sales: [sale({ number: 'INV/202627/00090', date: '2026-07-10', customer: PARTIES.abcMedical, placeOfSupply: 'Goa' })] });
    assert.equal(r.payload.b2b[0].inv[0].pos, '30');
    assert.ok(r.issues.some((i) => i.severity === 'warning' && i.field === 'POS' && /IGST charged/.test(i.message)));
  });

  test('16. Duplicate invoice numbers (case-insensitive, also across the FY) are errors', () => {
    const r = run({
      sales: [
        sale({ number: 'inv-500', date: '2026-07-14', customer: PARTIES.abcMedical }),
        sale({ number: 'INV-500', date: '2026-07-15', customer: PARTIES.abcMedical }),
        sale({ number: 'INV-400', date: '2026-07-15', customer: PARTIES.abcMedical }),
      ],
      otherNumbersInFy: new Set(['INVOICE|INV-400']),
    });
    for (const n of ['inv-500', 'INV-500', 'INV-400']) assert.ok(errorsFor(r, n).some((i) => i.field === 'Duplicate Number'), n);
  });

  test('17. Financial-year boundary: March 2027 belongs to FY 2026-27, April 2027 to FY 2027-28', () => {
    const march = resolveReturnPeriod({ returnType: 'GSTR1', financialYear: '2026-27', month: 3 });
    assert.equal(march.fp, '032027');
    assert.equal(march.startDate.toISOString(), '2027-03-01T00:00:00.000Z');
    assert.equal(march.endDate.toISOString(), '2027-03-31T23:59:59.999Z');
    const april = resolveReturnPeriod({ returnType: 'GSTR1', financialYear: '2027-28', month: 4 });
    assert.equal(april.fp, '042027');
    const q4 = resolveReturnPeriod({ returnType: 'GSTR1', frequency: 'QUARTERLY', financialYear: '2026-27', month: 2 });
    assert.equal(q4.fp, '032027');
    assert.equal(q4.startDate.toISOString(), '2027-01-01T00:00:00.000Z');
    assert.throws(() => resolveReturnPeriod({ returnType: 'IFF', financialYear: '2026-27', month: 9 }), /first two months/);

    // An invoice dated outside the period is rejected, not silently moved.
    const r = run({ period: march, sales: [sale({ number: 'INV/202627/09999', date: '2027-04-01', customer: PARTIES.abcMedical })] });
    assert.ok(errorsFor(r, 'INV/202627/09999').some((i) => i.field === 'Date'));
  });

  test('Company GSTIN / state mismatch blocks generation', () => {
    const r = runGstr1Pipeline({ company: { ...COMPANY, state: 'Gujarat' }, period: JULY_2026(), ...docs({ sales: [sale({ number: 'A1', date: '2026-07-01', customer: PARTIES.abcMedical })] }) });
    assert.ok(r.issues.some((i) => i.section === 'COMPANY' && i.field === 'State Code'));
    assert.equal(r.canGenerate, false);
  });

  test('Custom date range can be previewed but never generates a return JSON', () => {
    const r = run({ period: resolveCustomRange({ from: '2026-07-01', to: '2026-07-15' }), sales: [sale({ number: 'A2', date: '2026-07-01', customer: PARTIES.abcMedical })] });
    assert.equal(r.canGenerate, false);
    assert.match(r.blockers[0], /internal review/);
    assert.equal(r.schema.valid, true); // structure still checked for review
    assert.equal(r.blockers.length, 1);
  });

  test('IFF carries only B2B and CDNR', () => {
    const period = resolveReturnPeriod({ returnType: 'IFF', financialYear: '2026-27', month: 7 });
    const r = run({ period, sales: [
      sale({ number: 'I1', date: '2026-07-01', customer: PARTIES.abcMedical }),
      sale({ number: 'I2', date: '2026-07-01', customer: PARTIES.walkIn }),
    ] });
    assert.deepEqual(Object.keys(r.payload), ['gstin', 'fp', 'version', 'hash', 'b2b']);
    assert.equal(r.counts.notInThisReturn, 1);
    assert.equal(r.schema.valid, true);
  });

  test('Quarterly GSTR-1 after IFF leaves months 1-2 B2B out of b2b but keeps them in HSN', () => {
    const period = resolveReturnPeriod({ returnType: 'GSTR1', frequency: 'QUARTERLY', financialYear: '2026-27', month: 9 });
    const r = run({ period, iffFiledForQuarter: true, sales: [
      sale({ number: 'Q1', date: '2026-07-01', customer: PARTIES.abcMedical }),
      sale({ number: 'Q2', date: '2026-09-01', customer: PARTIES.abcMedical }),
    ] });
    assert.deepEqual(r.payload.b2b[0].inv.map((i) => i.inum), ['Q2']);
    assert.equal(r.payload.hsn.hsn_b2b[0].txval, 2000);
    assert.equal(r.payload.doc_issue.doc_det[0].docs[0].totnum, 2);
  });
});

describe('Schema validation', () => {
  test('detects missing fields, bad types, bad values, bad GSTIN, wrong tax heads', () => {
    const r = run({ sales: [sale({ number: 'INV/202627/00080', date: '2026-07-01', customer: PARTIES.abcMedical })] });
    const p = structuredClone(r.payload);
    delete p.b2b[0].inv[0].pos;
    p.b2b[0].inv[0].idt = '2026-07-01';
    p.b2b[0].inv[0].val = '1050';
    p.b2b[0].inv[0].itms[0].itm_det.rt = 13;
    p.b2b[0].inv[0].itms[0].itm_det.iamt = 50;
    p.b2b[0].ctin = '27AAACR5055K1Z8';
    p.fp = '132026';
    const v = validateGstr1Json(p);
    assert.equal(v.valid, false);
    const has = (field, section = 'B2B') => v.errors.some((e) => e.field === field && e.section === section);
    assert.ok(has('POS'), 'missing pos');
    assert.ok(has('Invoice Date'), 'bad date');
    assert.ok(has('Invoice Value'), 'bad type');
    assert.ok(has('GST Rate'), 'bad rate');
    assert.ok(has('GSTIN'), 'bad gstin checksum');
    assert.ok(has('Return Period', 'HEADER'), 'bad fp');
    assert.ok(v.errors.some((e) => /IGST for inter-state/.test(e.message)), 'mixed tax heads');
    assert.ok(v.errors.every((e) => e.document === 'INV/202627/00080' || e.section === 'HEADER' || e.field === 'GSTIN'));
  });

  test('unknown fields (custom/proprietary keys) are rejected', () => {
    const r = run({ sales: [sale({ number: 'INV/202627/00081', date: '2026-07-01', customer: PARTIES.abcMedical })] });
    const v = validateGstr1Json({ ...r.payload, invoiceNo: 'x' });
    assert.equal(v.valid, false);
  });
});

describe('File size and splitting', () => {
  const many = (n) => Array.from({ length: n }, (_, i) => sale({
    number: `INV/202627/${String(i + 1).padStart(5, '0')}`, date: '2026-07-15',
    customer: i % 3 === 0 ? PARTIES.karnatakaPharma : PARTIES.abcMedical,
    lines: [{ product: PRODUCTS.paracetamol, qty: 1 + (i % 7), rate: 100 }, { product: PRODUCTS.syrup, qty: 2, rate: 55 }],
  }));

  test('18. Large number of invoices is processed and stays schema-valid', () => {
    const r = run({ sales: many(3000) });
    assert.equal(r.counts.b2b, 3000);
    assert.equal(r.records.withErrors, 0);
    assert.equal(r.schema.valid, true);
    assert.equal(r.files.length, 1);
    assert.ok(r.files[0].withinLimit);
  });

  test('19/20. JSON over the limit is split at invoice boundaries into valid parts', () => {
    const r = run({ sales: many(600), notes: [note({ number: 'CN-202627-00001', date: '2026-07-20', party: PARTIES.abcMedical, taxable: 100, rate: 5 })], sizeLimitBytes: 40 * 1024 });
    assert.ok(r.totalBytes > 40 * 1024);
    assert.ok(r.files.length > 1);
    const invoiceNumbers = [];
    r.files.forEach((f, idx) => {
      assert.ok(f.sizeBytes <= 40 * 1024, `part ${idx + 1} too big`);
      assert.equal(f.schemaValid, true);
      assert.equal(validateGstr1Json(f.payload).valid, true);
      assert.equal(f.payload.gstin, COMPANY.gstin);
      assert.equal(f.payload.fp, '072026');
      for (const g of f.payload.b2b || []) for (const inv of g.inv) invoiceNumbers.push(inv.inum);
    });
    assert.match(r.files[0].fileName, /^Returns_GSTR1_2026-07_27AAPFU0939F1ZV_offline_01\.json$/);
    // Summary tables only in part 1; every invoice exactly once, none lost
    assert.ok(r.files[0].payload.hsn && r.files[0].payload.doc_issue);
    assert.ok(r.files.slice(1).every((f) => !f.payload.hsn && !f.payload.doc_issue && !f.payload.b2cs));
    assert.equal(invoiceNumbers.length, 600);
    assert.equal(new Set(invoiceNumbers).size, 600);
    assert.equal(r.files.reduce((s, f) => s + (f.payload.cdnr ? 1 : 0), 0), 1);
  });

  test('a payload within the limit is not split', () => {
    const r = run({ sales: many(5) });
    const { parts, split } = splitPayload(r.payload);
    assert.equal(split, false);
    assert.equal(byteSize(parts[0]), r.totalBytes);
    assert.equal(r.files[0].fileName, 'Returns_GSTR1_2026-07_27AAPFU0939F1ZV_offline.json');
  });
});
