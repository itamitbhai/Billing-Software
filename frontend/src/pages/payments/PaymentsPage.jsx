import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tallyApi } from '../../api/tally.api';
import { Plus, ChevronLeft, ChevronRight, Loader2, Wallet } from 'lucide-react';
import { formatDate, formatCurrency } from '../../utils/format';
import { toast } from 'sonner';

const PAYMENT_METHODS = ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'RAZORPAY'];

const emptyForm = () => ({
  partyId: '', saleId: '', amount: '', method: 'CASH',
  paymentDate: new Date().toISOString().split('T')[0], referenceNumber: '', notes: ''
});

export default function PaymentsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());

  // ── Queries ───────────────────────────────────────────────────
  const { data: paymentsRes, isLoading } = useQuery({
    queryKey: ['payments', page],
    queryFn: () => tallyApi.billing.payments.list({ page, limit: 15 }),
  });
  const { data: partiesRes } = useQuery({ queryKey: ['parties'], queryFn: () => tallyApi.parties.list(), enabled: modalOpen });
  const { data: salesRes } = useQuery({
    queryKey: ['sales-for-payment'],
    queryFn: () => tallyApi.billing.sales.list({ limit: 100 }),
    enabled: modalOpen,
  });

  const payments = paymentsRes?.data || [];
  const totalPages = paymentsRes?.totalPages || 1;
  const parties = partiesRes?.data || [];
  const allSales = salesRes?.data || [];

  const selectedParty = parties.find(p => p.id === form.partyId);
  const isReceipt = selectedParty && (selectedParty.type === 'CUSTOMER' || selectedParty.type === 'BOTH');
  const openInvoices = useMemo(
    () => allSales.filter(s => s.customerId === form.partyId && s.status !== 'PAID'),
    [allSales, form.partyId]
  );

  // ── Mutations ─────────────────────────────────────────────────
  const createPaymentMut = useMutation({
    mutationFn: tallyApi.billing.payments.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      toast.success('Payment recorded successfully');
      setModalOpen(false);
      setForm(emptyForm());
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error recording payment'),
  });

  // ── Handlers ──────────────────────────────────────────────────
  const handlePartyChange = (partyId) => {
    setForm({ ...form, partyId, saleId: '' });
  };

  const handleInvoiceChange = (saleId) => {
    const sale = allSales.find(s => s.id === saleId);
    setForm({ ...form, saleId, amount: sale ? String(sale.totalAmount) : form.amount });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.partyId) return toast.error('Please select a party.');
    if (!form.amount || Number(form.amount) <= 0) return toast.error('Please enter a valid amount.');

    createPaymentMut.mutate({
      partyId: form.partyId,
      saleId: form.saleId || undefined,
      amount: Number(form.amount),
      method: form.method,
      paymentDate: form.paymentDate,
      referenceNumber: form.referenceNumber || undefined,
      notes: form.notes || undefined,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">Payments & Receipts</h2>
          <p className="text-gray-400 text-xs mt-1">Record money paid to suppliers or received from customers, optionally applied to an invoice</p>
        </div>
        <button
          onClick={() => { setForm(emptyForm()); setModalOpen(true); }}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-[#0a0e1a] font-semibold rounded-lg text-sm transition cursor-pointer"
        >
          <Plus className="h-4.5 w-4.5" />
          Record Payment / Receipt
        </button>
      </div>

      <div className="glass rounded-xl border border-gray-800 p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading payments...
          </div>
        ) : payments.length === 0 ? (
          <div className="text-center py-20 text-gray-500 text-sm">
            <Wallet className="h-8 w-8 mx-auto mb-3 text-gray-700" />
            No payments recorded yet.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-gray-400 font-bold uppercase border-b border-gray-800 pb-3">
                    <th className="pb-3">Date</th>
                    <th className="pb-3">Party</th>
                    <th className="pb-3">Method</th>
                    <th className="pb-3">Reference</th>
                    <th className="pb-3">Linked Invoice</th>
                    <th className="pb-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/40 text-sm">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-[#111827]/20">
                      <td className="py-3 text-gray-400">{formatDate(p.paymentDate)}</td>
                      <td className="py-3">
                        <span className="text-gray-300 font-medium">{p.party?.name || '-'}</span>
                        <span className={`ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          p.party?.type === 'CUSTOMER' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                        }`}>{p.party?.type === 'SUPPLIER' ? 'PAYMENT' : 'RECEIPT'}</span>
                      </td>
                      <td className="py-3 text-gray-400">{p.method?.replace('_', ' ')}</td>
                      <td className="py-3 text-gray-400 font-mono">{p.referenceNumber || '-'}</td>
                      <td className="py-3 text-gray-400 font-mono">{p.sale?.invoiceNumber || '-'}</td>
                      <td className="py-3 text-right font-mono font-semibold text-white">₹{formatCurrency(p.amount)}</td>
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
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass max-w-sm w-full p-6 rounded-xl border border-gray-800">
            <h3 className="text-base font-bold text-white mb-1">Record Payment / Receipt</h3>
            <p className="text-xs text-gray-500 mb-4">
              {selectedParty ? (isReceipt ? 'Money received from a customer.' : 'Money paid to a supplier.') : 'Select a party to continue.'}
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Party</label>
                <select required value={form.partyId} onChange={e => handlePartyChange(e.target.value)} className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white outline-none text-sm">
                  <option value="">Select party...</option>
                  {parties.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
                  ))}
                </select>
              </div>

              {isReceipt && (
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Apply to Invoice (Optional)</label>
                  <select value={form.saleId} onChange={e => handleInvoiceChange(e.target.value)} className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white outline-none text-sm">
                    <option value="">None / Advance receipt</option>
                    {openInvoices.map(s => (
                      <option key={s.id} value={s.id}>{s.invoiceNumber} · ₹{formatCurrency(s.totalAmount)} · {s.status.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Amount (₹)</label>
                <input type="number" step="0.01" min="0" required value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white outline-none text-sm font-mono" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Method</label>
                  <select value={form.method} onChange={e => setForm({ ...form, method: e.target.value })} className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white outline-none text-sm">
                    {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Date</label>
                  <input type="date" required value={form.paymentDate} onChange={e => setForm({ ...form, paymentDate: e.target.value })} className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white outline-none text-sm" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Reference No. (Optional)</label>
                <input type="text" value={form.referenceNumber} onChange={e => setForm({ ...form, referenceNumber: e.target.value })} placeholder="UPI txn ID / cheque no." className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white placeholder-gray-600 outline-none text-sm" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Notes (Optional)</label>
                <textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white outline-none text-sm" />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 border border-gray-800 text-gray-400 hover:text-white rounded-lg text-xs">Cancel</button>
                <button type="submit" disabled={createPaymentMut.isPending} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-[#0a0e1a] font-semibold rounded-lg text-xs">Save Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
