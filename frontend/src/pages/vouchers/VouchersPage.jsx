import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tallyApi } from '../../api/tally.api';
import { Receipt, Plus, Search, Calendar, ChevronLeft, ChevronRight, Eye, Edit2, Trash2, Loader2 } from 'lucide-react';
import { formatDate, formatRupees } from '../../utils/format';
import { toast } from 'sonner';

const MANUAL_TYPES = ['JOURNAL', 'CONTRA', 'CREDIT_NOTE', 'DEBIT_NOTE'];

export default function VouchersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [type, setType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Selected voucher detail state
  const [selectedVoucher, setSelectedVoucher] = useState(null);

  // ── Queries ───────────────────────────────────────────────────
  const { data: voucherRes, isLoading } = useQuery({
    queryKey: ['vouchers', page, type, startDate, endDate],
    queryFn: () => tallyApi.vouchers.list({ page, type, startDate, endDate, limit: 15 })
  });

  const vouchers = voucherRes?.data || [];
  const totalPages = voucherRes?.totalPages || 1;

  // ── Mutations ─────────────────────────────────────────────────
  const deleteVoucherMut = useMutation({
    mutationFn: tallyApi.vouchers.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vouchers'] });
      toast.success('Voucher cancelled successfully (Soft Deleted)');
      setSelectedVoucher(null);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error cancelling voucher')
  });

  // Detailed single voucher lookup
  const handleViewDetails = async (id) => {
    try {
      const res = await tallyApi.vouchers.get(id);
      setSelectedVoucher(res);
    } catch (err) {
      toast.error('Failed to load voucher details');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">Vouchers & Books</h2>
          <p className="text-gray-400 text-xs mt-1">Audit daily transaction records and post double-entry vouchers</p>
        </div>
        <button
          onClick={() => navigate('/vouchers/new')}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-[#0a0e1a] font-semibold rounded-lg text-sm transition cursor-pointer"
        >
          <Plus className="h-4.5 w-4.5" />
          Post New Voucher (V)
        </button>
      </div>

      {/* Filters row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-[#111827]/40 p-4 rounded-xl border border-gray-800">
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Voucher Type</label>
          <select
            value={type}
            onChange={(e) => { setType(e.target.value); setPage(1); }}
            className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2 text-white outline-none text-xs"
          >
            <option value="">All Types</option>
            <option value="SALES">SALES</option>
            <option value="PURCHASE">PURCHASE</option>
            <option value="RECEIPT">RECEIPT</option>
            <option value="PAYMENT">PAYMENT</option>
            <option value="CONTRA">CONTRA</option>
            <option value="JOURNAL">JOURNAL</option>
            <option value="CREDIT_NOTE">CREDIT NOTE</option>
            <option value="DEBIT_NOTE">DEBIT NOTE</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">From Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
            className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2 text-white outline-none text-xs"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">To Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
            className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2 text-white outline-none text-xs"
          />
        </div>
        <div className="flex items-end">
          <button
            onClick={() => { setType(''); setStartDate(''); setEndDate(''); setPage(1); }}
            className="w-full bg-[#1f2937] hover:bg-gray-800 border border-gray-800 text-gray-300 py-2 rounded-lg text-xs font-semibold cursor-pointer"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Main container */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Vouchers list table */}
        <div className={`glass rounded-xl border border-gray-800 p-6 ${selectedVoucher ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-gray-400">
              <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading Books...
            </div>
          ) : vouchers.length === 0 ? (
            <div className="text-center py-20 text-gray-500 text-sm">No transaction records found matching criteria.</div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-gray-400 font-bold uppercase border-b border-gray-800 pb-3">
                      <th className="pb-3">Vch No.</th>
                      <th className="pb-3">Date</th>
                      <th className="pb-3">Type</th>
                      <th className="pb-3">Particulars / Party</th>
                      <th className="pb-3 text-right">Debit/Credit Amount</th>
                      <th className="pb-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/40 text-sm">
                    {vouchers.map((v) => {
                      // Total amount is simply the sum of debit lines
                      const totalAmt = v.lines
                        .filter(l => l.type === 'DEBIT')
                        .reduce((sum, l) => sum + BigInt(l.amount), 0n);

                      return (
                        <tr key={v.id} className="hover:bg-[#111827]/20">
                          <td className="py-3 font-semibold text-white font-mono">{v.voucherNumber}</td>
                          <td className="py-3 text-gray-400">{formatDate(v.date)}</td>
                          <td className="py-3">
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 text-amber-500">
                              {v.type}
                            </span>
                          </td>
                          <td className="py-3 text-gray-300 font-medium">{v.party?.name || 'Journal Adjustment'}</td>
                          <td className="py-3 text-right font-mono font-semibold text-white">{formatRupees(totalAmt)}</td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-2 text-gray-400">
                              {MANUAL_TYPES.includes(v.type) && (
                                <button onClick={() => navigate(`/vouchers/${v.id}/edit`)} title="Edit Voucher" className="hover:text-amber-500 transition cursor-pointer">
                                  <Edit2 className="h-4 w-4" />
                                </button>
                              )}
                              <button onClick={() => handleViewDetails(v.id)} title="View Details" className="hover:text-amber-500 transition cursor-pointer">
                                <Eye className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination controls */}
              <div className="flex items-center justify-between border-t border-gray-800 pt-4 text-xs">
                <span className="text-gray-500">Page {page} of {totalPages}</span>
                <div className="flex gap-2">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                    className="p-1.5 border border-gray-800 hover:text-white rounded-lg disabled:opacity-30 cursor-pointer"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    disabled={page === totalPages}
                    onClick={() => setPage(p => p + 1)}
                    className="p-1.5 border border-gray-800 hover:text-white rounded-lg disabled:opacity-30 cursor-pointer"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Detailed Voucher Display Drawer */}
        {selectedVoucher && (
          <div className="glass rounded-xl border border-gray-800 p-6 space-y-6 relative sticky top-24">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h4 className="font-bold text-white text-sm">Voucher Summary</h4>
              <button onClick={() => setSelectedVoucher(null)} className="text-xs text-gray-400 hover:text-white cursor-pointer">Close</button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 text-xs">
                <div>
                  <p className="text-gray-500">Voucher No.</p>
                  <p className="font-semibold text-white font-mono mt-0.5">{selectedVoucher.voucherNumber}</p>
                </div>
                <div>
                  <p className="text-gray-500">Voucher Date</p>
                  <p className="font-semibold text-white mt-0.5">{formatDate(selectedVoucher.date)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 text-xs">
                <div>
                  <p className="text-gray-500">Type</p>
                  <p className="font-semibold text-amber-500 uppercase mt-0.5">{selectedVoucher.type}</p>
                </div>
                <div>
                  <p className="text-gray-500">Party Account</p>
                  <p className="font-semibold text-white mt-0.5">{selectedVoucher.party?.name || 'General Journal'}</p>
                </div>
              </div>

              <div className="border-t border-b border-gray-800/60 py-3.5 space-y-2">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Ledger Breakdowns</p>
                {selectedVoucher.lines?.map((line, idx) => (
                  <div key={line.id || idx} className="flex justify-between items-center text-xs">
                    <div>
                      <span className={`text-[9px] font-bold px-1 py-0.5 rounded mr-1.5 ${
                        line.type === 'DEBIT' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-amber-500/10 text-amber-400'
                      }`}>{line.type === 'DEBIT' ? 'Dr' : 'Cr'}</span>
                      <span className="text-gray-300">{line.ledger?.name}</span>
                    </div>
                    <span className="font-mono text-white font-semibold">{formatRupees(line.amount)}</span>
                  </div>
                ))}
              </div>

              {selectedVoucher.narration && (
                <div className="text-xs">
                  <p className="text-gray-500">Narration / Note</p>
                  <p className="text-gray-300 mt-1 italic">"{selectedVoucher.narration}"</p>
                </div>
              )}
            </div>

            <div className="border-t border-gray-800 pt-4 space-y-2">
              {MANUAL_TYPES.includes(selectedVoucher.type) && (
                <button
                  onClick={() => navigate(`/vouchers/${selectedVoucher.id}/edit`)}
                  className="w-full flex items-center justify-center gap-1.5 bg-amber-500/10 hover:bg-amber-500 text-amber-500 hover:text-[#0a0e1a] font-semibold py-2.5 rounded-lg text-xs transition cursor-pointer"
                >
                  <Edit2 className="h-4 w-4" /> Edit Voucher
                </button>
              )}
              <button
                onClick={() => {
                  if (window.confirm('Are you sure you want to cancel this voucher transaction?')) {
                    deleteVoucherMut.mutate(selectedVoucher.id);
                  }
                }}
                disabled={deleteVoucherMut.isPending}
                className="w-full flex items-center justify-center gap-1.5 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-[#0a0e1a] font-semibold py-2.5 rounded-lg text-xs transition cursor-pointer"
              >
                <Trash2 className="h-4 w-4" /> Cancel Voucher Transaction
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
