// End-to-end: real Postgres, real billing/voucher services, real HTTP routes.
// Creates an isolated company and removes it afterwards. Skipped when the
// database from DATABASE_URL is not reachable.
import 'dotenv/config';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { prisma } from '../../src/shared/database/prisma.js';
import { registerCeo, registerEmployee } from '../../src/core/auth/auth.service.js';
import * as masters from '../../src/core/masters/masters.service.js';
import * as billing from '../../src/core/billing/billing.service.js';
import * as vouchers from '../../src/core/vouchers/vouchers.service.js';
import { gstRouter } from '../../src/core/gst/gst.module.js';
import { errorMiddleware } from '../../src/shared/middleware/error.middleware.js';
import { validateGstr1Json } from '../../src/core/gst/gstr1/schema-validator.js';

let dbUp = true;
try { await prisma.$queryRaw`SELECT 1`; } catch { dbUp = false; }
const itest = (name, fn) => test(name, { skip: !dbUp && 'database not reachable' }, fn);

const stamp = Date.now();
let server, base, token, staffToken, companyId;
const ids = {};

async function api(method, path, body, auth = token) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { Authorization: `Bearer ${auth}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* file/csv downloads */ }
  return { status: res.status, json, text, headers: res.headers };
}

before(async () => {
  if (!dbUp) return;
  const app = express();
  app.use(express.json());
  app.use('/api/v1/gst', gstRouter);
  app.use(errorMiddleware);
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}/api/v1`;

  const reg = await registerCeo({ companyName: `GST Test ${stamp}`, name: 'Test Admin', email: `gst-admin-${stamp}@test.local`, password: 'Secret#123', state: 'Maharashtra' });
  token = reg.accessToken;
  companyId = reg.company.id;
  await prisma.company.update({ where: { id: companyId }, data: { gstin: '27AAPFU0939F1ZV' } });
  await registerEmployee({ companyId, name: 'Staff', email: `gst-staff-${stamp}@test.local`, password: 'Secret#123', role: 'STAFF' });
  const { login } = await import('../../src/core/auth/auth.service.js');
  staffToken = (await login({ email: `gst-staff-${stamp}@test.local`, password: 'Secret#123' })).accessToken;

  const party = (data) => masters.createParty(companyId, { type: 'CUSTOMER', ...data });
  ids.abc = await party({ name: 'ABC Medical', gstin: '27AAACR5055K1Z7', state: 'Maharashtra' });
  ids.ka = await party({ name: 'Karnataka Pharma', gstin: '29AABCT1332L1ZA', state: 'Karnataka' });
  ids.walkIn = await party({ name: 'Walk-in', state: 'Maharashtra' });
  ids.overseas = await party({ name: 'Dubai Health', state: 'Foreign Country' });
  ids.badGstin = await party({ name: 'Typo Traders', gstin: '27AAACR5055K1Z8', state: 'Maharashtra' });

  const product = async (name, hsnCode, unit, gstRate) => {
    const p = await masters.createProduct(companyId, { name, price: 100, unit, hsnCode, gstRate });
    const b = await masters.createBatch(companyId, { productId: p.id, batchNumber: `B-${name}`, expiryDate: '2028-12-31', mrp: 150, currentQty: 10000 });
    return b.id;
  };
  ids.para = await product('Paracetamol', '30049099', 'STRIP', 5);
  ids.syrup = await product('Syrup', '30049011', 'BTL', 12);
  ids.device = await product('BP Monitor', '90189099', 'NOS', 18);

  const sell = (customerId, saleDate, items, extra = {}) => billing.createSale(companyId, { customerId, saleDate, items, ...extra }, reg.user.id);
  ids.s1 = await sell(ids.abc.id, '2026-07-03', [{ batchId: ids.para, qty: 10, rate: 100 }, { batchId: ids.syrup, qty: 5, rate: 80 }, { batchId: ids.device, qty: 1, rate: 1500 }]);
  ids.s2 = await sell(ids.ka.id, '2026-07-04', [{ batchId: ids.para, qty: 20, rate: 100 }]);
  ids.s3 = await sell(ids.walkIn.id, '2026-07-05', [{ batchId: ids.syrup, qty: 3, rate: 90 }]);
  ids.s4 = await sell(ids.overseas.id, '2026-07-06', [{ batchId: ids.device, qty: 10, rate: 1500 }], { supplyType: 'ZERO_RATED_EXPORT' });
  ids.s5 = await sell(ids.badGstin.id, '2026-07-07', [{ batchId: ids.para, qty: 1, rate: 100 }]);
  ids.s6 = await sell(ids.abc.id, '2026-07-08', [{ batchId: ids.para, qty: 1, rate: 100 }]);
  await vouchers.deleteVoucher(companyId, ids.s6.voucherId, reg.user.id); // cancelled invoice
  ids.aug = await sell(ids.abc.id, '2026-08-01', [{ batchId: ids.para, qty: 1, rate: 100 }]); // next period

  // Sales return credit note to ABC Medical: 200 taxable @12% intra-state
  const ledger = (name) => prisma.ledger.findUnique({ where: { companyId_name: { companyId, name } } });
  const [salesLedger, cgst, sgst] = await Promise.all([ledger('Sales Ledger'), ledger('Output CGST'), ledger('Output SGST')]);
  await vouchers.createVoucher(companyId, {
    type: 'CREDIT_NOTE', date: '2026-07-20', partyId: ids.abc.id, narration: 'Sales return',
    lines: [
      { ledgerId: salesLedger.id, type: 'DEBIT', amount: 200 },
      { ledgerId: cgst.id, type: 'DEBIT', amount: 12 },
      { ledgerId: sgst.id, type: 'DEBIT', amount: 12 },
      { ledgerId: ids.abc.ledgerId, type: 'CREDIT', amount: 224 },
    ],
  }, reg.user.id);
});

after(async () => {
  if (!dbUp) return;
  server?.close();
  if (companyId) {
    // Children with RESTRICT foreign keys first, then the company cascade.
    await prisma.$transaction([
      prisma.gstExportHistory.deleteMany({ where: { companyId } }),
      prisma.stockLedgerEntry.deleteMany({ where: { companyId } }),
      prisma.payment.deleteMany({ where: { companyId } }),
      prisma.saleItem.deleteMany({ where: { sale: { companyId } } }),
      prisma.sale.deleteMany({ where: { companyId } }),
      prisma.purchaseItem.deleteMany({ where: { purchase: { companyId } } }),
      prisma.purchase.deleteMany({ where: { companyId } }),
      prisma.voucherLine.deleteMany({ where: { voucher: { companyId } } }),
      prisma.voucher.deleteMany({ where: { companyId } }),
      prisma.party.deleteMany({ where: { companyId } }),
      prisma.batch.deleteMany({ where: { companyId } }),
      prisma.auditLog.deleteMany({ where: { companyId } }),
      prisma.session.deleteMany({ where: { user: { companyId } } }),
      prisma.company.delete({ where: { id: companyId } }),
    ]);
  }
  await prisma.$disconnect();
});

const JULY = { returnType: 'GSTR1', frequency: 'MONTHLY', financialYear: '2026-27', month: 7 };

itest('prepare classifies real invoices from the database', async () => {
  const { status, json } = await api('POST', '/gst/export/prepare', JULY);
  assert.equal(status, 200, JSON.stringify(json));
  const d = json.data;
  assert.equal(d.period.fp, '072026');
  assert.equal(d.counts.b2b, 2); // s1, s2 (s5 excluded for invalid GSTIN, s6 cancelled)
  assert.equal(d.counts.b2cs, 1);
  assert.equal(d.counts.exp, 1);
  assert.equal(d.counts.cdnr, 1);
  assert.equal(d.counts.cancelledInvoices, 1);
  assert.equal(d.records.withErrors, 1);
  assert.ok(d.issues.some((i) => i.documentNumber === ids.s5.invoiceNumber && i.field === 'GSTIN' && i.severity === 'error'));
  assert.equal(d.schema.valid, true, JSON.stringify(d.schema.errors));
  assert.equal(d.canGenerate, true);
  assert.equal(d.payload, undefined); // raw JSON is not sent on prepare
  // taxable: s1 1000+400+1500, s2 2000, s3 270, export 15000, CN −200
  assert.equal(d.totals.taxableValue, '19970.00');
  assert.equal(d.totals.igst, '100.00');
  assert.equal(d.totals.cgst, (25 + 24 + 135 + 16.2 - 12).toFixed(2));
});

itest('STAFF cannot generate; generation needs explicit acknowledgement of excluded documents', async () => {
  assert.equal((await api('POST', '/gst/export/generate', JULY, staffToken)).status, 403);
  const r = await api('POST', '/gst/export/generate', JULY);
  assert.equal(r.status, 409);
  assert.deepEqual(r.json.errors, ['ACKNOWLEDGE_EXCLUSIONS_REQUIRED']);
});

itest('custom date range cannot generate a return JSON', async () => {
  const r = await api('POST', '/gst/export/generate', { returnType: 'CUSTOM', from: '2026-07-01', to: '2026-07-31' });
  assert.equal(r.status, 400);
});

itest('generate → history → download returns the schema-valid JSON exactly as stored', async () => {
  const gen = await api('POST', '/gst/export/generate', { ...JULY, acknowledgeExclusions: true });
  assert.equal(gen.status, 201, JSON.stringify(gen.json));
  const exportId = gen.json.data.exportId;
  assert.equal(gen.json.data.files[0].fileName, 'Returns_GSTR1_2026-07_27AAPFU0939F1ZV_offline.json');

  const hist = await api('GET', '/gst/export/history');
  const row = hist.json.data.find((h) => h.id === exportId);
  assert.equal(row.status, 'SCHEMA_VALID');
  assert.equal(row.returnPeriod, '072026');
  assert.equal(row.excludedCount, 1);
  assert.equal(row.createdBy.name, 'Test Admin');

  const file = await api('GET', `/gst/export/history/${exportId}/files/1`);
  assert.equal(file.status, 200);
  assert.match(file.headers.get('content-disposition'), /Returns_GSTR1_2026-07_27AAPFU0939F1ZV_offline\.json/);
  const payload = JSON.parse(file.text);
  assert.equal(validateGstr1Json(payload).valid, true);
  assert.deepEqual(Object.keys(payload), ['gstin', 'fp', 'version', 'hash', 'b2b', 'b2cs', 'exp', 'cdnr', 'hsn', 'doc_issue']);
  const s1 = payload.b2b.find((g) => g.ctin === '27AAACR5055K1Z7').inv[0];
  assert.deepEqual(s1.itms.map((i) => i.itm_det.rt), [5, 12, 18]);
  assert.equal(payload.b2b.find((g) => g.ctin === '29AABCT1332L1ZA').inv[0].pos, '29');
  // Table 13 counts the cancelled and the excluded invoice as issued
  const docs = payload.doc_issue.doc_det.find((d) => d.doc_num === 1).docs[0];
  assert.equal(docs.totnum, 6);
  assert.equal(docs.cancel, 1);

  const csv = await api('GET', `/gst/export/history/${exportId}/errors.csv`);
  assert.equal(csv.status, 200);
  assert.match(csv.text.split('\r\n')[0], /^Invoice Number,Invoice Date,Document Type,Customer,GSTIN,Section,Field,Severity,Error,Suggested Fix$/);
  assert.ok(csv.text.includes(ids.s5.invoiceNumber));
});

itest('existing GSTR-1 report still works on the same data (no regression)', async () => {
  const { getGstr1 } = await import('../../src/core/reports/reports.service.js');
  const r = await getGstr1({ companyId, month: 7, year: 2026 });
  assert.equal(r.docsIssued.cancelledCount, 1);
});
