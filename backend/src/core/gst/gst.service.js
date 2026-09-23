import { createHash } from 'node:crypto';
import { prisma } from '../../shared/database/prisma.js';
import { paginate, paginatedResult } from '../../shared/utils/pagination.js';
import { resolveReturnPeriod, resolveCustomRange, parseFinancialYear } from './gst-period.js';
import { invoiceFromSale, noteFromVoucher } from './gstr1/normalize.js';
import { runGstr1Pipeline } from './gstr1/pipeline.js';
import { SCHEMA_ID, SCHEMA_VERSION } from './gstr1/schema-validator.js';
import { GST_UPLOAD_LIMIT_BYTES } from './gstr1/splitter.js';

// "version" written into the JSON. Defaults to the Returns Offline Tool
// version the bundled schema was prepared for; override when GSTN releases a
// new tool version with an unchanged format.
const TOOL_VERSION = process.env.GST_OFFLINE_TOOL_VERSION || SCHEMA_VERSION;

// Filing a return (GSP/API) is intentionally not implemented: this module
// only prepares the offline-upload JSON. A future GSP integration would take
// the validated `files[].payload` from runGstr1Pipeline and submit it.

function httpError(status, message, extra = {}) {
  const err = new Error(message);
  err.status = status;
  Object.assign(err, extra);
  return err;
}

export function getExportMeta() {
  return {
    returnTypes: [
      { id: 'GSTR1', name: 'GSTR-1', frequencies: ['MONTHLY', 'QUARTERLY'], description: 'Statement of outward supplies (offline-upload JSON).' },
      { id: 'IFF', name: 'IFF (QRMP)', frequencies: ['MONTHLY'], description: 'Invoice Furnishing Facility — B2B invoices and notes for months 1-2 of a quarter.' },
    ],
    notSupported: [
      { id: 'GSTR3B', name: 'GSTR-3B', reason: 'GSTR-3B is a summary return, not an invoice-level upload. Use Display Reports → GST Reports → GSTR-3B for the computed summary.' },
    ],
    toolVersion: TOOL_VERSION,
    schemaId: SCHEMA_ID,
    sizeLimitBytes: GST_UPLOAD_LIMIT_BYTES,
  };
}

function resolvePeriod({ returnType, frequency, financialYear, month, from, to }) {
  if (returnType === 'CUSTOM') {
    if (!from || !to) throw httpError(400, 'from and to dates are required for a custom range.');
    return resolveCustomRange({ from, to });
  }
  if (!['GSTR1', 'IFF'].includes(returnType)) throw httpError(400, 'returnType must be GSTR1, IFF or CUSTOM.');
  return resolveReturnPeriod({ returnType, frequency, financialYear, month });
}

/** Loads every document the pipeline needs, straight from the billing tables. */
async function loadDocuments(companyId, period) {
  const range = { gte: period.startDate, lte: period.endDate };
  const [company, sales, vouchers] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId }, select: { name: true, gstin: true, state: true } }),
    prisma.sale.findMany({
      where: { companyId, saleDate: range },
      include: { customer: true, items: { include: { product: { select: { name: true, unit: true, hsnCode: true } } } } },
      orderBy: [{ saleDate: 'asc' }, { invoiceNumber: 'asc' }],
    }),
    prisma.voucher.findMany({
      where: { companyId, type: { in: ['CREDIT_NOTE', 'DEBIT_NOTE'] }, partyId: { not: null }, date: range },
      include: { party: true, lines: { include: { ledger: { select: { name: true } } } } },
      orderBy: [{ date: 'asc' }, { voucherNumber: 'asc' }],
    }),
  ]);
  if (!company) throw httpError(404, 'Company not found.');

  // Numbers used elsewhere in the same FY, for the case-insensitive duplicate check.
  const otherNumbersInFy = new Set();
  if (period.financialYear) {
    const { startYear } = parseFinancialYear(period.financialYear);
    const fyRange = { gte: new Date(Date.UTC(startYear, 3, 1)), lte: new Date(Date.UTC(startYear + 1, 2, 31, 23, 59, 59, 999)) };
    const [otherSales, otherNotes] = await Promise.all([
      prisma.sale.findMany({ where: { companyId, isCancelled: false, AND: [{ saleDate: fyRange }, { OR: [{ saleDate: { lt: period.startDate } }, { saleDate: { gt: period.endDate } }] }] }, select: { invoiceNumber: true } }),
      prisma.voucher.findMany({ where: { companyId, isDeleted: false, type: { in: ['CREDIT_NOTE', 'DEBIT_NOTE'] }, AND: [{ date: fyRange }, { OR: [{ date: { lt: period.startDate } }, { date: { gt: period.endDate } }] }] }, select: { voucherNumber: true } }),
    ]);
    for (const s of otherSales) otherNumbersInFy.add(`INVOICE|${s.invoiceNumber.toUpperCase()}`);
    for (const v of otherNotes) otherNumbersInFy.add(`NOTE|${v.voucherNumber.toUpperCase()}`);
  }

  return { company, invoices: sales.map(invoiceFromSale), notes: vouchers.map(noteFromVoucher), otherNumbersInFy };
}

async function runForRequest(companyId, params) {
  const period = resolvePeriod(params);
  const data = await loadDocuments(companyId, period);
  return runGstr1Pipeline({ ...data, period, iffFiledForQuarter: !!params.iffFiledForQuarter, toolVersion: TOOL_VERSION });
}

/** The pipeline result minus the raw JSON bodies (those are only stored on generate). */
function forClient(result) {
  const { payload, files, ...rest } = result;
  return { ...rest, files: files.map(({ payload: _p, ...f }) => f) };
}

export async function prepareExport(companyId, params) {
  return forClient(await runForRequest(companyId, params));
}

export async function generateExport(companyId, userId, params) {
  if (params.returnType === 'CUSTOM') throw httpError(400, 'A custom date range cannot produce a GST return JSON. Select a return period.');
  const result = await runForRequest(companyId, params);

  if (!result.canGenerate) {
    throw httpError(422, 'GST JSON cannot be generated.', { errors: result.blockers, data: forClient(result) });
  }
  if (result.records.withErrors > 0 && !params.acknowledgeExclusions) {
    throw httpError(409, `${result.records.withErrors} document(s) have errors and would be left out of the JSON. Fix them, or confirm the export without them.`,
      { errors: ['ACKNOWLEDGE_EXCLUSIONS_REQUIRED'], data: forClient(result) });
  }

  const history = await prisma.$transaction(async (tx) => {
    const created = await tx.gstExportHistory.create({
      data: {
        companyId,
        returnType: result.returnType,
        frequency: result.period.frequency,
        financialYear: result.period.financialYear,
        returnPeriod: result.period.fp,
        periodLabel: result.period.label,
        gstin: result.company.gstin,
        toolVersion: result.toolVersion,
        schemaId: result.schemaId,
        recordCount: result.records.valid,
        excludedCount: result.records.withErrors,
        warningCount: result.issues.filter((i) => i.severity === 'warning').length,
        fileCount: result.files.length,
        totalSizeBytes: result.files.reduce((s, f) => s + f.sizeBytes, 0),
        status: 'SCHEMA_VALID',
        summary: { counts: result.counts, totals: result.totals, records: result.records },
        issues: result.issues,
        createdById: userId || null,
      },
    });
    for (const f of result.files) {
      const content = JSON.stringify(f.payload);
      await tx.gstExportFile.create({
        data: { exportId: created.id, partNo: f.partNo, fileName: f.fileName, sizeBytes: f.sizeBytes, sha256: createHash('sha256').update(content).digest('hex'), content },
      });
    }
    return created;
  });

  return { exportId: history.id, ...forClient(result) };
}

const HISTORY_SELECT = {
  id: true, returnType: true, frequency: true, financialYear: true, returnPeriod: true, periodLabel: true, gstin: true,
  toolVersion: true, schemaId: true, recordCount: true, excludedCount: true, warningCount: true, fileCount: true,
  totalSizeBytes: true, status: true, summary: true, createdAt: true,
  createdBy: { select: { id: true, name: true } },
  files: { select: { partNo: true, fileName: true, sizeBytes: true, sha256: true }, orderBy: { partNo: 'asc' } },
};

export async function listExportHistory({ companyId, page, limit }) {
  const { take, skip, page: currentPage } = paginate({ page, limit });
  const where = { companyId };
  const [rows, total] = await Promise.all([
    prisma.gstExportHistory.findMany({ where, select: HISTORY_SELECT, orderBy: { createdAt: 'desc' }, take, skip }),
    prisma.gstExportHistory.count({ where }),
  ]);
  return paginatedResult({ rows, total, page: currentPage, limit: take });
}

export async function getExportHistory(companyId, id) {
  const row = await prisma.gstExportHistory.findFirst({ where: { id, companyId }, select: { ...HISTORY_SELECT, issues: true } });
  if (!row) throw httpError(404, 'Export not found.');
  return row;
}

export async function getExportFile(companyId, id, partNo) {
  const file = await prisma.gstExportFile.findFirst({
    where: { exportId: id, partNo: Number(partNo), export: { companyId } },
    select: { fileName: true, content: true },
  });
  if (!file) throw httpError(404, 'Export file not found.');
  return file;
}

const CSV_COLUMNS = [
  ['documentNumber', 'Invoice Number'], ['documentDate', 'Invoice Date'], ['documentType', 'Document Type'], ['party', 'Customer'],
  ['gstin', 'GSTIN'], ['section', 'Section'], ['field', 'Field'], ['severity', 'Severity'], ['message', 'Error'], ['suggestion', 'Suggested Fix'],
];

export function issuesToCsv(issues) {
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [CSV_COLUMNS.map(([, label]) => label).join(',')];
  for (const i of issues) lines.push(CSV_COLUMNS.map(([key]) => esc(i[key])).join(','));
  return lines.join('\r\n');
}
