import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { tallyApi } from '../../api/tally.api';
import { Loader2, ArrowLeft, BarChart3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatRupees } from '../../utils/format';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function BalanceSheetPage() {
  const navigate = useNavigate();
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);

  const { data: bsRes, isLoading } = useQuery({
    queryKey: ['balance-sheet', asOfDate],
    queryFn: () => tallyApi.reports.balanceSheet({ asOfDate })
  });

  const bs = bsRes?.data || { assets: [], liabilities: [], equity: [], totalAssets: '0', totalLiabEq: '0' };

  // Prepare chart data
  const chartData = [
    { name: 'Total Assets', value: Number(bs.totalAssets) / 100 },
    { name: 'Liab & Equity', value: Number(bs.totalLiabEq) / 100 }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="p-2 border border-gray-800 text-gray-400 hover:text-white rounded-lg cursor-pointer">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-white tracking-wide">Balance Sheet</h2>
            <p className="text-gray-400 text-xs mt-1">Capital liabilities vs corporate assets representation</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs text-gray-400 uppercase font-bold">As Of Date</label>
          <input
            type="date"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
            className="bg-[#111827] border border-gray-800 rounded-lg p-2 text-white text-xs outline-none"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Detailed Statement Table (2-column layout) */}
          <div className="lg:col-span-2 glass rounded-xl border border-gray-800 overflow-hidden divide-y divide-gray-800">
            <div className="grid grid-cols-2 divide-x divide-gray-800 text-xs font-bold uppercase tracking-wider text-amber-500 bg-[#111827]/40">
              <div className="p-4">Liabilities & Capital</div>
              <div className="p-4">Assets</div>
            </div>

            <div className="grid grid-cols-2 divide-x divide-gray-800 text-sm min-h-[300px]">
              {/* Liabilities Column */}
              <div className="p-4 space-y-4">
                {/* Equity */}
                {bs.equity.length > 0 && (
                  <div className="space-y-1.5">
                    <h5 className="text-xs font-bold text-gray-500 uppercase">Shareholders Equity</h5>
                    {bs.equity.map(item => (
                      <div key={item.id} className="flex justify-between items-center text-xs">
                        <span className="text-gray-300">{item.name}</span>
                        <span className="font-mono text-white font-semibold">{formatRupees(Math.abs(Number(item.netDr)))}</span>
                      </div>
                    ))}
                  </div>
                )}
                {/* Liabilities */}
                <div className="space-y-1.5">
                  <h5 className="text-xs font-bold text-gray-500 uppercase">Liabilities</h5>
                  {bs.liabilities.map(item => (
                    <div key={item.id} className="flex justify-between items-center text-xs">
                      <span className="text-gray-300">{item.name}</span>
                      <span className="font-mono text-white font-semibold">{formatRupees(Math.abs(Number(item.netDr)))}</span>
                    </div>
                  ))}
                  {bs.liabilities.length === 0 && bs.equity.length === 0 && (
                    <p className="text-xs text-gray-500">No liability entries logged</p>
                  )}
                </div>
              </div>

              {/* Assets Column */}
              <div className="p-4 space-y-4">
                <div className="space-y-1.5">
                  <h5 className="text-xs font-bold text-gray-500 uppercase">Assets</h5>
                  {bs.assets.map(item => (
                    <div key={item.id} className="flex justify-between items-center text-xs">
                      <span className="text-gray-300">{item.name}</span>
                      <span className="font-mono text-white font-semibold">{formatRupees(Number(item.netDr))}</span>
                    </div>
                  ))}
                  {bs.assets.length === 0 && (
                    <p className="text-xs text-gray-500">No asset entries logged</p>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 divide-x divide-gray-800 text-sm font-bold bg-[#111827]/30">
              <div className="p-4 flex justify-between items-center">
                <span>Total Liabilities & Equity</span>
                <span className="font-mono text-amber-500">{formatRupees(bs.totalLiabEq)}</span>
              </div>
              <div className="p-4 flex justify-between items-center">
                <span>Total Assets</span>
                <span className="font-mono text-amber-500">{formatRupees(bs.totalAssets)}</span>
              </div>
            </div>
          </div>

          {/* Quick Chart summary */}
          <div className="glass p-6 rounded-xl border border-gray-800 space-y-6">
            <h4 className="font-bold text-white text-sm flex items-center gap-1.5">
              <BarChart3 className="h-4.5 w-4.5 text-amber-500" />
              Chart Analysis
            </h4>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="name" stroke="#9ca3af" fontSize={10} tickLine={false} />
                  <YAxis stroke="#9ca3af" fontSize={10} tickLine={false} />
                  <Tooltip formatter={(value) => formatRupees(value * 100)} contentStyle={{ backgroundColor: '#111827', border: '1px solid #1f2937' }} />
                  <Bar dataKey="value" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
