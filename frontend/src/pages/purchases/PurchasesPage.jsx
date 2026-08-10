import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { tallyApi } from '../../api/tally.api';
import { Plus, ChevronLeft, ChevronRight, Loader2, PackageSearch } from 'lucide-react';
import { formatDate, formatCurrency } from '../../utils/format';

export default function PurchasesPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);

  const { data: purchasesRes, isLoading } = useQuery({
    queryKey: ['purchases', page],
    queryFn: () => tallyApi.billing.purchases.list({ page, limit: 15 }),
  });

  const purchases = purchasesRes?.data || [];
  const totalPages = purchasesRes?.totalPages || 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">Purchases (Stock IN)</h2>
          <p className="text-gray-400 text-xs mt-1">Record supplier bills — stock batches increment and Input GST posts automatically</p>
        </div>
        <button
          onClick={() => navigate('/purchases/new')}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-[#0a0e1a] font-semibold rounded-lg text-sm transition cursor-pointer"
        >
          <Plus className="h-4.5 w-4.5" />
          New Purchase Bill
        </button>
      </div>

      <div className="glass rounded-xl border border-gray-800 p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading purchases...
          </div>
        ) : purchases.length === 0 ? (
          <div className="text-center py-20 text-gray-500 text-sm">
            <PackageSearch className="h-8 w-8 mx-auto mb-3 text-gray-700" />
            No purchase bills yet. Record your first supplier bill to receive stock.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-gray-400 font-bold uppercase border-b border-gray-800 pb-3">
                    <th className="pb-3">Bill No.</th>
                    <th className="pb-3">Date</th>
                    <th className="pb-3">Supplier</th>
                    <th className="pb-3 text-right">Taxable Value</th>
                    <th className="pb-3 text-right">GST</th>
                    <th className="pb-3 text-right">Total</th>
                    <th className="pb-3">Reverse Charge</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/40 text-sm">
                  {purchases.map((p) => (
                    <tr key={p.id} className="hover:bg-[#111827]/20">
                      <td className="py-3 font-semibold text-white font-mono">{p.billNumber}</td>
                      <td className="py-3 text-gray-400">{formatDate(p.purchaseDate)}</td>
                      <td className="py-3 text-gray-300 font-medium">{p.supplier?.name || '-'}</td>
                      <td className="py-3 text-right font-mono text-gray-300">₹{formatCurrency(p.subTotal)}</td>
                      <td className="py-3 text-right font-mono text-gray-300">₹{formatCurrency(p.gstAmount)}</td>
                      <td className="py-3 text-right font-mono font-semibold text-white">₹{formatCurrency(p.totalAmount)}</td>
                      <td className="py-3">
                        {p.reverseCharge ? (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold border bg-amber-500/10 text-amber-400 border-amber-500/20">RCM</span>
                        ) : (
                          <span className="text-gray-600">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
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
    </div>
  );
}
