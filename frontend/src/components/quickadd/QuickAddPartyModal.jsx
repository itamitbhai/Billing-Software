import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tallyApi } from '../../api/tally.api';
import { toast } from 'sonner';

const emptyForm = (defaultType) => ({ name: '', type: defaultType, gstin: '', phone: '', state: '' });

// Compact "create Party/Customer/Supplier on the spot" modal — used from any
// page with a Party dropdown so the user never has to leave to Masters and back.
export default function QuickAddPartyModal({ open, onClose, defaultType = 'CUSTOMER', stacked = false, onCreated }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(() => emptyForm(defaultType));

  React.useEffect(() => {
    if (open) setForm(emptyForm(defaultType));
  }, [open, defaultType]);

  const createMut = useMutation({
    mutationFn: tallyApi.parties.create,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['parties'] });
      toast.success(`"${res.data.name}" added`);
      onCreated?.(res.data);
      onClose();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error creating party'),
  });

  if (!open) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Name is required');
    createMut.mutate(form);
  };

  return (
    <div className={`fixed inset-0 ${stacked ? 'z-60' : 'z-50'} flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm`}>
      <div className="glass max-w-sm w-full p-6 rounded-xl border border-gray-800">
        <h3 className="text-base font-bold text-white mb-1">Add New Party</h3>
        <p className="text-xs text-gray-500 mb-4">Create it here — you'll be sent right back to your form.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Party Name</label>
            <input autoFocus type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Apex Stores" className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white placeholder-gray-600 outline-none text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Type</label>
            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white outline-none text-sm">
              <option value="CUSTOMER">CUSTOMER (Sundry Debtor)</option>
              <option value="SUPPLIER">SUPPLIER (Sundry Creditor)</option>
              <option value="BOTH">BOTH (Debtor & Creditor)</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">GSTIN (Optional)</label>
              <input type="text" value={form.gstin} onChange={e => setForm({ ...form, gstin: e.target.value })} className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white outline-none text-sm font-mono" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Phone (Optional)</label>
              <input type="text" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white outline-none text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">State (Optional, for GST)</label>
            <input type="text" value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} placeholder="Maharashtra" className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white placeholder-gray-600 outline-none text-sm" />
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
