import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { tallyApi } from '../../api/tally.api';
import { Loader2, ArrowLeft, Receipt, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDate, formatRupees } from '../../utils/format';

export default function DayBookPage() {
  const navigate = useNavigate();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const { data: dbRes, isLoading } = useQuery({
    queryKey: ['day-book', date],
    queryFn: () => tallyApi.reports.dayBook({ date })
  });

  const daybook = dbRes?.data || { vouchers: [], totalDebit: '0', voucherCount: 0 };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="p-2 border border-gray-800 text-gray-400 hover:text-white rounded-lg cursor-pointer">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-white tracking-wide">Day Book</h2>
            <p className="text-gray-400 text-xs mt-1">Audit listing of all voucher transactions posted on a selected date</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Calendar className="h-4 w-4 text-amber-500" />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-[#111827] border border-gray-800 rounded-lg p-2 text-white text-xs outline-none"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : (
        <div className="glass rounded-xl border border-gray-800 p-6 overflow-hidden space-y-6">
          <div className="flex justify-between items-center bg-[#111827]/40 p-4 rounded-lg border border-gray-800/60 text-xs">
            <div className="flex gap-8">
              <div>
                <span className="text-gray-500 block">Vouchers Count</span>
                <span className="text-sm font-bold text-white mt-0.5">{daybook.voucherCount} Entries</span>
              </div>
              <div>
                <span className="text-gray-500 block">Cumulative Turnovers</span>
                <span className="text-sm font-bold text-amber-500 mt-0.5">{formatRupees(daybook.totalDebit)}</span>
              </div>
            </div>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Double Balanced</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-gray-400 font-bold uppercase border-b border-gray-800 pb-3">
                  <th className="pb-3">Vch No.</th>
                  <th className="pb-3">Type</th>
                  <th className="pb-3">Particulars / Details</th>
                  <th className="pb-3 text-right">Debit (₹)</th>
                  <th className="pb-3 text-right">Credit (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/40 text-sm">
                {daybook.vouchers.map((v) => {
                  const amt = v.lines
                    .filter(l => l.type === 'DEBIT')
                    .reduce((sum, l) => sum + BigInt(l.amount), 0n);

                  return (
                    <tr key={v.id} className="hover:bg-[#111827]/10">
                      <td className="py-3 font-semibold text-white font-mono">{v.voucherNumber}</td>
                      <td className="py-3">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 text-amber-500">
                          {v.type}
                        </span>
                      </td>
                      <td className="py-3 text-gray-300">
                        {v.party?.name || 'Journal Adjustment'}
                        {v.narration && <span className="text-xs text-gray-500 block italic mt-0.5">"{v.narration}"</span>}
                      </td>
                      <td className="py-3 text-right font-mono font-semibold text-white">{formatRupees(amt)}</td>
                      <td className="py-3 text-right font-mono font-semibold text-white">{formatRupees(amt)}</td>
                    </tr>
                  );
                })}
                {daybook.vouchers.length === 0 && (
                  <tr>
                    <td className="text-center py-10 text-gray-500" colSpan={5}>No voucher entries logged on this date</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
