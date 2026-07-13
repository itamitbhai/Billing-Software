import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tallyApi } from '../../api/tally.api';
import { PiggyBank, Plus, CheckCircle, Search, Calendar, FileSpreadsheet, Loader2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { formatDate, formatRupees } from '../../utils/format';

export default function BankingPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('accounts');
  const [selectedAccount, setSelectedAccount] = useState(null);

  // Modal States
  const [accountModal, setAccountModal] = useState(false);
  const [accountForm, setAccountForm] = useState({ name: '', ledgerId: '', bankName: '', accountNumber: '', ifsc: '', branch: '', openingBalance: '0' });

  // Date filters for Bank Statement lookup
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // ── Queries ───────────────────────────────────────────────────
  const { data: accountsRes, isLoading: accountsLoading } = useQuery({ queryKey: ['bank-accounts'], queryFn: tallyApi.banking.accounts.list });
  const { data: ledgersRes } = useQuery({ queryKey: ['ledgers'], queryFn: () => tallyApi.ledgers.list() });

  const accounts = accountsRes?.data || [];
  const bankLedgers = (ledgersRes?.data || []).filter(l => l.group?.name === 'Bank Accounts');

  // Query Statement
  const { data: statementRes, isLoading: statementLoading } = useQuery({
    queryKey: ['bank-statement', selectedAccount?.id, startDate, endDate],
    queryFn: () => tallyApi.banking.accounts.statement(selectedAccount.id, { startDate, endDate }),
    enabled: !!selectedAccount
  });

  // Query pending reconciliations
  const { data: pendingRes, isLoading: pendingLoading } = useQuery({
    queryKey: ['bank-pending', selectedAccount?.id],
    queryFn: () => tallyApi.banking.accounts.pending(selectedAccount.id),
    enabled: !!selectedAccount && activeTab === 'reconcile'
  });

  const statement = statementRes?.data || { transactions: [] };
  const pendingTransactions = pendingRes?.data || [];

  // ── Mutations ─────────────────────────────────────────────────
  const createAccountMut = useMutation({
    mutationFn: tallyApi.banking.accounts.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      toast.success('Bank Account created and mapped to General Ledger');
      setAccountModal(false);
      setAccountForm({ name: '', ledgerId: '', bankName: '', accountNumber: '', ifsc: '', branch: '', openingBalance: '0' });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error creating bank account')
  });

  const reconcileMut = useMutation({
    mutationFn: ({ accountId, lineId, data }) => tallyApi.banking.accounts.reconcile(accountId, { voucherLineId: lineId, ...data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-pending'] });
      queryClient.invalidateQueries({ queryKey: ['bank-statement'] });
      toast.success('Transaction marked as Reconciled with Bank Statement');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error during reconciliation')
  });

  // ── Handlers ──────────────────────────────────────────────────
  const handleAccountSubmit = (e) => {
    e.preventDefault();
    createAccountMut.mutate({
      ...accountForm,
      openingBalance: Number(accountForm.openingBalance) * 100 // to paise
    });
  };

  const handleReconcile = (lineId, transactionDate) => {
    reconcileMut.mutate({
      accountId: selectedAccount.id,
      lineId,
      data: { statementDate: transactionDate, statementAmount: null }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">Banking Portal</h2>
          <p className="text-gray-400 text-xs mt-1">Manage bank accounts, view ledger statement reconciliations, and audit cheque books</p>
        </div>
        {!selectedAccount && (
          <button
            onClick={() => setAccountModal(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-[#0a0e1a] font-semibold rounded-lg text-sm transition cursor-pointer"
          >
            <Plus className="h-4.5 w-4.5" />
            Add Bank Account
          </button>
        )}
      </div>

      {/* Primary navigation: select account or list */}
      {!selectedAccount ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {accountsLoading ? (
            <div className="col-span-3 flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
          ) : accounts.length === 0 ? (
            <div className="col-span-3 text-center py-20 text-gray-500 text-sm glass rounded-xl border border-gray-800">
              No bank account records found. Link one to start banking audits.
            </div>
          ) : (
            accounts.map(acc => (
              <div key={acc.id} className="glass p-6 rounded-xl border border-gray-800 space-y-4 hover:border-amber-500/30 transition-all duration-200">
                <div className="flex justify-between items-start">
                  <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/20 text-amber-500">
                    <PiggyBank className="h-5 w-5" />
                  </div>
                  <span className="text-[10px] font-bold text-gray-500 font-mono tracking-wider">{acc.ifsc}</span>
                </div>
                <div>
                  <h4 className="font-bold text-white text-base">{acc.name}</h4>
                  <p className="text-xs text-gray-400 mt-1">{acc.bankName} — A/C {acc.accountNumber}</p>
                </div>
                <div className="border-t border-gray-800/60 pt-3 flex justify-between items-center">
                  <div>
                    <span className="text-[10px] text-gray-500 font-bold uppercase block">Book Balance</span>
                    <span className="text-sm font-semibold font-mono text-white">{formatRupees(acc.openingBalance)}</span>
                  </div>
                  <button
                    onClick={() => { setSelectedAccount(acc); setActiveTab('statement'); }}
                    className="flex items-center gap-1 text-xs text-amber-500 font-semibold hover:underline cursor-pointer"
                  >
                    Manage Account
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Account Dashboard */
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#111827]/40 p-5 rounded-xl border border-gray-800">
            <div>
              <span className="text-xs text-amber-500 font-bold uppercase tracking-wider">Account Active</span>
              <h3 className="text-lg font-bold text-white mt-1">{selectedAccount.name}</h3>
              <p className="text-xs text-gray-400 mt-0.5">{selectedAccount.bankName} • Account No: {selectedAccount.accountNumber}</p>
            </div>
            <button
              onClick={() => setSelectedAccount(null)}
              className="text-xs text-gray-400 hover:text-white border border-gray-800 hover:bg-gray-800 px-3 py-1.5 rounded-lg cursor-pointer"
            >
              Change Account
            </button>
          </div>

          {/* Sub Navigation */}
          <div className="flex border-b border-gray-800">
            <button
              onClick={() => setActiveTab('statement')}
              className={`px-5 py-3 text-sm font-semibold border-b-2 transition ${
                activeTab === 'statement' ? 'border-amber-500 text-amber-500' : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              Bank Statement
            </button>
            <button
              onClick={() => setActiveTab('reconcile')}
              className={`px-5 py-3 text-sm font-semibold border-b-2 transition ${
                activeTab === 'reconcile' ? 'border-amber-500 text-amber-500' : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              Reconciliation Audits
            </button>
          </div>

          {/* Tab Views */}
          {activeTab === 'statement' ? (
            <div className="space-y-6">
              {/* Date filters */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-[#111827]/20 p-4 rounded-xl border border-gray-800">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">From Date</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-[#0d1224] border border-gray-800 rounded-lg p-2 text-white text-xs outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">To Date</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-[#0d1224] border border-gray-800 rounded-lg p-2 text-white text-xs outline-none" />
                </div>
                <div className="flex items-end">
                  <button onClick={() => { setStartDate(''); setEndDate(''); }} className="w-full bg-[#1f2937] hover:bg-gray-800 border border-gray-800 text-gray-300 py-2 rounded-lg text-xs font-semibold cursor-pointer">Reset Ranges</button>
                </div>
              </div>

              {/* Transactions Sheet */}
              <div className="glass rounded-xl border border-gray-800 p-6">
                {statementLoading ? (
                  <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
                ) : statement.transactions.length === 0 ? (
                  <div className="text-center py-20 text-gray-500 text-sm">No transaction records logged in statement range.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-gray-400 font-bold uppercase border-b border-gray-800 pb-3">
                          <th className="pb-3">Voucher Date</th>
                          <th className="pb-3">Voucher Ref</th>
                          <th className="pb-3">Narration / Particulars</th>
                          <th className="pb-3 text-right">Debit (Inflow)</th>
                          <th className="pb-3 text-right">Credit (Outflow)</th>
                          <th className="pb-3 text-right">Running Balance</th>
                          <th className="pb-3 text-right">Reconciliation</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/40 text-sm">
                        {statement.transactions.map((tr, idx) => (
                          <tr key={idx} className="hover:bg-[#111827]/10">
                            <td className="py-3 text-gray-400">{formatDate(tr.voucher?.date)}</td>
                            <td className="py-3 font-semibold text-white font-mono">{tr.voucher?.voucherNumber}</td>
                            <td className="py-3 text-gray-300 max-w-xs truncate">{tr.voucher?.narration || '-'}</td>
                            <td className="py-3 text-right font-mono font-semibold text-emerald-400">{tr.type === 'DEBIT' ? formatRupees(tr.amount) : '-'}</td>
                            <td className="py-3 text-right font-mono font-semibold text-red-400">{tr.type === 'CREDIT' ? formatRupees(tr.amount) : '-'}</td>
                            <td className="py-3 text-right font-mono text-white font-bold">{formatRupees(tr.runningBalance)}</td>
                            <td className="py-3 text-right">
                              {tr.reconciliation?.isReconciled ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                  <CheckCircle className="h-3 w-3" /> Reconciled
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-gray-500 bg-gray-800/40 px-2 py-0.5 rounded">Unreconciled</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Reconciliation portal screen */
            <div className="glass rounded-xl border border-gray-800 p-6 space-y-6">
              <div>
                <h4 className="font-bold text-white text-sm">Unreconciled Book Entries</h4>
                <p className="text-xs text-gray-500 mt-1">Cross-check unreconciled ledger entries with actual bank clearances</p>
              </div>

              {pendingLoading ? (
                <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
              ) : pendingTransactions.length === 0 ? (
                <div className="text-center py-16 text-gray-500 text-sm">No pending ledger entries found for reconciliation.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-gray-400 font-bold uppercase border-b border-gray-800 pb-3">
                        <th className="pb-3">Date</th>
                        <th className="pb-3">Vch No.</th>
                        <th className="pb-3">Type</th>
                        <th className="pb-3">Amount</th>
                        <th className="pb-3 text-right">Action Clearances</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/40 text-sm">
                      {pendingTransactions.map((line) => (
                        <tr key={line.id}>
                          <td className="py-3 text-gray-400">{formatDate(line.voucher?.date)}</td>
                          <td className="py-3 font-semibold text-white font-mono">{line.voucher?.voucherNumber}</td>
                          <td className="py-3"><span className="text-[10px] font-bold text-amber-500 uppercase">{line.type}</span></td>
                          <td className="py-3 font-mono text-white font-bold">{formatRupees(line.amount)}</td>
                          <td className="py-3 text-right">
                            <button
                              onClick={() => handleReconcile(line.id, line.voucher?.date)}
                              disabled={reconcileMut.isPending}
                              className="inline-flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-[#0a0e1a] font-bold text-[10px] uppercase px-3 py-1.5 rounded transition cursor-pointer disabled:opacity-50"
                            >
                              <CheckCircle className="h-3 w-3" /> Reconcile
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Bank Account Modal ── */}
      {accountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass max-w-md w-full p-6 rounded-xl border border-gray-800">
            <h3 className="text-base font-bold text-white mb-4">Link Corporate Bank Account</h3>
            <form onSubmit={handleAccountSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Account Label / Name</label>
                <input type="text" required value={accountForm.name} onChange={e => setAccountForm({ ...accountForm, name: e.target.value })} placeholder="E.g., SBI Current Account" className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white placeholder-gray-600 outline-none text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Bank Name</label>
                  <input type="text" required value={accountForm.bankName} onChange={e => setAccountForm({ ...accountForm, bankName: e.target.value })} placeholder="E.g., State Bank of India" className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white placeholder-gray-600 outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">General Ledger Map</label>
                  <select required value={accountForm.ledgerId} onChange={e => setAccountForm({ ...accountForm, ledgerId: e.target.value })} className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white outline-none text-sm">
                    <option value="">Select Bank Ledger...</option>
                    {bankLedgers.map(l => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Account Number</label>
                  <input type="text" required value={accountForm.accountNumber} onChange={e => setAccountForm({ ...accountForm, accountNumber: e.target.value })} placeholder="3000412345" className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white placeholder-gray-600 outline-none text-sm font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">IFSC Routing Code</label>
                  <input type="text" required value={accountForm.ifsc} onChange={e => setAccountForm({ ...accountForm, ifsc: e.target.value })} placeholder="SBIN000123" className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white placeholder-gray-600 outline-none text-sm font-mono uppercase" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Branch Name</label>
                  <input type="text" value={accountForm.branch} onChange={e => setAccountForm({ ...accountForm, branch: e.target.value })} placeholder="E.g., Connaught Place" className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white placeholder-gray-600 outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Opening Balance (₹)</label>
                  <input type="number" value={accountForm.openingBalance} onChange={e => setAccountForm({ ...accountForm, openingBalance: e.target.value })} className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white outline-none text-sm font-mono" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-3">
                <button type="button" onClick={() => setAccountModal(false)} className="px-4 py-2 border border-gray-800 text-gray-400 hover:text-white rounded-lg text-xs">Cancel</button>
                <button type="submit" disabled={createAccountMut.isPending} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-[#0a0e1a] font-semibold rounded-lg text-xs">Save Account</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
