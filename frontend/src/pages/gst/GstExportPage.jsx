import React, { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft, Loader2, CircleCheck, CircleX, TriangleAlert, FileDown, History, ClipboardCheck, Info, Download,
} from 'lucide-react';
import { tallyApi } from '../../api/tally.api';
import { useAuthStore } from '../../store/auth.store';
import { formatCurrency } from '../../utils/format';
import { downloadBlob } from '../../utils/csv';
import {
  RETURN_LABELS, SECTION_LABELS, financialYearOf, financialYearOptions, monthsOfFinancialYear, formatBytes, downloadIssuesCsv,
} from './gstExport.utils';
import { Panel, IssueTable } from './GstExportComponents';

const inputCls = 'w-full bg-[#0d1224] border border-gray-800 rounded-lg p-2 text-white text-xs outline-none focus:border-amber-500/50';
const labelCls = 'block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5';

function Stat({ label, value, mono = true }) {
  return (
    <div className="bg-[#0d1224] rounded-lg border border-gray-800 p-3">
      <span className="block text-[10px] uppercase tracking-wider text-gray-500">{label}</span>
      <span className={`block mt-1 text-sm font-semibold text-white ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

export default function GstExportPage() {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role);
  const canWrite = role === 'ADMIN' || role === 'ACCOUNTANT';

  const now = new Date();
  const [returnType, setReturnType] = useState('GSTR1');
  const [frequency, setFrequency] = useState('MONTHLY');
  const [financialYear, setFinancialYear] = useState(financialYearOf(now));
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [iffFiledForQuarter, setIffFiledForQuarter] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [acknowledge, setAcknowledge] = useState(false);
  const [preview, setPreview] = useState(null);
  const [generated, setGenerated] = useState(null);
  const [issueTab, setIssueTab] = useState('error');
  const [showRecords, setShowRecords] = useState(false);

  const { data: metaRes } = useQuery({ queryKey: ['gst-export-meta'], queryFn: tallyApi.gst.meta });
  const meta = metaRes?.data;

  const months = useMemo(() => monthsOfFinancialYear(financialYear), [financialYear]);
  // QRMP: IFF only for months 1-2 of a quarter; quarterly GSTR-1 picks the quarter.
  const periodOptions = useMemo(() => {
    if (returnType === 'IFF') return months.filter((m) => (m.month - 1) % 3 !== 2);
    if (frequency === 'QUARTERLY') {
      return months.filter((m) => (m.month - 1) % 3 === 2).map((m) => ({ ...m, label: `Quarter ending ${m.label}` }));
    }
    return months;
  }, [months, returnType, frequency]);
  const selectedMonth = periodOptions.some((m) => m.month === Number(month)) ? Number(month) : periodOptions[0]?.month;

  const request = () => ({
    returnType,
    frequency: returnType === 'GSTR1' ? frequency : 'MONTHLY',
    financialYear,
    month: selectedMonth,
    iffFiledForQuarter: returnType === 'GSTR1' && frequency === 'QUARTERLY' && iffFiledForQuarter,
    from, to,
  });

  const resetResult = () => { setPreview(null); setGenerated(null); setAcknowledge(false); };

  const prepareMut = useMutation({
    mutationFn: () => tallyApi.gst.prepare(request()),
    onSuccess: (res) => { setPreview(res.data); setGenerated(null); setAcknowledge(false); setIssueTab(res.data.records.withErrors || res.data.issues.some((i) => i.severity === 'error') ? 'error' : 'warning'); },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not prepare GST data'),
  });

  const generateMut = useMutation({
    mutationFn: () => tallyApi.gst.generate({ ...request(), acknowledgeExclusions: acknowledge }),
    onSuccess: (res) => { setGenerated(res.data); setPreview(res.data); toast.success('GST JSON generated'); },
    onError: (err) => {
      const body = err.response?.data;
      if (body?.data) setPreview(body.data);
      toast.error(body?.message || 'Could not generate GST JSON');
    },
  });

  const download = async (exportId, file) => {
    try {
      const blob = await tallyApi.gst.downloadFile(exportId, file.partNo);
      downloadBlob(file.fileName, blob);
    } catch {
      toast.error('Download failed');
    }
  };

  const errors = preview?.issues.filter((i) => i.severity === 'error') || [];
  const warnings = preview?.issues.filter((i) => i.severity === 'warning') || [];
  const needsAck = (preview?.records.withErrors || 0) > 0;
  const periodKey = preview?.period?.periodKey || 'period';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="p-2 border border-gray-800 text-gray-400 hover:text-white rounded-lg cursor-pointer">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-white tracking-wide">GST Return Export</h2>
            <p className="text-gray-400 text-xs mt-1">Prepare the GSTR-1 / IFF JSON for the GST portal's offline upload. This does not file your return.</p>
          </div>
        </div>
        <Link to="/gst/history" className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-amber-400 border border-amber-500/30 rounded-lg hover:bg-amber-500/10">
          <History className="h-4 w-4" /> Export History
        </Link>
      </div>

      {/* Step 1 — return & period */}
      <Panel title="1 · Select Return and Period">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className={labelCls}>Return Type</label>
            <select value={returnType} onChange={(e) => { setReturnType(e.target.value); resetResult(); }} className={inputCls}>
              {(meta?.returnTypes || [{ id: 'GSTR1', name: 'GSTR-1' }, { id: 'IFF', name: 'IFF (QRMP)' }]).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              <option value="CUSTOM">Custom date range (internal review only)</option>
              {(meta?.notSupported || []).map((r) => <option key={r.id} value={r.id} disabled>{r.name} — not a JSON upload</option>)}
            </select>
          </div>

          {returnType === 'CUSTOM' ? (
            <>
              <div><label className={labelCls}>From</label><input type="date" value={from} onChange={(e) => { setFrom(e.target.value); resetResult(); }} className={inputCls} /></div>
              <div><label className={labelCls}>To</label><input type="date" value={to} onChange={(e) => { setTo(e.target.value); resetResult(); }} className={inputCls} /></div>
            </>
          ) : (
            <>
              {returnType === 'GSTR1' && (
                <div>
                  <label className={labelCls}>Filing Frequency</label>
                  <select value={frequency} onChange={(e) => { setFrequency(e.target.value); resetResult(); }} className={inputCls}>
                    <option value="MONTHLY">Monthly</option>
                    <option value="QUARTERLY">Quarterly (QRMP)</option>
                  </select>
                </div>
              )}
              <div>
                <label className={labelCls}>Financial Year</label>
                <select value={financialYear} onChange={(e) => { setFinancialYear(e.target.value); resetResult(); }} className={inputCls}>
                  {financialYearOptions().map((fy) => <option key={fy} value={fy}>{fy}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Return Period</label>
                <select value={selectedMonth} onChange={(e) => { setMonth(Number(e.target.value)); resetResult(); }} className={inputCls}>
                  {periodOptions.map((m) => <option key={m.month} value={m.month}>{m.label}</option>)}
                </select>
              </div>
            </>
          )}
        </div>

        {returnType === 'GSTR1' && frequency === 'QUARTERLY' && (
          <label className="mt-4 flex items-start gap-2 text-xs text-gray-300">
            <input type="checkbox" checked={iffFiledForQuarter} onChange={(e) => { setIffFiledForQuarter(e.target.checked); resetResult(); }} className="mt-0.5" />
            B2B invoices and notes of the first two months were already furnished through IFF (leave them out of B2B/CDNR; they stay in the HSN summary and Documents Issued).
          </label>
        )}
        {returnType === 'CUSTOM' && (
          <p className="mt-3 flex items-center gap-2 text-[11px] text-amber-300/90"><Info className="h-3.5 w-3.5" /> A GST return is tied to a monthly/quarterly tax period. A custom range can be reviewed here but cannot produce a return JSON.</p>
        )}
        {returnType === 'IFF' && (
          <p className="mt-3 flex items-center gap-2 text-[11px] text-gray-400"><Info className="h-3.5 w-3.5" /> IFF carries B2B invoices and registered credit/debit notes only, for months 1–2 of a quarter (up to ₹50 lakh per month).</p>
        )}

        <div className="mt-4 flex flex-wrap gap-3">
          <button onClick={() => prepareMut.mutate()} disabled={prepareMut.isPending || (returnType === 'CUSTOM' && (!from || !to))}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg bg-amber-500 text-black hover:bg-amber-400 disabled:opacity-50 cursor-pointer">
            {prepareMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
            {preview ? 'Validate Again' : 'Prepare GST Data'}
          </button>
        </div>
      </Panel>

      {preview && (
        <>
          {/* Step 2 — summary */}
          <Panel title="2 · GST Return Export Summary">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Stat label="Return" value={RETURN_LABELS[preview.returnType] || preview.returnType} mono={false} />
              <Stat label="Financial Year" value={preview.period.financialYear || '—'} />
              <Stat label="Period" value={`${preview.period.label}${preview.period.fp ? ` (${preview.period.fp})` : ''}`} mono={false} />
              <Stat label="GSTIN" value={preview.company.gstin || '— not set —'} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4">
              <Stat label="B2B Invoices" value={preview.counts.b2b} />
              <Stat label="B2C Large" value={preview.counts.b2cl} />
              <Stat label="B2C Small rows" value={preview.counts.b2cs} />
              <Stat label="Exports" value={preview.counts.exp} />
              <Stat label="Notes (Reg.)" value={preview.counts.cdnr} />
              <Stat label="Notes (Unreg.)" value={preview.counts.cdnur} />
              <Stat label="Nil/Exempt rows" value={preview.counts.nil} />
              <Stat label="HSN rows (B2B)" value={preview.counts.hsnB2b} />
              <Stat label="HSN rows (B2C)" value={preview.counts.hsnB2c} />
              <Stat label="Doc series" value={preview.counts.docIssue} />
              <Stat label="Cancelled invoices" value={preview.counts.cancelledInvoices} />
              <Stat label="Not in this return" value={preview.counts.notInThisReturn + preview.counts.reportedViaIff} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4">
              <Stat label="Taxable Value" value={`₹ ${formatCurrency(preview.totals.taxableValue)}`} />
              <Stat label="IGST" value={`₹ ${formatCurrency(preview.totals.igst)}`} />
              <Stat label="CGST" value={`₹ ${formatCurrency(preview.totals.cgst)}`} />
              <Stat label="SGST" value={`₹ ${formatCurrency(preview.totals.sgst)}`} />
              <Stat label="Cess" value={`₹ ${formatCurrency(preview.totals.cess)}`} />
            </div>
            <p className="mt-2 text-[10px] text-gray-500">Totals are computed from the JSON itself (credit notes reduce, debit notes increase). Nil/exempt values are included in taxable value.</p>
          </Panel>

          {/* Step 3 — validation */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Panel title="3 · Data Validation">
              <div className="space-y-2 text-sm">
                {preview.records.total === 0 ? (
                  <p className="flex items-center gap-2 text-gray-400"><Info className="h-4 w-4" /> No invoices or credit/debit notes are dated in {preview.period.label}.</p>
                ) : (
                  <p className="flex items-center gap-2 text-emerald-400"><CircleCheck className="h-4 w-4" /> {preview.records.valid} of {preview.records.total} documents valid</p>
                )}
                {preview.records.withErrors > 0 && (
                  <p className="flex items-center gap-2 text-rose-400"><CircleX className="h-4 w-4" /> {preview.records.withErrors} documents have errors and will not be exported</p>
                )}
                {warnings.length > 0 && (
                  <p className="flex items-center gap-2 text-amber-300"><TriangleAlert className="h-4 w-4" /> {warnings.length} warnings to review</p>
                )}
                {errors.some((e) => e.section === 'COMPANY') && (
                  <p className="flex items-center gap-2 text-rose-400"><CircleX className="h-4 w-4" /> Company GST settings must be fixed first</p>
                )}
              </div>
            </Panel>

            <Panel title="4 · GST JSON Schema Validation">
              {preview.schema.valid ? (
                <p className="flex items-center gap-2 text-emerald-400 text-sm font-semibold"><CircleCheck className="h-5 w-5" /> Schema Valid</p>
              ) : (
                <p className="flex items-center gap-2 text-rose-400 text-sm font-semibold"><CircleX className="h-5 w-5" /> Schema Validation Failed</p>
              )}
              <p className="mt-2 text-[11px] text-gray-500">
                Checked against the bundled schema <span className="font-mono text-gray-400">{preview.schemaId}</span>, transcribed from the GSTN GSTR-1 JSON specification
                (JSON <span className="font-mono">version</span>: <span className="font-mono text-gray-400">{preview.toolVersion}</span>). The GST portal performs its own validation when you upload.
              </p>
              {!preview.schema.valid && <div className="mt-3"><IssueTable rows={preview.schema.errors.map((e) => ({ ...e, severity: 'error' }))} /></div>}
            </Panel>
          </div>

          {/* Issues */}
          {preview.issues.length > 0 && (
            <Panel
              title="Validation Issues"
              right={
                <button onClick={() => downloadIssuesCsv(preview.issues, periodKey)} className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-500 border border-amber-500/30 rounded-lg hover:bg-amber-500/10">
                  <Download className="h-3 w-3" /> Error Report (CSV)
                </button>
              }
            >
              <div className="flex gap-2 mb-3">
                {[['error', `Errors (${errors.length})`], ['warning', `Warnings (${warnings.length})`]].map(([id, label]) => (
                  <button key={id} onClick={() => setIssueTab(id)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold ${issueTab === id ? 'bg-amber-500/15 text-amber-400' : 'text-gray-400 hover:text-white'}`}>{label}</button>
                ))}
              </div>
              <IssueTable rows={issueTab === 'error' ? errors : warnings} empty={issueTab === 'error' ? 'No errors.' : 'No warnings.'} />
            </Panel>
          )}

          {/* Classified documents */}
          <Panel title="Classified Documents" right={
            <button onClick={() => setShowRecords((v) => !v)} className="text-[11px] text-amber-400 hover:underline">{showRecords ? 'Hide' : `View ${preview.documents.length} records`}</button>
          }>
            {showRecords ? (
              <div className="overflow-x-auto max-h-[420px]">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-[#0d1224]">
                    <tr className="text-left text-[10px] uppercase tracking-wider text-gray-500">
                      <th className="py-2 pr-3">Document</th><th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Party</th>
                      <th className="py-2 pr-3">GSTIN</th><th className="py-2 pr-3">Section</th><th className="py-2 pr-3">POS</th>
                      <th className="py-2 pr-3 text-right">Value</th><th className="py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.documents.map((d) => (
                      <tr key={d.id} className="border-t border-gray-900">
                        <td className="py-1.5 pr-3 font-mono text-white">{d.number}{d.noteType && <span className="ml-1 text-gray-500">({d.noteType === 'C' ? 'CN' : 'DN'})</span>}</td>
                        <td className="py-1.5 pr-3 text-gray-400">{d.date}</td>
                        <td className="py-1.5 pr-3 text-gray-300">{d.party}</td>
                        <td className="py-1.5 pr-3 font-mono text-gray-400">{d.gstin || '—'}</td>
                        <td className="py-1.5 pr-3 text-gray-300">{SECTION_LABELS[d.section] || d.section}{d.reportedViaIff && <span className="text-gray-500"> · via IFF</span>}</td>
                        <td className="py-1.5 pr-3 font-mono text-gray-400">{d.posCode || '—'}</td>
                        <td className="py-1.5 pr-3 text-right font-mono text-white">{formatCurrency(d.value)}</td>
                        <td className={`py-1.5 font-semibold ${d.status === 'ERROR' ? 'text-rose-400' : d.status === 'WARNING' ? 'text-amber-300' : 'text-emerald-400'}`}>{d.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-gray-500">Every invoice and note of the period with the GSTR-1 table it was classified into.</p>
            )}
          </Panel>

          {/* Step 5 — size & generate */}
          <Panel title="5 · Generate JSON">
            <div className="space-y-2">
              {preview.files.map((f) => (
                <div key={f.partNo} className="flex flex-wrap items-center justify-between gap-2 text-xs bg-[#0d1224] border border-gray-800 rounded-lg px-3 py-2">
                  <span className="font-mono text-gray-300">{f.fileName}</span>
                  <span className="font-mono text-white">JSON Size: {formatBytes(f.sizeBytes)}</span>
                  <span className={f.withinLimit && f.schemaValid ? 'text-emerald-400' : 'text-rose-400'}>
                    Status: {f.withinLimit ? (f.schemaValid ? 'Ready' : 'Schema errors') : 'File exceeds applicable upload limit'}
                  </span>
                </div>
              ))}
              {preview.files.length > 1 && (
                <p className="text-[11px] text-amber-300/90">
                  The data ({formatBytes(preview.totalBytes)}) exceeds the {formatBytes(preview.sizeLimitBytes)} upload limit and was split at invoice boundaries into {preview.files.length} complete files.
                  Part 1 carries the summary tables (B2CS, Nil, HSN, Documents issued).
                </p>
              )}
            </div>

            {preview.blockers.length > 0 && (
              <ul className="mt-4 space-y-1">
                {preview.blockers.map((b) => <li key={b} className="flex items-center gap-2 text-xs text-rose-300"><CircleX className="h-3.5 w-3.5 shrink-0" /> {b}</li>)}
              </ul>
            )}

            {preview.canGenerate && needsAck && !generated && (
              <label className="mt-4 flex items-start gap-2 text-xs text-amber-200">
                <input type="checkbox" checked={acknowledge} onChange={(e) => setAcknowledge(e.target.checked)} className="mt-0.5" />
                I understand that {preview.records.withErrors} document(s) with errors will be left out of this JSON and must be reported separately once corrected.
              </label>
            )}

            {!generated && (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button onClick={() => generateMut.mutate()}
                  disabled={!canWrite || !preview.canGenerate || (needsAck && !acknowledge) || generateMut.isPending}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg bg-emerald-500 text-black hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
                  {generateMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} Generate GST JSON
                </button>
                {!canWrite && <span className="text-[11px] text-gray-500">Only Admin or Accountant users can generate the JSON.</span>}
              </div>
            )}

            {generated && (
              <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-emerald-400"><CircleCheck className="h-5 w-5" /> GST JSON Generated</p>
                <p className="mt-1 text-xs text-gray-300">Upload this file through the applicable GST Portal workflow (GST portal → Returns Dashboard → {RETURN_LABELS[generated.returnType]} → Prepare Offline → Upload). The return is filed only after you submit and file it on the portal.</p>
                {generated.files.length > 1 && <p className="mt-1 text-xs text-amber-300/90">Upload the parts one at a time, in order, waiting for each upload to finish processing before the next.</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  {generated.files.map((f) => (
                    <button key={f.partNo} onClick={() => download(generated.exportId, f)}
                      className="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 cursor-pointer">
                      <Download className="h-4 w-4" /> Download {generated.files.length > 1 ? `Part ${f.partNo}` : 'JSON'} ({formatBytes(f.sizeBytes)})
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
