import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { tallyApi } from '../../api/tally.api';
import { Loader2, ArrowLeft, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatRupees } from '../../utils/format';

export default function StockSummaryPage() {
  const navigate = useNavigate();
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
  const [search, setSearch] = useState('');

  const { data: stockRes, isLoading } = useQuery({
    queryKey: ['stock-summary', asOfDate],
    queryFn: () => tallyApi.reports.stockSummary({ asOfDate })
  });

  const stockItems = stockRes || [];

  const filteredItems = stockItems.filter(item =>
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="p-2 border border-gray-800 text-gray-400 hover:text-white rounded-lg cursor-pointer">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-white tracking-wide">Stock Summary</h2>
            <p className="text-gray-400 text-xs mt-1">Real-time inventory levels, inflows, outflows, and valuation statements</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search items..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-[#111827] border border-gray-800 rounded-lg pl-9 pr-4 py-2 text-white text-xs outline-none w-48 focus:w-64 transition-all"
            />
          </div>
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
        <div className="glass rounded-xl border border-gray-800 p-6 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-gray-400 font-bold uppercase border-b border-gray-800 pb-3">
                  <th className="pb-3" rowSpan={2}>Item Name</th>
                  <th className="pb-3" rowSpan={2}>Group</th>
                  <th className="pb-3 text-center border-b border-gray-800/40" colSpan={2}>Opening Balance</th>
                  <th className="pb-3 text-center border-b border-gray-800/40" colSpan={2}>Inwards (Purchases)</th>
                  <th className="pb-3 text-center border-b border-gray-800/40" colSpan={2}>Outwards (Sales)</th>
                  <th className="pb-3 text-center border-b border-gray-800/40" colSpan={2}>Closing Stock</th>
                </tr>
                <tr className="text-gray-500 font-semibold border-b border-gray-800">
                  <th className="py-2 text-right">Qty</th>
                  <th className="py-2 text-right">Value</th>
                  <th className="py-2 text-right">Qty</th>
                  <th className="py-2 text-right">Value</th>
                  <th className="py-2 text-right">Qty</th>
                  <th className="py-2 text-right">Value</th>
                  <th className="py-2 text-right">Qty</th>
                  <th className="py-2 text-right font-bold text-gray-400">Valuation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/40 text-sm">
                {filteredItems.map(item => (
                  <tr key={item.id} className="hover:bg-[#111827]/10">
                    <td className="py-3 font-semibold text-white">{item.name}</td>
                    <td className="py-3 text-gray-400">{item.group}</td>
                    <td className="py-3 text-right font-mono">{item.openingQty}</td>
                    <td className="py-3 text-right font-mono">{formatRupees(item.openingVal)}</td>
                    <td className="py-3 text-right font-mono text-emerald-500">+{item.inwardQty}</td>
                    <td className="py-3 text-right font-mono text-emerald-500">{formatRupees(item.inwardVal)}</td>
                    <td className="py-3 text-right font-mono text-red-500">-{item.outwardQty}</td>
                    <td className="py-3 text-right font-mono text-red-500">{formatRupees(item.outwardVal)}</td>
                    <td className="py-3 text-right font-mono font-bold text-white">{item.closingQty}</td>
                    <td className="py-3 text-right font-mono font-bold text-amber-500">{formatRupees(item.closingVal)}</td>
                  </tr>
                ))}
                {filteredItems.length === 0 && (
                  <tr>
                    <td className="text-center py-10 text-gray-500" colSpan={10}>No stock items matching criteria</td>
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
