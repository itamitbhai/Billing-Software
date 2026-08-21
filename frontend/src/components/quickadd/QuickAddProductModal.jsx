import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tallyApi } from '../../api/tally.api';
import { toast } from 'sonner';

const emptyForm = () => ({ name: '', price: '', unit: 'PCS', hsnCode: '', gstRate: '0' });

// Compact "create Stock Item on the spot" modal — used from Purchase/Sale
// line items so the user never has to leave the bill to register a medicine.
export default function QuickAddProductModal({ open, onClose, stacked = false, onCreated }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm());

  React.useEffect(() => {
    if (open) setForm(emptyForm());
  }, [open]);

  const createMut = useMutation({
    mutationFn: tallyApi.stockItems.create,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['stock-items'] });
      toast.success(`"${res.data.name}" added to stock items`);
      onCreated?.(res.data);
      onClose();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error creating item'),
  });

  if (!open) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Item name is required');
    if (form.price === '' || Number(form.price) < 0) return toast.error('A valid retail price is required');
    createMut.mutate({ ...form, price: Number(form.price), gstRate: Number(form.gstRate) });
  };

  return (
    <div className={`fixed inset-0 ${stacked ? 'z-60' : 'z-50'} flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm`}>
      <div className="glass max-w-sm w-full p-6 rounded-xl border border-gray-800">
        <h3 className="text-base font-bold text-white mb-1">Add New Stock Item</h3>
        <p className="text-xs text-gray-500 mb-4">Create it here — you'll be sent right back to your form.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Item Name</label>
            <input autoFocus type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="E.g., Acetaminophen 500mg" className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white placeholder-gray-600 outline-none text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Retail Price (₹)</label>
              <input type="number" step="0.01" min="0" required value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="85.00" className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white placeholder-gray-600 outline-none text-sm font-mono" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Unit</label>
              <input type="text" required value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="STRIP / INJ / PCS" className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white placeholder-gray-600 outline-none text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">HSN Code</label>
              <input type="text" value={form.hsnCode} onChange={e => setForm({ ...form, hsnCode: e.target.value })} placeholder="3004" className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white placeholder-gray-600 outline-none text-sm font-mono" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">GST Rate (%)</label>
              <input type="number" step="0.01" min="0" value={form.gstRate} onChange={e => setForm({ ...form, gstRate: e.target.value })} placeholder="5" className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white outline-none text-sm font-mono" />
            </div>
          </div>
          <p className="text-[10px] text-gray-500">This item won't have any stock yet — you'll be prompted to add its first batch next.</p>
          <div className="flex justify-end gap-3 pt-3">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-800 text-gray-400 hover:text-white rounded-lg text-xs">Cancel</button>
            <button type="submit" disabled={createMut.isPending} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-[#0a0e1a] font-semibold rounded-lg text-xs">Save & Use</button>
          </div>
        </form>
      </div>
    </div>
  );
}
