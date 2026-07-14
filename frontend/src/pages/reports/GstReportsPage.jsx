import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { tallyApi } from '../../api/tally.api';
import { Loader2, ArrowLeft, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatRupees, formatDate } from '../../utils/format';
import { toCsv, downloadCsv } from '../../utils/csv';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
].map((label, i) => ({ value: i + 1, label }));

function currentPeriod() {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

const TONE_CLASSES = {
  white: 'text-white',
  emerald: 'text-emerald-400',
  amber: 'text-amber-500'
};

function StatCard({ label, value, tone = 'white' }) {
  return (
    <div className="bg-[#111827]/40 p-4 rounded-lg border border-gray-850 text-center">
      <span className="text-gray-500 block text-xs">{label}</span>
      <span className={`text-sm font-semibold mt-1 block font-mono ${TONE_CLASSES[tone]}`}>{formatRupees(value)}</span>
    </div>
  );
}

function ExportButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-500 border border-amber-500/30 rounded-lg hover:bg-amber-500/10 transition"
    >
      <Download className="h-3 w-3" /> Export CSV
    </button>
  );
}

function SectionHeader({ title, subtitle, onExport }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div>
        <h4 className="text-xs font-bold text-white uppercase tracking-wider">{title}</h4>
        {subtitle && <p className="text-[10px] text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {onExport && <ExportButton onClick={onExport} />}
    </div>
  );
}

const money = (v) => formatRupees(v);

export default function GstReportsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('summary');

  const { month: curMonth, year: curYear } = currentPeriod();
  const [month, setMonth] = useState(curMonth);
  const [year, setYear] = useState(curYear);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { data: summaryRes, isLoading: summaryLoading } = useQuery({
    queryKey: ['gst-summary', startDate, endDate],
    queryFn: () => tallyApi.reports.gstSummary({ startDate, endDate }),
    enabled: activeTab === 'summary'
  });

  const { data: gstr1Res, isLoading: gstr1Loading } = useQuery({
    queryKey: ['gstr1', month, year],
    queryFn: () => tallyApi.reports.gstr1({ month, year }),
    enabled: activeTab === 'gstr1'
  });

  const { data: gstr3bRes, isLoading: gstr3bLoading } = useQuery({
    queryKey: ['gstr3b', month, year],
    queryFn: () => tallyApi.reports.gstr3b({ month, year }),
    enabled: activeTab === 'gstr3b'
  });

  const zeroHead = { cgst: '0', sgst: '0', igst: '0', total: '0' };
  const zeroBucket = { taxableValue: '0', cgst: '0', sgst: '0', igst: '0', total: '0' };

  const summary = summaryRes?.data || { outputTax: zeroHead, inputTaxCredit: zeroHead, netPayable: zeroHead };
  const gstr1 = gstr1Res?.data || { b2b: [], b2cl: [], b2cs: [], cdnr: [], cdnur: [], hsn: [], docsIssued: {} };
  const gstr3b = gstr3bRes?.data || {
    outwardTaxableSupplies: zeroBucket, outwardZeroRatedSupplies: zeroBucket, outwardNilExemptSupplies: zeroBucket,
    outwardNonGstSupplies: zeroBucket, inwardReverseCharge: zeroBucket, itcAvailable: zeroHead, itcReversed: zeroHead, netTaxPayable: zeroHead
  };

  const periodLabel = `${MONTHS.find(m => m.value === Number(month))?.label} ${year}`;

  const exportB2B = () => {
    const rows = gstr1.b2b.flatMap(g => g.invoices.map(inv => ({ ...inv, gstin: g.gstin, partyName: g.partyName })));
    downloadCsv(`gstr1-b2b-${month}-${year}.csv`, toCsv(rows, [
      { key: 'gstin', label: 'GSTIN' }, { key: 'partyName', label: 'Party' }, { key: 'invoiceNumber', label: 'Invoice No' },
      { key: 'saleDate', label: 'Date' }, { key: 'placeOfSupply', label: 'Place of Supply' },
      { key: 'taxableValue', label: 'Taxable Value' }, { key: 'cgst', label: 'CGST' }, { key: 'sgst', label: 'SGST' },
      { key: 'igst', label: 'IGST' }, { key: 'total', label: 'Total' }
    ]));
  };
  const exportB2CL = () => downloadCsv(`gstr1-b2cl-${month}-${year}.csv`, toCsv(gstr1.b2cl, [
    { key: 'invoiceNumber', label: 'Invoice No' }, { key: 'saleDate', label: 'Date' }, { key: 'placeOfSupply', label: 'Place of Supply' },
    { key: 'taxableValue', label: 'Taxable Value' }, { key: 'cgst', label: 'CGST' }, { key: 'sgst', label: 'SGST' },
    { key: 'igst', label: 'IGST' }, { key: 'total', label: 'Total' }
  ]));
  const exportB2CS = () => downloadCsv(`gstr1-b2cs-${month}-${year}.csv`, toCsv(gstr1.b2cs, [
    { key: 'placeOfSupply', label: 'Place of Supply' }, { key: 'gstRate', label: 'GST Rate' },
    { key: 'taxableValue', label: 'Taxable Value' }, { key: 'cgst', label: 'CGST' }, { key: 'sgst', label: 'SGST' },
    { key: 'igst', label: 'IGST' }, { key: 'total', label: 'Total' }
  ]));
  const exportHsn = () => downloadCsv(`gstr1-hsn-${month}-${year}.csv`, toCsv(gstr1.hsn, [
    { key: 'hsnCode', label: 'HSN Code' }, { key: 'gstRate', label: 'GST Rate' }, { key: 'qty', label: 'Qty' },
    { key: 'taxableValue', label: 'Taxable Value' }, { key: 'cgst', label: 'CGST' }, { key: 'sgst', label: 'SGST' },
    { key: 'igst', label: 'IGST' }, { key: 'total', label: 'Total' }
  ]));
  const exportNotes = (rows, name) => downloadCsv(`gstr1-${name}-${month}-${year}.csv`, toCsv(rows, [
    { key: 'voucherNumber', label: 'Voucher No' }, { key: 'type', label: 'Type' }, { key: 'date', label: 'Date' },
    { key: 'partyName', label: 'Party' }, { key: 'gstin', label: 'GSTIN' },
    { key: 'taxableValue', label: 'Taxable Value' }, { key: 'cgst', label: 'CGST' }, { key: 'sgst', label: 'SGST' },
    { key: 'igst', label: 'IGST' }, { key: 'total', label: 'Total' }
  ]));
  const exportGstr3b = () => {
    const rows = [
      { section: '3.1(a) Outward Taxable Supplies', ...gstr3b.outwardTaxableSupplies },
      { section: '3.1(b) Outward Zero-Rated (Export/SEZ)', ...gstr3b.outwardZeroRatedSupplies },
      { section: '3.1(c) Outward Nil-Rated/Exempt', ...gstr3b.outwardNilExemptSupplies },
      { section: '3.1(e) Outward Non-GST', ...gstr3b.outwardNonGstSupplies },
      { section: '3.1(d) Inward Reverse Charge', ...gstr3b.inwardReverseCharge },
      { section: '4. ITC Available', taxableValue: '-', ...gstr3b.itcAvailable },
      { section: '4. ITC Reversed/Ineligible', taxableValue: '-', ...gstr3b.itcReversed },
      { section: '6.1 Net Tax Payable', taxableValue: '-', ...gstr3b.netTaxPayable }
    ];
    downloadCsv(`gstr3b-${month}-${year}.csv`, toCsv(rows, [
      { key: 'section', label: 'Section' }, { key: 'taxableValue', label: 'Taxable Value' },
      { key: 'cgst', label: 'CGST' }, { key: 'sgst', label: 'SGST' }, { key: 'igst', label: 'IGST' }, { key: 'total', label: 'Total' }
    ]));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="p-2 border border-gray-800 text-gray-400 hover:text-white rounded-lg cursor-pointer">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-white tracking-wide">GST Reports</h2>
            <p className="text-gray-400 text-xs mt-1">GST payable summary, GSTR-1 and GSTR-3B return breakup</p>
          </div>
        </div>
      </div>

      {/* Navigation tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gray-800 pb-px">
        {[
          { id: 'summary', name: 'GST Payable Summary' },
          { id: 'gstr1', name: 'GSTR-1' },
          { id: 'gstr3b', name: 'GSTR-3B' }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-3 text-xs font-bold uppercase tracking-wider transition border-b-2 -mb-px ${
              activeTab === t.id ? 'border-amber-500 text-amber-500' : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            {t.name}
          </button>
        ))}
      </div>

      {/* Period controls */}
      {activeTab === 'summary' ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-[#111827]/40 p-4 rounded-xl border border-gray-800">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">From Date</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-[#0d1224] border border-gray-800 rounded-lg p-2 text-white text-xs outline-none" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">To Date</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-[#0d1224] border border-gray-800 rounded-lg p-2 text-white text-xs outline-none" />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-[#111827]/40 p-4 rounded-xl border border-gray-800">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Return Month</label>
            <select value={month} onChange={e => setMonth(Number(e.target.value))} className="w-full bg-[#0d1224] border border-gray-800 rounded-lg p-2 text-white text-xs outline-none">
              {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Year</label>
            <input type="number" value={year} onChange={e => setYear(Number(e.target.value))} className="w-full bg-[#0d1224] border border-gray-800 rounded-lg p-2 text-white text-xs outline-none" />
          </div>
        </div>
      )}

      <div className="glass rounded-xl border border-gray-800 p-6">
        {/* GST Payable Summary */}
        {activeTab === 'summary' && (
          summaryLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
          ) : (
            <div className="space-y-6">
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Output Tax (Collected on Sales)</h4>
                <div className="grid grid-cols-4 gap-4">
                  <StatCard label="CGST" value={summary.outputTax.cgst} tone="emerald" />
                  <StatCard label="SGST" value={summary.outputTax.sgst} tone="emerald" />
                  <StatCard label="IGST" value={summary.outputTax.igst} tone="emerald" />
                  <StatCard label="Total" value={summary.outputTax.total} tone="emerald" />
                </div>
              </div>
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Input Tax Credit (Paid on Purchases)</h4>
                <div className="grid grid-cols-4 gap-4">
                  <StatCard label="CGST" value={summary.inputTaxCredit.cgst} />
                  <StatCard label="SGST" value={summary.inputTaxCredit.sgst} />
                  <StatCard label="IGST" value={summary.inputTaxCredit.igst} />
                  <StatCard label="Total" value={summary.inputTaxCredit.total} />
                </div>
              </div>
              <div className="bg-amber-500/5 p-4 rounded-lg border border-amber-500/10">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Net GST Payable</h4>
                <div className="grid grid-cols-4 gap-4">
                  <StatCard label="CGST" value={summary.netPayable.cgst} tone="amber" />
                  <StatCard label="SGST" value={summary.netPayable.sgst} tone="amber" />
                  <StatCard label="IGST" value={summary.netPayable.igst} tone="amber" />
                  <StatCard label="Total Payable" value={summary.netPayable.total} tone="amber" />
                </div>
                <p className="text-[10px] text-gray-500 mt-3">A negative amount means excess Input Tax Credit is carried forward to the next period, not payable in cash.</p>
              </div>
            </div>
          )
        )}

        {/* GSTR-1 */}
        {activeTab === 'gstr1' && (
          gstr1Loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
          ) : (
            <div className="space-y-8">
              <div className="flex items-center justify-between bg-[#111827]/40 p-4 rounded-lg text-xs">
                <span className="text-gray-400">Return Period: <span className="text-white font-semibold">{periodLabel}</span></span>
                <span className="text-gray-400">Invoices Issued: <span className="text-white font-semibold">{gstr1.docsIssued.count}</span> ({gstr1.docsIssued.fromInvoice || '-'} to {gstr1.docsIssued.toInvoice || '-'}, {gstr1.docsIssued.cancelledCount} cancelled)</span>
              </div>

              {/* B2B */}
              <div>
                <SectionHeader title="B2B — Registered Customers" subtitle="Invoice-wise, grouped by GSTIN" onExport={gstr1.b2b.length ? exportB2B : undefined} />
                {gstr1.b2b.length === 0 ? <p className="text-xs text-gray-500 py-4">No B2B invoices in this period.</p> : (
                  <div className="space-y-4">
                    {gstr1.b2b.map((g, idx) => (
                      <div key={idx} className="border border-gray-800 rounded-lg overflow-hidden">
                        <div className="flex justify-between items-center bg-[#111827]/60 px-4 py-2 text-xs">
                          <span className="font-semibold text-white">{g.partyName} <span className="text-gray-500 font-mono ml-2">{g.gstin}</span></span>
                          <span className="text-amber-500 font-mono font-semibold">{money(g.total)}</span>
                        </div>
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="text-gray-500 border-b border-gray-800">
                              <th className="px-4 py-2 font-semibold">Invoice No</th>
                              <th className="px-4 py-2 font-semibold">Date</th>
                              <th className="px-4 py-2 font-semibold text-right">Taxable Value</th>
                              <th className="px-4 py-2 font-semibold text-right">CGST</th>
                              <th className="px-4 py-2 font-semibold text-right">SGST</th>
                              <th className="px-4 py-2 font-semibold text-right">IGST</th>
                              <th className="px-4 py-2 font-semibold text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-800/40">
                            {g.invoices.map((inv, i2) => (
                              <tr key={i2}>
                                <td className="px-4 py-2 font-mono text-white">{inv.invoiceNumber}</td>
                                <td className="px-4 py-2 text-gray-400">{formatDate(inv.saleDate)}</td>
                                <td className="px-4 py-2 text-right font-mono text-white">{money(inv.taxableValue)}</td>
                                <td className="px-4 py-2 text-right font-mono text-white">{money(inv.cgst)}</td>
                                <td className="px-4 py-2 text-right font-mono text-white">{money(inv.sgst)}</td>
                                <td className="px-4 py-2 text-right font-mono text-white">{money(inv.igst)}</td>
                                <td className="px-4 py-2 text-right font-mono text-amber-500 font-semibold">{money(inv.total)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* B2CL */}
              <div>
                <SectionHeader title="B2CL — Unregistered, Inter-State, Above ₹1,00,000" subtitle="Invoice-wise" onExport={gstr1.b2cl.length ? exportB2CL : undefined} />
                {gstr1.b2cl.length === 0 ? <p className="text-xs text-gray-500 py-4">No B2CL invoices in this period.</p> : (
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-gray-500 border-b border-gray-800">
                        <th className="py-2 font-semibold">Invoice No</th>
                        <th className="py-2 font-semibold">Date</th>
                        <th className="py-2 font-semibold">Place of Supply</th>
                        <th className="py-2 font-semibold text-right">Taxable Value</th>
                        <th className="py-2 font-semibold text-right">IGST</th>
                        <th className="py-2 font-semibold text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/40">
                      {gstr1.b2cl.map((inv, idx) => (
                        <tr key={idx}>
                          <td className="py-2 font-mono text-white">{inv.invoiceNumber}</td>
                          <td className="py-2 text-gray-400">{formatDate(inv.saleDate)}</td>
                          <td className="py-2 text-gray-400">{inv.placeOfSupply}</td>
                          <td className="py-2 text-right font-mono text-white">{money(inv.taxableValue)}</td>
                          <td className="py-2 text-right font-mono text-white">{money(inv.igst)}</td>
                          <td className="py-2 text-right font-mono text-amber-500 font-semibold">{money(inv.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* B2CS */}
              <div>
                <SectionHeader title="B2CS — Unregistered, Summarized" subtitle="By place of supply + GST rate" onExport={gstr1.b2cs.length ? exportB2CS : undefined} />
                {gstr1.b2cs.length === 0 ? <p className="text-xs text-gray-500 py-4">No B2CS supplies in this period.</p> : (
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-gray-500 border-b border-gray-800">
                        <th className="py-2 font-semibold">Place of Supply</th>
                        <th className="py-2 font-semibold text-right">GST Rate</th>
                        <th className="py-2 font-semibold text-right">Taxable Value</th>
                        <th className="py-2 font-semibold text-right">CGST</th>
                        <th className="py-2 font-semibold text-right">SGST</th>
                        <th className="py-2 font-semibold text-right">IGST</th>
                        <th className="py-2 font-semibold text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/40">
                      {gstr1.b2cs.map((row, idx) => (
                        <tr key={idx}>
                          <td className="py-2 text-white">{row.placeOfSupply}</td>
                          <td className="py-2 text-right text-gray-400">{row.gstRate}%</td>
                          <td className="py-2 text-right font-mono text-white">{money(row.taxableValue)}</td>
                          <td className="py-2 text-right font-mono text-white">{money(row.cgst)}</td>
                          <td className="py-2 text-right font-mono text-white">{money(row.sgst)}</td>
                          <td className="py-2 text-right font-mono text-white">{money(row.igst)}</td>
                          <td className="py-2 text-right font-mono text-amber-500 font-semibold">{money(row.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* CDNR / CDNUR */}
              <div>
                <SectionHeader title="CDNR — Credit/Debit Notes (Registered)" onExport={gstr1.cdnr.length ? () => exportNotes(gstr1.cdnr, 'cdnr') : undefined} />
                {gstr1.cdnr.length === 0 ? <p className="text-xs text-gray-500 py-4">No credit/debit notes against registered parties.</p> : (
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-gray-500 border-b border-gray-800">
                        <th className="py-2 font-semibold">Voucher No</th>
                        <th className="py-2 font-semibold">Type</th>
                        <th className="py-2 font-semibold">Party</th>
                        <th className="py-2 font-semibold text-right">Taxable Value</th>
                        <th className="py-2 font-semibold text-right">Total Tax</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/40">
                      {gstr1.cdnr.map((n, idx) => (
                        <tr key={idx}>
                          <td className="py-2 font-mono text-white">{n.voucherNumber}</td>
                          <td className="py-2 text-gray-400">{n.type}</td>
                          <td className="py-2 text-gray-400">{n.partyName} <span className="font-mono text-gray-600">{n.gstin}</span></td>
                          <td className="py-2 text-right font-mono text-white">{money(n.taxableValue)}</td>
                          <td className="py-2 text-right font-mono text-amber-500">{money(Number(n.cgst) + Number(n.sgst) + Number(n.igst))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div>
                <SectionHeader title="CDNUR — Credit/Debit Notes (Unregistered)" onExport={gstr1.cdnur.length ? () => exportNotes(gstr1.cdnur, 'cdnur') : undefined} />
                {gstr1.cdnur.length === 0 ? <p className="text-xs text-gray-500 py-4">No credit/debit notes against unregistered parties.</p> : (
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-gray-500 border-b border-gray-800">
                        <th className="py-2 font-semibold">Voucher No</th>
                        <th className="py-2 font-semibold">Type</th>
                        <th className="py-2 font-semibold">Party</th>
                        <th className="py-2 font-semibold text-right">Taxable Value</th>
                        <th className="py-2 font-semibold text-right">Total Tax</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/40">
                      {gstr1.cdnur.map((n, idx) => (
                        <tr key={idx}>
                          <td className="py-2 font-mono text-white">{n.voucherNumber}</td>
                          <td className="py-2 text-gray-400">{n.type}</td>
                          <td className="py-2 text-gray-400">{n.partyName}</td>
                          <td className="py-2 text-right font-mono text-white">{money(n.taxableValue)}</td>
                          <td className="py-2 text-right font-mono text-amber-500">{money(Number(n.cgst) + Number(n.sgst) + Number(n.igst))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* HSN Summary */}
              <div>
                <SectionHeader title="HSN-wise Summary" onExport={gstr1.hsn.length ? exportHsn : undefined} />
                {gstr1.hsn.length === 0 ? <p className="text-xs text-gray-500 py-4">No line items in this period.</p> : (
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-gray-500 border-b border-gray-800">
                        <th className="py-2 font-semibold">HSN Code</th>
                        <th className="py-2 font-semibold text-right">GST Rate</th>
                        <th className="py-2 font-semibold text-right">Qty</th>
                        <th className="py-2 font-semibold text-right">Taxable Value</th>
                        <th className="py-2 font-semibold text-right">CGST</th>
                        <th className="py-2 font-semibold text-right">SGST</th>
                        <th className="py-2 font-semibold text-right">IGST</th>
                        <th className="py-2 font-semibold text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/40">
                      {gstr1.hsn.map((row, idx) => (
                        <tr key={idx}>
                          <td className="py-2 font-mono text-white">{row.hsnCode}</td>
                          <td className="py-2 text-right text-gray-400">{row.gstRate}%</td>
                          <td className="py-2 text-right text-gray-400">{row.qty}</td>
                          <td className="py-2 text-right font-mono text-white">{money(row.taxableValue)}</td>
                          <td className="py-2 text-right font-mono text-white">{money(row.cgst)}</td>
                          <td className="py-2 text-right font-mono text-white">{money(row.sgst)}</td>
                          <td className="py-2 text-right font-mono text-white">{money(row.igst)}</td>
                          <td className="py-2 text-right font-mono text-amber-500 font-semibold">{money(row.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )
        )}

        {/* GSTR-3B */}
        {activeTab === 'gstr3b' && (
          gstr3bLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between bg-[#111827]/40 p-4 rounded-lg text-xs">
                <span className="text-gray-400">Return Period: <span className="text-white font-semibold">{periodLabel}</span></span>
                <ExportButton onClick={exportGstr3b} />
              </div>

              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">3.1 Details of Outward Supplies &amp; Inward Supplies Liable to Reverse Charge</h4>
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-800">
                      <th className="py-2 font-semibold">Nature of Supplies</th>
                      <th className="py-2 font-semibold text-right">Taxable Value</th>
                      <th className="py-2 font-semibold text-right">CGST</th>
                      <th className="py-2 font-semibold text-right">SGST</th>
                      <th className="py-2 font-semibold text-right">IGST</th>
                      <th className="py-2 font-semibold text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/40">
                    {[
                      ['(a) Outward Taxable Supplies', gstr3b.outwardTaxableSupplies],
                      ['(b) Outward Zero-Rated (Export/SEZ)', gstr3b.outwardZeroRatedSupplies],
                      ['(c) Nil-Rated / Exempt', gstr3b.outwardNilExemptSupplies],
                      ['(d) Inward Liable to Reverse Charge', gstr3b.inwardReverseCharge],
                      ['(e) Non-GST Outward Supplies', gstr3b.outwardNonGstSupplies]
                    ].map(([label, v], idx) => (
                      <tr key={idx}>
                        <td className="py-2 text-white">{label}</td>
                        <td className="py-2 text-right font-mono text-white">{money(v.taxableValue)}</td>
                        <td className="py-2 text-right font-mono text-white">{money(v.cgst)}</td>
                        <td className="py-2 text-right font-mono text-white">{money(v.sgst)}</td>
                        <td className="py-2 text-right font-mono text-white">{money(v.igst)}</td>
                        <td className="py-2 text-right font-mono text-amber-500 font-semibold">{money(v.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">4. Eligible ITC</h4>
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-800">
                      <th className="py-2 font-semibold">Details</th>
                      <th className="py-2 font-semibold text-right">CGST</th>
                      <th className="py-2 font-semibold text-right">SGST</th>
                      <th className="py-2 font-semibold text-right">IGST</th>
                      <th className="py-2 font-semibold text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/40">
                    <tr>
                      <td className="py-2 text-white">ITC Available</td>
                      <td className="py-2 text-right font-mono text-emerald-400">{money(gstr3b.itcAvailable.cgst)}</td>
                      <td className="py-2 text-right font-mono text-emerald-400">{money(gstr3b.itcAvailable.sgst)}</td>
                      <td className="py-2 text-right font-mono text-emerald-400">{money(gstr3b.itcAvailable.igst)}</td>
                      <td className="py-2 text-right font-mono text-emerald-400 font-semibold">{money(gstr3b.itcAvailable.total)}</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-white">ITC Reversed / Ineligible</td>
                      <td className="py-2 text-right font-mono text-red-400">{money(gstr3b.itcReversed.cgst)}</td>
                      <td className="py-2 text-right font-mono text-red-400">{money(gstr3b.itcReversed.sgst)}</td>
                      <td className="py-2 text-right font-mono text-red-400">{money(gstr3b.itcReversed.igst)}</td>
                      <td className="py-2 text-right font-mono text-red-400 font-semibold">{money(gstr3b.itcReversed.total)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="bg-amber-500/5 p-4 rounded-lg border border-amber-500/10">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">6.1 Net Tax Payable</h4>
                <div className="grid grid-cols-4 gap-4">
                  <StatCard label="CGST" value={gstr3b.netTaxPayable.cgst} tone="amber" />
                  <StatCard label="SGST" value={gstr3b.netTaxPayable.sgst} tone="amber" />
                  <StatCard label="IGST" value={gstr3b.netTaxPayable.igst} tone="amber" />
                  <StatCard label="Total Payable" value={gstr3b.netTaxPayable.total} tone="amber" />
                </div>
                <p className="text-[10px] text-gray-500 mt-3">A negative amount means excess Input Tax Credit is carried forward to the next period, not payable in cash.</p>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
