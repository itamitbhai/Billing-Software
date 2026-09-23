// GSTR-1 / IFF export pipeline (pure — no database access):
//   normalized documents → classification → business validation →
//   official mapping → schema validation → size check / split
// gst.service.js loads the documents and persists the result.

import { classifyInvoice, classifyNote } from './classifier.js';
import { validateCompany, validateInvoice, validateNote, findDuplicateNumbers, issueFor } from './validator.js';
import { mapToGstr1Json, summarizePayload } from './mapper.js';
import { validateGstr1Json, SCHEMA_ID, SCHEMA_VERSION } from './schema-validator.js';
import { splitPayload, byteSize, GST_UPLOAD_LIMIT_BYTES } from './splitter.js';
import { IFF_MONTHLY_LIMIT, SECTIONS, ZERO } from './constants.js';

export const RETURN_SECTIONS = {
  GSTR1: ['b2b', 'b2cl', 'b2cs', 'exp', 'cdnr', 'cdnur', 'nil', 'hsn', 'doc_issue'],
  // IFF (QRMP months 1-2) carries B2B supplies and notes to registered persons only.
  IFF: ['b2b', 'cdnr'],
};

const SECTION_TO_KEY = { B2B: 'b2b', B2CL: 'b2cl', B2CS: 'b2cs', EXP: 'exp', NIL: 'nil', CDNR: 'cdnr', CDNUR: 'cdnur' };

export function exportFileNames({ returnType, periodKey, gstin, partCount }) {
  const base = `Returns_${returnType}_${periodKey}_${gstin}_offline`;
  if (partCount <= 1) return [`${base}.json`];
  return Array.from({ length: partCount }, (_, i) => `${base}_${String(i + 1).padStart(2, '0')}.json`);
}

/**
 * @param {object} p
 * @param {{name:string,gstin:string,state:string}} p.company
 * @param {object} p.period             from gst-period.js
 * @param {object[]} p.invoices          normalized invoice docs of the period (incl. cancelled)
 * @param {object[]} p.notes             normalized note docs of the period (incl. cancelled)
 * @param {Set<string>} [p.otherNumbersInFy] "KIND|NUMBER" keys of FY documents outside the period
 * @param {boolean} [p.iffFiledForQuarter] quarterly GSTR-1: B2B/CDNR of months 1-2 already furnished via IFF
 * @param {string} [p.toolVersion]
 * @param {number} [p.sizeLimitBytes]
 */
export function runGstr1Pipeline({
  company, period, invoices, notes, otherNumbersInFy = new Set(), iffFiledForQuarter = false,
  toolVersion = SCHEMA_VERSION, sizeLimitBytes = GST_UPLOAD_LIMIT_BYTES,
}) {
  const internalOnly = period.returnType === 'CUSTOM';
  const returnType = internalOnly ? 'GSTR1' : period.returnType;
  const sections = RETURN_SECTIONS[returnType];
  const issues = [];

  // 1. Company
  const { issues: companyIssues, stateCode } = validateCompany(company);
  issues.push(...companyIssues);
  const ctx = { companyStateCode: stateCode, companyGstin: company.gstin, period };

  // 2. Classify + validate each document
  const activeInvoices = invoices.filter((d) => !d.cancelled);
  const invoiceRecords = activeInvoices.map((doc) => ({ doc, cls: classifyInvoice(doc, ctx) }));

  const outwardNotes = notes.filter((n) => n.direction !== 'INWARD');
  const noteRecords = outwardNotes.filter((n) => !n.cancelled).map((doc) => ({ doc, cls: classifyNote(doc, ctx) }));

  const inReturn = (r) => sections.includes(SECTION_TO_KEY[r.cls.section]);
  // Quarterly GSTR-1 after IFF: B2B/CDNR documents of months 1-2 were already
  // furnished; they stay in the HSN summary and Table 13 but not in B2B/CDNR.
  const inLastMonth = (d) => d.date.getUTCMonth() === period.endDate.getUTCMonth();
  const iffReportedIds = new Set(
    iffFiledForQuarter && period.frequency === 'QUARTERLY'
      ? [...invoiceRecords, ...noteRecords]
        .filter((r) => (r.cls.section === SECTIONS.B2B || r.cls.section === SECTIONS.CDNR) && !inLastMonth(r.doc))
        .map((r) => r.doc.id)
      : [],
  );

  const relevantInvoices = invoiceRecords.filter((r) => returnType === 'GSTR1' || inReturn(r));
  const relevantNotes = noteRecords.filter(inReturn);
  for (const r of relevantInvoices) issues.push(...validateInvoice(r.doc, r.cls, ctx));
  for (const r of relevantNotes) issues.push(...validateNote(r.doc, r.cls, ctx));
  issues.push(...findDuplicateNumbers([...relevantInvoices, ...relevantNotes].map((r) => r.doc), otherNumbersInFy));

  // 3. Exclude documents with errors (never silently "fix" them)
  const errorIds = new Set(issues.filter((i) => i.severity === 'error' && i.documentId).map((i) => i.documentId));
  const warningIds = new Set(issues.filter((i) => i.severity === 'warning' && i.documentId).map((i) => i.documentId));
  const exportInvoices = relevantInvoices.filter((r) => !errorIds.has(r.doc.id));
  const exportNotes = relevantNotes.filter((r) => !errorIds.has(r.doc.id));

  // 4. Map to the official structure
  const docSeries = {
    INVOICE: invoices,
    CREDIT_NOTE: outwardNotes.filter((n) => n.noteType === 'C'),
    DEBIT_NOTE: outwardNotes.filter((n) => n.noteType === 'D'),
  };
  // A custom range has no statutory fp; its internal preview uses the end month
  // so the structure can still be checked (generation stays blocked below).
  const previewFp = `${String(period.endDate.getUTCMonth() + 1).padStart(2, '0')}${period.endDate.getUTCFullYear()}`;
  const mapped = mapToGstr1Json({
    company, period: { fp: period.fp || previewFp }, version: toolVersion,
    invoices: exportInvoices, notes: exportNotes, docSeries, sections, excludeFromDocTables: iffReportedIds, otherNumbersInFy,
  });
  const { payload } = mapped;
  issues.push(...mapped.issues);

  if (returnType === 'IFF') {
    const b2bValue = (payload.b2b || []).reduce((s, g) => g.inv.reduce((a, inv) => a.add(inv.val), s), ZERO);
    if (b2bValue.gt(IFF_MONTHLY_LIMIT)) {
      issues.push(issueFor(null, { section: SECTIONS.COMPANY, field: 'IFF Limit',
        message: `B2B invoice value ${b2bValue.toFixed(2)} exceeds the IFF limit of Rs 50 lakh per month.`,
        suggestion: 'Report the remaining invoices in the quarterly GSTR-1.' }));
    }
  }
  if (returnType === 'GSTR1' && !payload.b2b && !payload.b2cl && !payload.b2cs && !payload.exp && !payload.nil && !payload.cdnr && !payload.cdnur) {
    issues.push(issueFor(null, { severity: 'warning', section: SECTIONS.COMPANY, field: 'Period',
      message: 'No outward supplies to report for this period.', suggestion: 'File a NIL GSTR-1 directly on the portal instead of uploading a JSON.' }));
  }

  // 5. Schema validation
  const schema = validateGstr1Json(payload);

  // 6. Size check and splitting at record boundaries
  const totalBytes = byteSize(payload);
  let files = [];
  let splitError = null;
  try {
    const { parts } = splitPayload(payload, sizeLimitBytes);
    const names = exportFileNames({ returnType, periodKey: period.periodKey, gstin: company.gstin || 'NOGSTIN', partCount: parts.length });
    files = parts.map((part, i) => {
      const partSchema = parts.length > 1 ? validateGstr1Json(part) : schema;
      return { partNo: i + 1, fileName: names[i], sizeBytes: byteSize(part), withinLimit: byteSize(part) <= sizeLimitBytes, schemaValid: partSchema.valid, payload: part };
    });
  } catch (err) {
    splitError = err.message;
  }

  // 7. Outcome
  const companyErrors = issues.filter((i) => i.section === SECTIONS.COMPANY && i.severity === 'error');
  const docCount = relevantInvoices.length + relevantNotes.length;
  const withErrors = new Set([...relevantInvoices, ...relevantNotes].filter((r) => errorIds.has(r.doc.id)).map((r) => r.doc.id)).size;
  const summary = summarizePayload(payload);
  const hasSupplies = Object.keys(payload).some((k) => !['gstin', 'fp', 'version', 'hash', 'doc_issue'].includes(k));

  const blockers = [];
  if (internalOnly) blockers.push('A custom date range is for internal review only. Select a GST return period to generate the JSON.');
  if (companyErrors.length) blockers.push('Company GST settings have errors.');
  if (!schema.valid) blockers.push('Generated JSON failed schema validation.');
  if (splitError) blockers.push(splitError);
  if (!hasSupplies) blockers.push('There is nothing to report for this period.');

  return {
    returnType: internalOnly ? 'CUSTOM' : returnType,
    period: { financialYear: period.financialYear, fp: period.fp, label: period.label, frequency: period.frequency, periodKey: period.periodKey, startDate: period.startDate, endDate: period.endDate },
    company: { name: company.name, gstin: company.gstin, state: company.state, stateCode },
    toolVersion,
    schemaId: SCHEMA_ID,
    sections,
    counts: {
      ...summary.counts,
      cancelledInvoices: invoices.filter((d) => d.cancelled).length,
      inwardNotesSkipped: notes.filter((n) => n.direction === 'INWARD').length,
      reportedViaIff: iffReportedIds.size,
      notInThisReturn: invoiceRecords.length + noteRecords.length - relevantInvoices.length - relevantNotes.length,
    },
    totals: summary.totals,
    records: { total: docCount, valid: docCount - withErrors, withErrors, withWarnings: [...warningIds].filter((id) => !errorIds.has(id)).length },
    issues,
    documents: [...relevantInvoices, ...relevantNotes].map(({ doc, cls }) => ({
      id: doc.id, number: doc.number, date: doc.date.toISOString().slice(0, 10), kind: doc.kind, noteType: doc.noteType || null,
      party: doc.party.name, gstin: doc.party.gstin, section: cls.section, posCode: cls.posCode, value: doc.value.toFixed(2),
      status: errorIds.has(doc.id) ? 'ERROR' : warningIds.has(doc.id) ? 'WARNING' : 'VALID',
      reportedViaIff: iffReportedIds.has(doc.id),
    })),
    schema,
    sizeLimitBytes,
    totalBytes,
    files,
    blockers,
    canGenerate: blockers.length === 0,
    payload,
  };
}
