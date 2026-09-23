// Mapping layer: classified documents → GSTR-1 offline-upload JSON.
// This is the only module that knows the GSTN field names (ctin, inum, idt,
// txval, …). If GSTN revises the format, this file and the schema under
// ./schema are what change; classification and validation stay as they are.

import { resolveUqc } from '../reference/uqc.js';
import { DOC_TYPES, SECTIONS, ZERO, dec, money } from './constants.js';
import { issueFor } from './validator.js';

/** dd-mm-yyyy (UTC date parts: billing stores dates as UTC midnight). */
export function gstDate(date) {
  const d = String(date.getUTCDate()).padStart(2, '0');
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${d}-${m}-${date.getUTCFullYear()}`;
}

const byDateThenNumber = (a, b) => a.doc.date - b.doc.date || String(a.doc.number).localeCompare(String(b.doc.number));

function groupBy(list, keyFn) {
  const map = new Map();
  for (const x of list) {
    const k = keyFn(x);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(x);
  }
  return map;
}

/** Tax amounts for one rate bucket, carrying only the heads that apply. */
function taxHeads(b, interState) {
  return interState
    ? { iamt: money(b.igst), csamt: money(b.cess) }
    : { camt: money(b.cgst), samt: money(b.sgst), csamt: money(b.cess) };
}

/** One entry per GST rate — GSTN rejects an invoice that repeats a rate. */
function rateBuckets(items) {
  const buckets = new Map();
  for (const i of items) {
    const rt = Number(i.rate);
    if (!buckets.has(rt)) buckets.set(rt, { rt, txval: ZERO, igst: ZERO, cgst: ZERO, sgst: ZERO, cess: ZERO });
    const b = buckets.get(rt);
    b.txval = b.txval.add(i.taxable);
    b.igst = b.igst.add(i.igst);
    b.cgst = b.cgst.add(i.cgst);
    b.sgst = b.sgst.add(i.sgst);
    b.cess = b.cess.add(i.cess);
  }
  return [...buckets.values()].sort((a, b) => a.rt - b.rt);
}

const numberedItems = (items, interState) =>
  rateBuckets(items).map((b, idx) => ({ num: idx + 1, itm_det: { txval: money(b.txval), rt: b.rt, ...taxHeads(b, interState) } }));

// ── Section builders ───────────────────────────────────────────────────────

function buildB2b(records) {
  const byCtin = groupBy(records.sort(byDateThenNumber), (r) => r.doc.party.gstin);
  return [...byCtin.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([ctin, rs]) => ({
    ctin,
    inv: rs.map(({ doc, cls }) => ({
      inum: doc.number,
      idt: gstDate(doc.date),
      val: money(doc.value),
      pos: cls.posCode,
      rchrg: 'N',
      inv_typ: cls.invTyp,
      itms: numberedItems(cls.taxItems, cls.interState),
    })),
  }));
}

function buildB2cl(records) {
  const byPos = groupBy(records.sort(byDateThenNumber), (r) => r.cls.posCode);
  return [...byPos.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([pos, rs]) => ({
    pos,
    inv: rs.map(({ doc, cls }) => ({
      inum: doc.number,
      idt: gstDate(doc.date),
      val: money(doc.value),
      itms: numberedItems(cls.taxItems, true),
    })),
  }));
}

function buildExp(records) {
  const byType = groupBy(records.sort(byDateThenNumber), (r) => r.cls.expTyp);
  return ['WPAY', 'WOPAY'].filter((t) => byType.has(t)).map((exp_typ) => ({
    exp_typ,
    inv: byType.get(exp_typ).map(({ doc, cls }) => ({
      inum: doc.number,
      idt: gstDate(doc.date),
      val: money(doc.value),
      itms: rateBuckets(cls.taxItems).map((b) => ({ txval: money(b.txval), rt: b.rt, iamt: money(b.igst), csamt: money(b.cess) })),
    })),
  }));
}

/** B2CS: consolidated by (supply type, POS, rate), net of notes against B2CS supplies. */
function buildB2cs(invoiceRecords, noteRecords) {
  const rows = new Map();
  const bucket = (cls, rt) => {
    const sply_ty = cls.interState ? 'INTER' : 'INTRA';
    const key = `${sply_ty}|${cls.posCode}|${rt}`;
    if (!rows.has(key)) rows.set(key, { sply_ty, pos: cls.posCode, rt, txval: ZERO, igst: ZERO, cgst: ZERO, sgst: ZERO, cess: ZERO, interState: cls.interState });
    return rows.get(key);
  };
  const addTo = (row, x, sign) => {
    row.txval = row.txval.add(dec(x.taxable ?? x.txval).mul(sign));
    row.igst = row.igst.add(x.igst.mul(sign));
    row.cgst = row.cgst.add(x.cgst.mul(sign));
    row.sgst = row.sgst.add(x.sgst.mul(sign));
    row.cess = row.cess.add(x.cess.mul(sign));
  };

  for (const { cls } of invoiceRecords) {
    for (const b of rateBuckets(cls.taxItems)) addTo(bucket(cls, b.rt), b, 1);
  }
  for (const { doc, cls } of noteRecords) addTo(bucket(cls, cls.rate), doc, doc.noteType === 'C' ? -1 : 1);

  return [...rows.values()]
    .sort((a, b) => a.pos.localeCompare(b.pos) || a.rt - b.rt || a.sply_ty.localeCompare(b.sply_ty))
    .map((r) => ({ sply_ty: r.sply_ty, rt: r.rt, typ: 'OE', pos: r.pos, txval: money(r.txval), ...taxHeads(r, r.interState) }));
}

function noteItems(doc, cls) {
  const heads = cls.interState ? { iamt: money(doc.igst), csamt: money(doc.cess) } : { camt: money(doc.cgst), samt: money(doc.sgst), csamt: money(doc.cess) };
  return [{ num: 1, itm_det: { txval: money(doc.taxable), rt: cls.rate, ...heads } }];
}

function buildCdnr(records) {
  const byCtin = groupBy(records.sort(byDateThenNumber), (r) => r.doc.party.gstin);
  return [...byCtin.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([ctin, rs]) => ({
    ctin,
    nt: rs.map(({ doc, cls }) => ({
      ntty: doc.noteType,
      nt_num: doc.number,
      nt_dt: gstDate(doc.date),
      val: money(doc.value),
      pos: cls.posCode,
      rchrg: 'N',
      inv_typ: 'R',
      itms: noteItems(doc, cls),
    })),
  }));
}

function buildCdnur(records) {
  return records.sort(byDateThenNumber).map(({ doc, cls }) => ({
    typ: 'B2CL',
    ntty: doc.noteType,
    nt_num: doc.number,
    nt_dt: gstDate(doc.date),
    val: money(doc.value),
    pos: cls.posCode,
    itms: noteItems(doc, cls),
  }));
}

/** Table 8: nil-rated / exempt / non-GST, by inter/intra × registered/unregistered. */
function buildNil(invoiceRecords) {
  const order = ['INTRB2B', 'INTRAB2B', 'INTRB2C', 'INTRAB2C'];
  const rows = new Map();
  for (const { cls } of invoiceRecords) {
    if (!cls.nilItems.length) continue;
    if (!rows.has(cls.nilSplyTy)) rows.set(cls.nilSplyTy, { nil: ZERO, expt: ZERO, ngsup: ZERO });
    const row = rows.get(cls.nilSplyTy);
    const amount = cls.nilItems.reduce((s, i) => s.add(i.taxable), ZERO);
    row[cls.nilKind] = row[cls.nilKind].add(amount);
  }
  const inv = order.filter((k) => rows.has(k)).map((sply_ty) => {
    const r = rows.get(sply_ty);
    return { sply_ty, expt_amt: money(r.expt), nil_amt: money(r.nil), ngsup_amt: money(r.ngsup) };
  });
  return inv.length ? { inv } : null;
}

/** Table 12, split into the B2B and B2C tabs (Phase-III, from May 2025). */
function buildHsn(invoiceRecords) {
  const tables = { b2b: new Map(), b2c: new Map() };
  const issues = [];

  for (const { doc, cls } of invoiceRecords) {
    if (doc.supplyType === 'NON_GST') continue; // non-GST supplies are outside Table 12
    for (const item of [...cls.taxItems, ...cls.nilItems]) {
      if (!/^\d{4}$|^\d{6}$|^\d{8}$/.test(item.hsn || '')) continue; // reported by the validator
      const isService = item.hsn.startsWith('99');
      const { uqc, exact } = resolveUqc(item.unit, { isService });
      const rt = Number(item.rate);
      const key = `${item.hsn}|${uqc}|${rt}`;
      const table = tables[cls.hsnTable];
      if (!table.has(key)) {
        table.set(key, { hsn_sc: item.hsn, uqc, rt, qty: 0, txval: ZERO, igst: ZERO, cgst: ZERO, sgst: ZERO, cess: ZERO, units: new Set(), exact: true, isService });
      }
      const row = table.get(key);
      row.qty += isService ? 0 : item.qty;
      row.txval = row.txval.add(item.taxable);
      row.igst = row.igst.add(item.igst);
      row.cgst = row.cgst.add(item.cgst);
      row.sgst = row.sgst.add(item.sgst);
      row.cess = row.cess.add(item.cess);
      if (!exact) { row.exact = false; row.units.add(item.unit || '(blank)'); }
    }
  }

  const toRows = (table, tab) => [...table.values()]
    .sort((a, b) => a.hsn_sc.localeCompare(b.hsn_sc) || a.rt - b.rt)
    .map((r, idx) => {
      const pseudoDoc = { number: `HSN ${r.hsn_sc} @ ${r.rt}%` };
      if (!r.exact) {
        issues.push(issueFor(pseudoDoc, { severity: 'warning', section: SECTIONS.HSN, field: 'UQC',
          message: `Unit(s) ${[...r.units].join(', ')} are not GST UQCs; reported as OTH in the ${tab.toUpperCase()} HSN summary.`,
          suggestion: 'If a specific UQC applies (NOS, PCS, BOX, BTL…), set it as the product unit.' }));
      }
      if (r.hsn_sc.length === 4) {
        issues.push(issueFor(pseudoDoc, { severity: 'warning', section: SECTIONS.HSN, field: 'HSN',
          message: `4-digit HSN ${r.hsn_sc}.`, suggestion: 'Allowed only if aggregate turnover in the previous FY was up to Rs 5 crore; otherwise use at least 6 digits.' }));
      }
      return {
        num: idx + 1,
        hsn_sc: r.hsn_sc,
        uqc: r.uqc,
        qty: Math.round(r.qty * 100) / 100,
        rt: r.rt,
        txval: money(r.txval),
        iamt: money(r.igst),
        camt: money(r.cgst),
        samt: money(r.sgst),
        csamt: money(r.cess),
      };
    });

  const hsn_b2b = toRows(tables.b2b, 'b2b');
  const hsn_b2c = toRows(tables.b2c, 'b2c');
  const hsn = {};
  if (hsn_b2b.length) hsn.hsn_b2b = hsn_b2b;
  if (hsn_b2c.length) hsn.hsn_b2c = hsn_b2c;
  return { hsn: Object.keys(hsn).length ? hsn : null, issues };
}

/**
 * Table 13. Documents are grouped into series by the text before their
 * trailing number (INV/202627/00001 → "INV/202627/"). Cancelled documents
 * count towards totnum and cancel; net_issue = totnum − cancel.
 */
export function buildDocIssue(seriesInput, otherNumbersInFy = new Set()) {
  const issues = [];
  const doc_det = [];
  for (const [kind, meta] of Object.entries(DOC_TYPES)) {
    const docs = seriesInput[kind] || [];
    if (!docs.length) continue;
    const series = groupBy(docs, (d) => String(d.number).replace(/\d+$/, ''));
    const rows = [...series.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([prefix, ds], idx) => {
      const sorted = [...ds].sort((a, b) => {
        const na = Number(String(a.number).match(/(\d+)$/)?.[1] ?? 0);
        const nb = Number(String(b.number).match(/(\d+)$/)?.[1] ?? 0);
        return na - nb || String(a.number).localeCompare(String(b.number));
      });
      let totnum = sorted.length;
      let cancel = sorted.filter((d) => d.cancelled).length;

      // Gaps inside from–to: numbers that exist nowhere else in the FY were
      // skipped/deleted and are reported as cancelled (totnum = range size),
      // the usual Table 13 treatment. Numbers dated in another period can't
      // be counted here, so those only raise a warning.
      const nums = sorted.map((d) => String(d.number).match(/(\d+)$/)?.[1]);
      if (nums.every(Boolean) && nums.length > 1) {
        const width = nums[0].length;
        const present = new Set(nums.map(Number));
        const missing = [];
        for (let n = Number(nums[0]); n <= Number(nums[nums.length - 1]); n++) if (!present.has(n)) missing.push(`${prefix}${String(n).padStart(width, '0')}`);
        const otherKind = kind === 'INVOICE' ? 'INVOICE' : 'NOTE';
        const elsewhere = missing.filter((num) => otherNumbersInFy.has(`${otherKind}|${num.toUpperCase()}`));
        const neverIssued = missing.filter((num) => !elsewhere.includes(num));
        if (neverIssued.length) {
          totnum += neverIssued.length;
          cancel += neverIssued.length;
          issues.push(issueFor({ number: `${prefix}*` }, { severity: 'warning', section: SECTIONS.DOC, field: 'Series',
            message: `${meta.doc_typ}: ${neverIssued.join(', ')} ${neverIssued.length === 1 ? 'does' : 'do'} not exist and ${neverIssued.length === 1 ? 'is' : 'are'} reported as cancelled in Table 13.`,
            suggestion: 'Confirm these numbers were skipped or deleted. If they were issued, record the invoices before filing.' }));
        }
        if (elsewhere.length) {
          issues.push(issueFor({ number: `${prefix}*` }, { severity: 'warning', section: SECTIONS.DOC, field: 'Series',
            message: `${meta.doc_typ}: ${elsewhere.join(', ')} fall inside ${sorted[0].number} – ${sorted[sorted.length - 1].number} but are dated in another period.`,
            suggestion: 'Invoices should be numbered in date order; check the dates of these invoices.' }));
        }
      }
      return { num: idx + 1, from: sorted[0].number, to: sorted[sorted.length - 1].number, totnum, cancel, net_issue: totnum - cancel };
    });
    doc_det.push({ doc_num: meta.doc_num, doc_typ: meta.doc_typ, docs: rows });
  }
  return { doc_issue: doc_det.length ? { doc_det } : null, issues };
}

/**
 * @param {object} p
 * @param {{gstin:string}} p.company
 * @param {{fp:string}} p.period
 * @param {string} p.version        offline-tool version string, e.g. "GST3.2.4"
 * @param {object[]} p.invoices     [{ doc, cls }] validated invoices to report
 * @param {object[]} p.notes        [{ doc, cls }] validated notes to report
 * @param {object} p.docSeries      { INVOICE: [...], CREDIT_NOTE: [...], DEBIT_NOTE: [...] }
 * @param {string[]} p.sections     sections this return carries (GSTR-1 vs IFF)
 * @param {Set<string>} [p.excludeFromDocTables] document ids already furnished via IFF
 */
export function mapToGstr1Json({ company, period, version, invoices, notes, docSeries, sections, excludeFromDocTables = new Set(), otherNumbersInFy = new Set() }) {
  const want = (s) => sections.includes(s);
  // excludeFromDocTables: documents already furnished elsewhere (IFF) — kept
  // out of the invoice/note tables but still counted in HSN and Table 13.
  const of = (list, section) => list.filter((r) => r.cls.section === section && !excludeFromDocTables.has(r.doc.id));
  const payload = { gstin: company.gstin, fp: period.fp, version, hash: 'hash' };
  const issues = [];

  const b2b = want('b2b') ? buildB2b(of(invoices, SECTIONS.B2B)) : [];
  if (b2b.length) payload.b2b = b2b;
  const b2cl = want('b2cl') ? buildB2cl(of(invoices, SECTIONS.B2CL)) : [];
  if (b2cl.length) payload.b2cl = b2cl;
  const b2cs = want('b2cs') ? buildB2cs(of(invoices, SECTIONS.B2CS), of(notes, SECTIONS.B2CS)) : [];
  if (b2cs.length) payload.b2cs = b2cs;
  const exp = want('exp') ? buildExp(of(invoices, SECTIONS.EXP)) : [];
  if (exp.length) payload.exp = exp;
  const cdnr = want('cdnr') ? buildCdnr(of(notes, SECTIONS.CDNR)) : [];
  if (cdnr.length) payload.cdnr = cdnr;
  const cdnur = want('cdnur') ? buildCdnur(of(notes, SECTIONS.CDNUR)) : [];
  if (cdnur.length) payload.cdnur = cdnur;
  const nil = want('nil') ? buildNil(invoices) : null;
  if (nil) payload.nil = nil;
  if (want('hsn')) {
    const r = buildHsn(invoices);
    if (r.hsn) payload.hsn = r.hsn;
    issues.push(...r.issues);
  }
  if (want('doc_issue')) {
    const r = buildDocIssue(docSeries, otherNumbersInFy);
    if (r.doc_issue) payload.doc_issue = r.doc_issue;
    issues.push(...r.issues);
  }

  for (const row of payload.b2cs || []) {
    if (row.txval < 0) {
      issues.push(issueFor({ number: `B2CS ${row.pos} @ ${row.rt}%` }, { severity: 'warning', section: SECTIONS.B2CS, field: 'Taxable Value',
        message: `B2CS row (${row.sply_ty}, POS ${row.pos}, ${row.rt}%) is negative after credit notes.`,
        suggestion: 'Credit notes exceed supplies for this state and rate in the period; confirm the notes belong to this period.' }));
    }
  }
  return { payload, issues };
}

/** Totals and record counts straight from the JSON, so the preview matches the file exactly. */
export function summarizePayload(payload) {
  const t = { taxableValue: ZERO, igst: ZERO, cgst: ZERO, sgst: ZERO, cess: ZERO };
  const add = (d, sign = 1) => {
    t.taxableValue = t.taxableValue.add(dec(d.txval ?? 0).mul(sign));
    t.igst = t.igst.add(dec(d.iamt ?? 0).mul(sign));
    t.cgst = t.cgst.add(dec(d.camt ?? 0).mul(sign));
    t.sgst = t.sgst.add(dec(d.samt ?? 0).mul(sign));
    t.cess = t.cess.add(dec(d.csamt ?? 0).mul(sign));
  };
  for (const g of payload.b2b || []) for (const inv of g.inv) for (const i of inv.itms) add(i.itm_det);
  for (const g of payload.b2cl || []) for (const inv of g.inv) for (const i of inv.itms) add(i.itm_det);
  for (const r of payload.b2cs || []) add(r);
  for (const g of payload.exp || []) for (const inv of g.inv) for (const i of inv.itms) add(i);
  for (const g of payload.cdnr || []) for (const n of g.nt) for (const i of n.itms) add(i.itm_det, n.ntty === 'C' ? -1 : 1);
  for (const n of payload.cdnur || []) for (const i of n.itms) add(i.itm_det, n.ntty === 'C' ? -1 : 1);
  for (const r of payload.nil?.inv || []) t.taxableValue = t.taxableValue.add(dec(r.nil_amt)).add(dec(r.expt_amt)).add(dec(r.ngsup_amt));

  const count = (arr, key) => (arr || []).reduce((s, g) => s + g[key].length, 0);
  return {
    totals: Object.fromEntries(Object.entries(t).map(([k, v]) => [k, v.toFixed(2)])),
    counts: {
      b2b: count(payload.b2b, 'inv'),
      b2cl: count(payload.b2cl, 'inv'),
      b2cs: (payload.b2cs || []).length,
      exp: count(payload.exp, 'inv'),
      cdnr: count(payload.cdnr, 'nt'),
      cdnur: (payload.cdnur || []).length,
      nil: (payload.nil?.inv || []).length,
      hsnB2b: (payload.hsn?.hsn_b2b || []).length,
      hsnB2c: (payload.hsn?.hsn_b2c || []).length,
      docIssue: (payload.doc_issue?.doc_det || []).reduce((s, d) => s + d.docs.length, 0),
    },
  };
}
