import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { tallyApi } from '../../api/tally.api';
import { Loader2, ArrowLeft, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatRupees } from '../../utils/format';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function ProfitLossPage() {
  const navigate = useNavigate();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { data: plRes, isLoading } = useQuery({
    queryKey: ['profit-loss', startDate, endDate],
    queryFn: () => tallyApi.reports.profitLoss({ startDate, endDate })
  });

  const pl = plRes?.data || { income: [], expenses: [], totalIncome: '0', totalExpenses: '0', netProfit: '0', isProfit: true };

  // Prepare chart data
  const chartData = [
    { name: 'Income', value: Number(pl.totalIncome) / 100 },
    { name: 'Expenses', value: Number(pl.totalExpenses) / 100 }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="p-2 border border-gray-800 text-gray-400 hover:text-white rounded-lg cursor-pointer">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-white tracking-wide">Profit & Loss A/c</h2>
            <p className="text-gray-400 text-xs mt-1">Trading performance and operational profit summaries</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-[#111827] border border-gray-800 rounded-lg p-2 text-white text-xs outline-none"
          />
          <span className="text-gray-500 text-xs">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-[#111827] border border-gray-800 rounded-lg p-2 text-white text-xs outline-none"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Detailed Statement Table */}
          <div className="lg:col-span-2 glass rounded-xl border border-gray-800 overflow-hidden divide-y divide-gray-800">
            <div className="grid grid-cols-2 divide-x divide-gray-800 text-xs font-bold uppercase tracking-wider text-amber-500 bg-[#111827]/40">
              <div className="p-4">Income Accounts</div>
              <div className="p-4">Expense Accounts</div>
            </div>

            <div className="grid grid-cols-2 divide-x divide-gray-800 text-sm min-h-[300px]">
              {/* Income Column */}
              <div className="p-4 space-y-3">
                {pl.income.map(item => (
                  <div key={item.id} className="flex justify-between items-center text-xs">
                    <span className="text-gray-300">{item.name}</span>
                    <span className="font-mono text-white font-semibold">{formatRupees(item.amount)}</span>
                  </div>
                ))}
                {pl.income.length === 0 && (
                  <p className="text-xs text-gray-500">No income transactions recorded</p>
                )}
              </div>

              {/* Expenses Column */}
              <div className="p-4 space-y-3">
                {pl.expenses.map(item => (
                  <div key={item.id} className="flex justify-between items-center text-xs">
                    <span className="text-gray-300">{item.name}</span>
                    <span className="font-mono text-white font-semibold">{formatRupees(item.amount)}</span>
                  </div>
                ))}
                {pl.expenses.length === 0 && (
                  <p className="text-xs text-gray-500">No expense transactions recorded</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 divide-x divide-gray-800 text-sm font-bold bg-[#111827]/30">
              <div className="p-4 flex justify-between items-center">
                <span>Total Trading Income</span>
                <span className="font-mono text-emerald-400">{formatRupees(pl.totalIncome)}</span>
              </div>
              <div className="p-4 flex justify-between items-center">
                <span>Total Operating Expense</span>
                <span className="font-mono text-red-400">{formatRupees(pl.totalExpenses)}</span>
              </div>
            </div>

            <div className="p-4 flex justify-between items-center bg-amber-500/5 text-sm font-bold border-t border-gray-800">
              <span className="text-white">Net profit transfer to Capital A/c</span>
              <span className={`font-mono text-base ${pl.isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatRupees(pl.netProfit)}
              </span>
            </div>
          </div>

          {/* Quick Chart summary */}
          <div className="glass p-6 rounded-xl border border-gray-800 space-y-6">
            <h4 className="font-bold text-white text-sm flex items-center gap-1.5">
              <TrendingUp className="h-4.5 w-4.5 text-amber-500" />
              Margin Analysis
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
