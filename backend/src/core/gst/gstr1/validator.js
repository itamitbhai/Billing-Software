// Business validation of source data before it is mapped to the return JSON.
// Nothing here corrects data: every problem becomes an issue the user sees.
// severity "error"   → the document is excluded from the JSON (or, for
//                      company-level errors, nothing can be generated)
// severity "warning" → exported, but the user should review it

import { gstinError } from '../reference/gstin.js';
import { resolveStateCode } from '../reference/state-codes.js';
import { isValidGstRate } from '../reference/gst-rates.js';
import { DOC_NUMBER_PATTERN, SECTIONS, TOLERANCE, ZERO } from './constants.js';

export function issueFor(doc, { severity = 'error', section, field, message, suggestion }) {
  return {
    severity,
    section,
    documentId: doc?.id || null,
    documentType: doc ? (doc.kind === 'NOTE' ? (doc.noteType === 'C' ? 'Credit Note' : 'Debit Note') : 'Invoice') : null,
    documentNumber: doc?.number || null,
    documentDate: doc?.date ? doc.date.toISOString().slice(0, 10) : null,
    party: doc?.party?.name || null,
    gstin: doc?.party?.gstin || null,
    field,
    message,
    suggestion,
  };
}

const fmt = (d) => d.toFixed(2);

// ── Company ────────────────────────────────────────────────────────────────

export function validateCompany(company) {
  const issues = [];
  const add = (field, message, suggestion) => issues.push(issueFor(null, { section: SECTIONS.COMPANY, field, message, suggestion }));

  const gErr = gstinError(company.gstin);
  if (gErr) add('GSTIN', `Company ${gErr}.`, 'Enter the registered GSTIN under System Utilities → Company Profile.');

  const stateCode = resolveStateCode(company.state);
  if (!stateCode) add('State', `Company state "${company.state || ''}" is not a recognised Indian state/UT.`, 'Set the full state name (e.g. "Maharashtra") in Company Profile.');

  if (!gErr && stateCode && company.gstin.slice(0, 2) !== stateCode) {
    add('State Code', `GSTIN state code ${company.gstin.slice(0, 2)} does not match company state ${company.state} (${stateCode}).`,
      'Correct either the GSTIN or the company state so they refer to the same registration.');
  }
  return { issues, stateCode };
}

// ── Shared checks ──────────────────────────────────────────────────────────

function checkNumberAndDate(doc, section, period, add) {
  if (!DOC_NUMBER_PATTERN.test(doc.number || '')) {
    add({ field: doc.kind === 'NOTE' ? 'Note Number' : 'Invoice Number',
      message: `"${doc.number}" is not a valid GST document number (max 16 characters: letters, digits, "/" and "-").`,
      suggestion: 'Shorten the invoice prefix in Company Profile so numbers fit 16 characters.' });
  }
  if (Number.isNaN(doc.date.getTime())) {
    add({ field: 'Date', message: 'Document date is invalid.', suggestion: 'Correct the document date.' });
  } else if (period && (doc.date < period.startDate || doc.date > period.endDate)) {
    add({ field: 'Date', message: `Date ${doc.date.toISOString().slice(0, 10)} is outside the return period ${period.label}.`, suggestion: 'Select the return period the document belongs to.' });
  }
}

function checkTaxSplit(doc, x, { interState, igstOnly }, add, label) {
  if (interState || igstOnly) {
    if (x.cgst.gt(0) || x.sgst.gt(0)) {
      add({ field: 'Tax Type', message: `${label}: CGST/SGST charged on an ${igstOnly ? 'export/SEZ' : 'inter-state'} supply (IGST expected).`,
        suggestion: 'Check the place of supply; inter-state supplies must be taxed under IGST. Re-issue the document if the tax type is wrong.' });
    }
  } else {
    if (x.igst.gt(0)) {
      add({ field: 'Tax Type', message: `${label}: IGST charged on an intra-state supply (CGST+SGST expected).`,
        suggestion: 'Check the place of supply; intra-state supplies must be taxed under CGST+SGST.' });
    }
    if (x.cgst.sub(x.sgst).abs().gt('0.01')) {
      add({ field: 'CGST/SGST', message: `${label}: CGST (${fmt(x.cgst)}) and SGST (${fmt(x.sgst)}) must be equal.`, suggestion: 'Correct the tax split on the document.' });
    }
  }
}

function checkGstin(doc, section, companyGstin, add) {
  const err = gstinError(doc.party.gstin);
  if (err) {
    add({ field: 'GSTIN', message: `Invalid customer GSTIN: ${err}.`, suggestion: `Correct the GSTIN of "${doc.party.name}" in Masters → Parties.` });
  } else if (doc.party.gstin === companyGstin) {
    add({ field: 'GSTIN', message: 'Customer GSTIN is the same as the company GSTIN.', suggestion: 'A supplier cannot report a supply to its own GSTIN; correct the party master.' });
  }
}

// ── Invoices ───────────────────────────────────────────────────────────────

export function validateInvoice(doc, cls, ctx) {
  const issues = [];
  const add = (i) => issues.push(issueFor(doc, { section: cls.section, ...i }));
  const warn = (i) => add({ severity: 'warning', ...i });

  checkNumberAndDate(doc, cls.section, ctx.period, add);

  if (cls.posCode === null) {
    add({ field: 'POS', message: `Place of supply "${doc.placeOfSupply || ''}" is missing or not a recognised state.`,
      suggestion: 'Set the customer state in Masters → Parties (or the place of supply on the invoice).' });
  }
  if (doc.supplyType === 'ZERO_RATED_SEZ' && !cls.registered) {
    add({ field: 'GSTIN', message: 'SEZ supply without the SEZ unit\'s GSTIN.', suggestion: 'Add the SEZ unit\'s GSTIN to the party master.' });
  }
  if (cls.registered) checkGstin(doc, cls.section, ctx.companyGstin, add);
  if (cls.registered && cls.posCode && doc.supplyType === 'TAXABLE' && doc.party.gstin?.slice(0, 2) !== cls.posCode) {
    warn({ field: 'POS', message: `Place of supply ${cls.posCode} differs from the customer's GSTIN state ${doc.party.gstin.slice(0, 2)}${cls.interState ? ' — IGST charged' : ''}.`,
      suggestion: 'Correct only for bill-to/ship-to supplies delivered to another state. Otherwise the place of supply (and tax type) is wrong: cancel and re-issue the invoice.' });
  }

  if (!doc.items.length) add({ field: 'Items', message: 'Invoice has no line items.', suggestion: 'Cancel or correct the invoice.' });

  let taxableSum = ZERO, taxSum = ZERO;
  doc.items.forEach((item, idx) => {
    const label = `Line ${idx + 1}${item.name ? ` (${item.name})` : ''}`;
    const tax = item.cgst.add(item.sgst).add(item.igst).add(item.cess);
    taxableSum = taxableSum.add(item.taxable);
    taxSum = taxSum.add(tax);

    if (!isValidGstRate(item.rate)) {
      add({ field: 'GST Rate', message: `${label}: ${item.rate}% is not a valid GST rate.`, suggestion: 'Correct the GST rate on the product master and re-issue the invoice.' });
    }
    if (item.taxable.lt(0)) add({ field: 'Taxable Value', message: `${label}: negative taxable value.`, suggestion: 'Use a credit note for reductions.' });
    if (!(item.qty > 0)) add({ field: 'Quantity', message: `${label}: quantity must be greater than zero.`, suggestion: 'Correct the invoice quantity.' });

    const expected = item.taxable.mul(item.rate).div(100);
    if (expected.sub(tax).abs().gt(TOLERANCE)) {
      add({ field: 'Tax Amount', message: `${label}: tax ${fmt(tax)} does not equal ${item.rate}% of taxable value ${fmt(item.taxable)} (expected ${fmt(expected)}).`,
        suggestion: 'The stored tax does not reconcile with the rate; cancel and re-issue the invoice.' });
    }
    checkTaxSplit(doc, item, { interState: cls.interState, igstOnly: cls.section === SECTIONS.EXP || doc.supplyType === 'ZERO_RATED_SEZ' }, add, label);

    // HSN — mandatory in the B2B tab of Table 12; the B2C tab is optional for AATO up to Rs 5 Cr.
    if (doc.supplyType !== 'NON_GST') {
      const hsnSeverity = cls.hsnTable === 'b2b' ? 'error' : 'warning';
      if (!item.hsn) {
        add({ severity: hsnSeverity, field: 'HSN', message: `${label}: HSN/SAC code missing.`,
          suggestion: `Add the HSN code to the product master.${hsnSeverity === 'warning' ? ' This line is left out of the B2C HSN summary until then.' : ''}` });
      } else if (!/^\d{4}$|^\d{6}$|^\d{8}$/.test(item.hsn)) {
        add({ severity: hsnSeverity, field: 'HSN', message: `${label}: HSN/SAC "${item.hsn}" must be 4, 6 or 8 digits.`, suggestion: 'Correct the HSN code on the product master.' });
      }
      if (item.invoicedHsn && item.hsn) {
        warn({ field: 'HSN', message: `${label}: invoice carries HSN "${item.invoicedHsn}"; using the corrected product-master HSN ${item.hsn}.`,
          suggestion: 'Confirm the product-master HSN is right for this supply.' });
      }
      // 4-digit HSN and non-UQC units are reported once per HSN summary row (see mapper.js).
    }
  });

  if (doc.subTotal.sub(taxableSum).abs().gt('0.01')) {
    add({ field: 'Taxable Value', message: `Invoice taxable value ${fmt(doc.subTotal)} does not equal the sum of its lines ${fmt(taxableSum)}.`, suggestion: 'The invoice totals are inconsistent; cancel and re-issue it.' });
  }
  const computed = taxableSum.add(taxSum);
  if (doc.value.sub(computed).abs().gt(TOLERANCE)) {
    add({ field: 'Invoice Value', message: `Invoice value ${fmt(doc.value)} does not equal taxable value + tax (${fmt(computed)}).`, suggestion: 'The invoice totals are inconsistent; cancel and re-issue it.' });
  }

  if (cls.section === SECTIONS.EXP) {
    warn({ field: 'Shipping Bill', message: 'Shipping bill number, date and port code are not recorded in the billing software.',
      suggestion: 'These fields are optional at upload; add them on the GST portal once the shipping bill is available (needed for IGST refund).' });
  }
  return issues;
}

// ── Credit / debit notes ───────────────────────────────────────────────────

export function validateNote(note, cls, ctx) {
  const issues = [];
  const add = (i) => issues.push(issueFor(note, { section: cls.section, ...i }));
  const warn = (i) => add({ severity: 'warning', ...i });

  checkNumberAndDate(note, cls.section, ctx.period, add);

  if (cls.posCode === null) {
    add({ field: 'POS', message: `Place of supply cannot be determined: party state "${note.party.state || ''}" is missing or unrecognised.`,
      suggestion: `Set the state of "${note.party.name}" in Masters → Parties.` });
  }
  if (cls.registered) checkGstin(note, cls.section, ctx.companyGstin, add);

  if (!note.taxable.gt(0)) {
    add({ field: 'Taxable Value', message: 'Taxable value could not be determined (no sales/return ledger line besides the party and tax ledgers).',
      suggestion: 'Post the note with a sales-return/income ledger line for the taxable value and separate Output CGST/SGST/IGST lines.' });
  } else if (cls.rate === null) {
    add({ field: 'GST Rate', message: `Tax is ${cls.effectiveRate}% of the taxable value, which is not a single GST rate.`,
      suggestion: 'Record one note per GST rate so the rate can be reported, or correct the tax amounts.' });
  }

  checkTaxSplit(note, note, { interState: cls.interState, igstOnly: false }, add, 'Note');

  const computed = note.taxable.add(note.cgst).add(note.sgst).add(note.igst).add(note.cess);
  if (note.value.sub(computed).abs().gt(TOLERANCE)) {
    add({ field: 'Note Value', message: `Party amount ${fmt(note.value)} does not equal taxable value + tax (${fmt(computed)}).`, suggestion: 'Correct the voucher lines.' });
  }

  const expectedSide = note.noteType === 'C' ? 'CREDIT' : 'DEBIT';
  if (note.partySide && note.partySide !== expectedSide) {
    warn({ field: 'Note Type', message: `${note.noteType === 'C' ? 'Credit' : 'Debit'} note posts the customer on the ${note.partySide.toLowerCase()} side.`,
      suggestion: `A ${note.noteType === 'C' ? 'credit note should credit' : 'debit note should debit'} the customer; check the voucher type.` });
  }
  if (cls.section === SECTIONS.CDNUR) {
    warn({ field: 'Original Invoice', message: 'Reported in CDNUR (B2CL) based on the note value; the note is not linked to its original invoice.',
      suggestion: 'Confirm the original invoice was reported in B2CL. If it was a B2CS invoice, the note belongs in B2CS instead.' });
  }
  if (cls.section === SECTIONS.B2CS && cls.rate === 0) {
    add({ field: 'GST Rate', message: 'Nil-rated note for an unregistered customer cannot be reported as a B2CS adjustment.', suggestion: 'Reduce the nil-rated supply value (Table 8) manually on the portal.' });
  }
  warn({ section: SECTIONS.HSN, field: 'HSN', message: 'Notes carry no HSN breakup, so the HSN summary is not reduced/increased by this note.',
    suggestion: 'Adjust the HSN summary on the portal for this note if its value is material.' });
  return issues;
}

// ── Cross-document ─────────────────────────────────────────────────────────

/**
 * GSTN treats document numbers case-insensitively within a financial year.
 * `otherNumbersInFy` are upper-cased numbers of other documents of the FY
 * (outside this period) that could collide.
 */
export function findDuplicateNumbers(docs, otherNumbersInFy = new Set()) {
  const seen = new Map();
  for (const d of docs) {
    const key = `${d.kind}|${String(d.number).toUpperCase()}`;
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key).push(d);
  }
  const issues = [];
  for (const group of seen.values()) {
    for (const d of group) {
      const clashesInFy = otherNumbersInFy.has(`${d.kind}|${String(d.number).toUpperCase()}`);
      if (group.length > 1 || clashesInFy) {
        issues.push(issueFor(d, {
          section: d.kind === 'NOTE' ? 'CDN' : 'INVOICE',
          field: 'Duplicate Number',
          message: `Document number "${d.number}" is used more than once in the financial year (numbers are case-insensitive for GST).`,
          suggestion: 'Each invoice/note number must be unique within the financial year; cancel and re-issue one of them.',
        }));
      }
    }
  }
  return issues;
}

