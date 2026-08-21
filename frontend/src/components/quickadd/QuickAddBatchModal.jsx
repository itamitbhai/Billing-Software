import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tallyApi } from '../../api/tally.api';
import { toast } from 'sonner';

const emptyForm = () => ({ batchNumber: '', expiryDate: '', mrp: '', currentQty: '0' });

// Compact "register a new batch on the spot" modal — used from Purchase/Sale
// line items so a brand-new batch number can be registered without leaving the bill.
export default function QuickAddBatchModal({ open, onClose, productId, productName, stacked = true, onCreated }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm());

  React.useEffect(() => {
    if (open) setForm(emptyForm());
  }, [open, productId]);

  const createMut = useMutation({
    mutationFn: tallyApi.batches.create,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['batches-all'] });
      queryClient.invalidateQueries({ queryKey: ['stock-items'] });
      toast.success(`Batch "${res.data.batchNumber}" added`);
      onCreated?.(res.data);
      onClose();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error adding batch'),
  });

  if (!open) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.batchNumber.trim()) return toast.error('Batch number is required');
    if (!form.expiryDate) return toast.error('Expiry date is required');
    if (form.mrp === '' || Number(form.mrp) < 0) return toast.error('A valid MRP is required');
    createMut.mutate({
      productId,
      batchNumber: form.batchNumber,
      expiryDate: form.expiryDate,
      mrp: Number(form.mrp),
      currentQty: Number(form.currentQty) || 0,
    });
  };

  return (
    <div className={`fixed inset-0 ${stacked ? 'z-60' : 'z-50'} flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm`}>
      <div className="glass max-w-sm w-full p-6 rounded-xl border border-gray-800">
        <h3 className="text-base font-bold text-white mb-1">Add Batch{productName ? ` — ${productName}` : ''}</h3>
        <p className="text-xs text-gray-500 mb-4">Register a batch here, then use it right away in your form.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Batch Number</label>
            <input autoFocus type="text" required value={form.batchNumber} onChange={e => setForm({ ...form, batchNumber: e.target.value })} placeholder="BA00148A" className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white placeholder-gray-600 outline-none text-sm font-mono" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Expiry Date</label>
              <input type="date" required value={form.expiryDate} onChange={e => setForm({ ...form, expiryDate: e.target.value })} className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white outline-none text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">MRP (₹)</label>
              <input type="number" step="0.01" min="0" required value={form.mrp} onChange={e => setForm({ ...form, mrp: e.target.value })} className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white outline-none text-sm font-mono" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Quantity Received</label>
            <input type="number" min="0" required value={form.currentQty} onChange={e => setForm({ ...form, currentQty: e.target.value })} className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white outline-none text-sm font-mono" />
          </div>
          <div className="flex justify-end gap-3 pt-3">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-800 text-gray-400 hover:text-white rounded-lg text-xs">Cancel</button>
            <button type="submit" disabled={createMut.isPending} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-[#0a0e1a] font-semibold rounded-lg text-xs">Save & Use</button>
          </div>
        </form>
      </div>
    </div>
  );
}
