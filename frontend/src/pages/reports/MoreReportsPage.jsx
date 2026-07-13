import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { tallyApi } from '../../api/tally.api';
import { Loader2, ArrowLeft, Milestone, TrendingUp, Calendar, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatRupees, formatDate } from '../../utils/format';

export default function MoreReportsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('trial-balance');

  // Sub parameters
  const [selectedLedgerId, setSelectedLedgerId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // ── Queries ───────────────────────────────────────────────────
  const { data: ledgersRes } = useQuery({ queryKey: ['ledgers'], queryFn: () => tallyApi.ledgers.list() });
  const ledgers = ledgersRes?.data || [];

  // 1. Trial Balance Query
  const { data: tbRes, isLoading: tbLoading } = useQuery({
    queryKey: ['trial-balance', activeTab],
    queryFn: () => tallyApi.reports.trialBalance(),
    enabled: activeTab === 'trial-balance'
  });

  // 2. Receivables Query
  const { data: recRes, isLoading: recLoading } = useQuery({
    queryKey: ['receivables', activeTab],
    queryFn: () => tallyApi.reports.receivables(),
    enabled: activeTab === 'receivables'
  });

  // 3. Payables Query
  const { data: payRes, isLoading: payLoading } = useQuery({
    queryKey: ['payables', activeTab],
    queryFn: () => tallyApi.reports.payables(),
    enabled: activeTab === 'payables'
  });

  // 4. Cash Flow Query
  const { data: cfRes, isLoading: cfLoading } = useQuery({
    queryKey: ['cash-flow', activeTab, startDate, endDate],
    queryFn: () => tallyApi.reports.cashFlow({ startDate, endDate }),
    enabled: activeTab === 'cash-flow'
  });

  // 5. Ledger Statement Query
  const { data: statementRes, isLoading: statementLoading } = useQuery({
    queryKey: ['ledger-statement', selectedLedgerId, startDate, endDate],
    queryFn: () => tallyApi.reports.ledgerStatement(selectedLedgerId, { startDate, endDate }),
    enabled: activeTab === 'ledger' && !!selectedLedgerId
  });

  const tb = tbRes?.data || { rows: [], totalDr: '0', totalCr: '0' };
  const receivables = recRes?.data || { parties: [], total: '0' };
  const payables = payRes?.data || { parties: [], total: '0' };
  const cashflow = cfRes?.data || { transactions: [], inflow: '0', outflow: '0', netCashFlow: '0' };
  const statement = statementRes?.data || { entries: [], openingBalance: '0', closingBalance: '0', closingType: 'DR' };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="p-2 border border-gray-800 text-gray-400 hover:text-white rounded-lg cursor-pointer">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-white tracking-wide">Display More Reports</h2>
            <p className="text-gray-400 text-xs mt-1">Explore trial balance, cash flows, ledger statements, and outstanding bills</p>
          </div>
        </div>
      </div>

      {/* Navigation tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gray-800 pb-px">
        {[
          { id: 'trial-balance', name: 'Trial Balance' },
          { id: 'receivables', name: 'Receivables' },
          { id: 'payables', name: 'Payables' },
          { id: 'cash-flow', name: 'Cash Flow' },
          { id: 'ledger', name: 'Ledger Statement' }
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

      {/* Shared date range controls for Cash Flow & Ledger Statement */}
      {(activeTab === 'cash-flow' || activeTab === 'ledger') && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-[#111827]/40 p-4 rounded-xl border border-gray-800">
          {activeTab === 'ledger' && (
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Select Ledger Account</label>
              <select
                value={selectedLedgerId}
                onChange={e => setSelectedLedgerId(e.target.value)}
                className="w-full bg-[#0d1224] border border-gray-800 rounded-lg p-2 text-white text-xs outline-none"
              >
                <option value="">Select Ledger...</option>
                {ledgers.map(l => (
                  <option key={l.id} value={l.id}>{l.name} ({l.group?.name})</option>
                ))}
              </select>
            </div>
          )}
          <div className={activeTab === 'cash-flow' ? 'sm:col-span-1' : ''}>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">From Date</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-[#0d1224] border border-gray-800 rounded-lg p-2 text-white text-xs outline-none" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">To Date</label>
            <input type="date" value={endDate} onChange={e => setTargetDateRange(e.target.value)} className="w-full bg-[#0d1224] border border-gray-800 rounded-lg p-2 text-white text-xs outline-none" />
          </div>
        </div>
      )}

      {/* Render Active View */}
      <div className="glass rounded-xl border border-gray-800 p-6">
        {/* Trial Balance */}
        {activeTab === 'trial-balance' && (
          <div>
            {tbLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-4 text-xs font-bold text-gray-400 uppercase border-b border-gray-800 pb-3">
                  <div className="col-span-2">Account Ledger Name / Group</div>
                  <div className="text-right">Debit (Dr)</div>
                  <div className="text-right">Credit (Cr)</div>
                </div>
                <div className="divide-y divide-gray-800/40">
                  {tb.rows.map((row, idx) => (
                    <div key={idx} className="grid grid-cols-4 py-3 text-sm">
                      <div className="col-span-2">
                        <span className="font-semibold text-white">{row.name}</span>
                        <span className="text-xs text-gray-500 ml-2">({row.group})</span>
                      </div>
                      <div className="text-right font-mono text-white">{Number(row.dr) > 0 ? formatRupees(row.dr) : '-'}</div>
                      <div className="text-right font-mono text-white">{Number(row.cr) > 0 ? formatRupees(row.cr) : '-'}</div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-4 pt-4 border-t border-gray-850 font-bold bg-[#111827]/40 p-4 rounded-lg">
                  <div className="col-span-2 text-white">Trial Balance Summary</div>
                  <div className="text-right font-mono text-amber-500">{formatRupees(tb.totalDr)}</div>
                  <div className="text-right font-mono text-amber-500">{formatRupees(tb.totalCr)}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Receivables */}
        {activeTab === 'receivables' && (
          <div>
            {recLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-3 text-xs font-bold text-gray-400 uppercase border-b border-gray-800 pb-3">
                  <div>Customer Party Name</div>
                  <div>GSTIN</div>
                  <div className="text-right">Outstanding Amount</div>
                </div>
                <div className="divide-y divide-gray-800/40">
                  {receivables.parties.map(p => (
                    <div key={p.id} className="grid grid-cols-3 py-3 text-sm">
                      <div className="font-semibold text-white">{p.name}</div>
                      <div className="text-gray-400 font-mono">{p.gstin || '-'}</div>
                      <div className="text-right font-mono text-emerald-400 font-bold">{formatRupees(p.outstanding)}</div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center bg-emerald-500/5 p-4 rounded-lg border border-emerald-500/10 pt-4 font-bold">
                  <span className="text-xs text-white">Total Outstanding Receivables</span>
                  <span className="font-mono text-emerald-400 text-sm">{formatRupees(receivables.total)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Payables */}
        {activeTab === 'payables' && (
          <div>
            {payLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-3 text-xs font-bold text-gray-400 uppercase border-b border-gray-800 pb-3">
                  <div>Supplier Party Name</div>
                  <div>GSTIN</div>
                  <div className="text-right">Outstanding Amount</div>
                </div>
                <div className="divide-y divide-gray-800/40">
                  {payables.parties.map(p => (
                    <div key={p.id} className="grid grid-cols-3 py-3 text-sm">
                      <div className="font-semibold text-white">{p.name}</div>
                      <div className="text-gray-400 font-mono">{p.gstin || '-'}</div>
                      <div className="text-right font-mono text-red-400 font-bold">{formatRupees(p.outstanding)}</div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center bg-red-500/5 p-4 rounded-lg border border-red-500/10 pt-4 font-bold">
                  <span className="text-xs text-white">Total Outstanding Payables</span>
                  <span className="font-mono text-red-400 text-sm">{formatRupees(payables.total)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Cash Flow */}
        {activeTab === 'cash-flow' && (
          <div>
            {cfLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-3 gap-4 text-xs font-bold text-center">
                  <div className="bg-[#111827]/40 p-4 rounded-lg border border-gray-850">
                    <span className="text-gray-500 block">Total Cash Inflow</span>
                    <span className="text-sm font-semibold text-emerald-400 mt-1 block font-mono">{formatRupees(cashflow.inflow)}</span>
                  </div>
                  <div className="bg-[#111827]/40 p-4 rounded-lg border border-gray-855">
                    <span className="text-gray-500 block">Total Cash Outflow</span>
                    <span className="text-sm font-semibold text-red-400 mt-1 block font-mono">{formatRupees(cashflow.outflow)}</span>
                  </div>
                  <div className="bg-[#111827]/40 p-4 rounded-lg border border-gray-860">
                    <span className="text-gray-500 block">Net Change</span>
                    <span className="text-sm font-semibold text-amber-500 mt-1 block font-mono">{formatRupees(cashflow.netCashFlow)}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Cash Movement Ledger Details</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-gray-400 font-bold border-b border-gray-800 pb-3">
                          <th className="pb-3">Date</th>
                          <th className="pb-3">Vch No.</th>
                          <th className="pb-3">Reference / Description</th>
                          <th className="pb-3 text-right">Inflow Amount</th>
                          <th className="pb-3 text-right">Outflow Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/40 text-sm">
                        {cashflow.transactions.map((tr, idx) => (
                          <tr key={idx}>
                            <td className="py-3 text-gray-400">{formatDate(tr.voucher?.date)}</td>
                            <td className="py-3 font-semibold text-white font-mono">{tr.voucher?.voucherNumber}</td>
                            <td className="py-3 text-gray-300">{tr.voucher?.narration || 'General Cash Entry'}</td>
                            <td className="py-3 text-right font-mono text-emerald-400 font-semibold">{tr.direction === 'INFLOW' ? formatRupees(tr.amount) : '-'}</td>
                            <td className="py-3 text-right font-mono text-red-400 font-semibold">{tr.direction === 'OUTFLOW' ? formatRupees(tr.amount) : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Ledger Statement */}
        {activeTab === 'ledger' && (
          <div>
            {!selectedLedgerId ? (
              <div className="text-center py-12 text-gray-500 text-sm">Please select a ledger account to retrieve statement details.</div>
            ) : statementLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-between items-center bg-[#111827]/40 p-4 rounded-lg text-xs">
                  <div>
                    <span className="text-gray-500 block">Opening Balance</span>
                    <span className="text-sm font-semibold text-white mt-1 block font-mono">
                      {formatRupees(statement.openingBalance)} <span className="text-[10px] text-gray-500 uppercase">{statement.openingType}</span>
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-gray-500 block">Closing Balance</span>
                    <span className="text-sm font-semibold text-amber-500 mt-1 block font-mono">
                      {formatRupees(statement.closingBalance)} <span className="text-[10px] text-gray-500 uppercase">{statement.closingType}</span>
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-gray-400 font-bold border-b border-gray-800 pb-3">
                        <th className="pb-3">Date</th>
                        <th className="pb-3">Vch Ref</th>
                        <th className="pb-3">Narration / Particulars</th>
                        <th className="pb-3 text-right">Debit (Dr)</th>
                        <th className="pb-3 text-right">Credit (Cr)</th>
                        <th className="pb-3 text-right font-bold text-gray-300">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/40 text-sm">
                      {statement.entries.map((ent, idx) => (
                        <tr key={idx}>
                          <td className="py-3 text-gray-400">{formatDate(ent.voucher?.date)}</td>
                          <td className="py-3 font-semibold text-white font-mono">{ent.voucher?.voucherNumber}</td>
                          <td className="py-3 text-gray-300">{ent.voucher?.narration || '-'}</td>
                          <td className="py-3 text-right font-mono text-white">{ent.type === 'DEBIT' ? formatRupees(ent.amount) : '-'}</td>
                          <td className="py-3 text-right font-mono text-white">{ent.type === 'CREDIT' ? formatRupees(ent.amount) : '-'}</td>
                          <td className="py-3 text-right font-mono font-bold text-amber-500">{formatRupees(ent.runningBalance)} {ent.balanceType}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
