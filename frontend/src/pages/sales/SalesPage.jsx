import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tallyApi } from '../../api/tally.api';
import { Plus, ChevronLeft, ChevronRight, Loader2, Printer, FileText, IndianRupee, Eye } from 'lucide-react';
import { formatDate, formatCurrency } from '../../utils/format';
import { toast } from 'sonner';

const STATUS_STYLES = {
  PAID: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  PARTIALLY_PAID: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  UNPAID: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
};

const PAYMENT_METHODS = ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'RAZORPAY'];

export default function SalesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [paymentSale, setPaymentSale] = useState(null);
  const [paymentForm, setPaymentForm] = useState({ amount: '', method: 'CASH', paymentDate: new Date().toISOString().split('T')[0], referenceNumber: '' });

  const { data: salesRes, isLoading } = useQuery({
    queryKey: ['sales', page, status],
    queryFn: () => tallyApi.billing.sales.list({ page, limit: 15, status: status || undefined }),
  });

  const sales = salesRes?.data || [];
  const totalPages = salesRes?.totalPages || 1;

  const recordPaymentMut = useMutation({
    mutationFn: tallyApi.billing.payments.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      toast.success('Payment recorded against invoice');
      setPaymentSale(null);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error recording payment'),
  });

  const openPaymentModal = (sale) => {
    setPaymentSale(sale);
    setPaymentForm({ amount: String(sale.totalAmount), method: 'CASH', paymentDate: new Date().toISOString().split('T')[0], referenceNumber: '' });
  };

  const handleRecordPayment = (e) => {
    e.preventDefault();
    recordPaymentMut.mutate({
      partyId: paymentSale.customerId,
      saleId: paymentSale.id,
      amount: Number(paymentForm.amount),
      method: paymentForm.method,
      paymentDate: paymentForm.paymentDate,
      referenceNumber: paymentForm.referenceNumber || undefined,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">Sales & GST Bills</h2>
          <p className="text-gray-400 text-xs mt-1">Create GST tax invoices for medicine sales and print them for dispatch</p>
        </div>
        <button
          onClick={() => navigate('/sales/new')}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-[#0a0e1a] font-semibold rounded-lg text-sm transition cursor-pointer"
        >
          <Plus className="h-4.5 w-4.5" />
          New Sale Invoice
        </button>
      </div>

      {/* Filters row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-[#111827]/40 p-4 rounded-xl border border-gray-800">
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Payment Status</label>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2 text-white outline-none text-xs"
          >
            <option value="">All Invoices</option>
            <option value="UNPAID">Unpaid</option>
            <option value="PARTIALLY_PAID">Partially Paid</option>
            <option value="PAID">Paid</option>
          </select>
        </div>
      </div>

      <div className="glass rounded-xl border border-gray-800 p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading invoices...
          </div>
        ) : sales.length === 0 ? (
          <div className="text-center py-20 text-gray-500 text-sm">
            <FileText className="h-8 w-8 mx-auto mb-3 text-gray-700" />
            No sale invoices yet. Create your first GST bill to sell medicine.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-gray-400 font-bold uppercase border-b border-gray-800 pb-3">
                    <th className="pb-3">Invoice No.</th>
                    <th className="pb-3">Date</th>
                    <th className="pb-3">Customer</th>
                    <th className="pb-3 text-right">Taxable Value</th>
                    <th className="pb-3 text-right">GST</th>
                    <th className="pb-3 text-right">Total</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/40 text-sm">
                  {sales.map((s) => (
                    <tr key={s.id} className="hover:bg-[#111827]/20">
                      <td className="py-3 font-semibold text-white font-mono">{s.invoiceNumber}</td>
                      <td className="py-3 text-gray-400">{formatDate(s.saleDate)}</td>
                      <td className="py-3 text-gray-300 font-medium">{s.customer?.name || '-'}</td>
                      <td className="py-3 text-right font-mono text-gray-300">₹{formatCurrency(s.subTotal)}</td>
                      <td className="py-3 text-right font-mono text-gray-300">₹{formatCurrency(s.gstAmount)}</td>
                      <td className="py-3 text-right font-mono font-semibold text-white">₹{formatCurrency(s.totalAmount)}</td>
                      <td className="py-3">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${STATUS_STYLES[s.status] || STATUS_STYLES.UNPAID}`}>
                          {s.status?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-3 text-gray-400">
                          {s.status !== 'PAID' && (
                            <button
                              onClick={() => openPaymentModal(s)}
                              title="Record Payment"
                              className="hover:text-emerald-400 transition cursor-pointer"
                            >
                              <IndianRupee className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => navigate(`/sales/${s.id}/invoice`)}
                            title="View Invoice"
                            className="hover:text-sky-400 transition cursor-pointer"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => window.open(`/sales/${s.id}/invoice`, '_blank')}
                            title="Print GST Invoice"
                            className="hover:text-amber-500 transition cursor-pointer"
                          >
                            <Printer className="h-4 w-4" />
                          </button>
                        </div>
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

      {/* ── Record Payment Modal ── */}
      {paymentSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass max-w-sm w-full p-6 rounded-xl border border-gray-800">
            <h3 className="text-base font-bold text-white mb-1">Record Payment</h3>
            <p className="text-xs text-gray-500 mb-4">Against invoice <span className="font-mono text-gray-300">{paymentSale.invoiceNumber}</span> · {paymentSale.customer?.name}</p>
            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Amount Received (₹)</label>
                <input type="number" step="0.01" min="0" required value={paymentForm.amount} onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })} className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white outline-none text-sm font-mono" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Method</label>
                  <select value={paymentForm.method} onChange={e => setPaymentForm({ ...paymentForm, method: e.target.value })} className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white outline-none text-sm">
                    {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Date</label>
                  <input type="date" required value={paymentForm.paymentDate} onChange={e => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })} className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white outline-none text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Reference No. (Optional)</label>
                <input type="text" value={paymentForm.referenceNumber} onChange={e => setPaymentForm({ ...paymentForm, referenceNumber: e.target.value })} placeholder="UPI txn ID / cheque no." className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white placeholder-gray-600 outline-none text-sm" />
              </div>
              <div className="flex justify-end gap-3 pt-3">
                <button type="button" onClick={() => setPaymentSale(null)} className="px-4 py-2 border border-gray-800 text-gray-400 hover:text-white rounded-lg text-xs">Cancel</button>
                <button type="submit" disabled={recordPaymentMut.isPending} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-[#0a0e1a] font-semibold rounded-lg text-xs">Save Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
