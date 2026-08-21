import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tallyApi } from '../../api/tally.api';
import { toast } from 'sonner';

const emptyForm = () => ({ name: '', parentId: '' });

// Compact "create Cost Centre on the spot" modal — used from Vouchers so a
// missing department/branch tag doesn't force a trip to Masters and back.
export default function QuickAddCostCentreModal({ open, onClose, stacked = false, onCreated }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm());

  const { data: costCentresRes } = useQuery({ queryKey: ['cost-centres'], queryFn: tallyApi.costCentres.list, enabled: open });
  const costCentres = costCentresRes?.data || [];

  React.useEffect(() => {
    if (open) setForm(emptyForm());
  }, [open]);

  const createMut = useMutation({
    mutationFn: tallyApi.costCentres.create,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['cost-centres'] });
      toast.success(`Cost Centre "${res.data.name}" added`);
      onCreated?.(res.data);
      onClose();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error creating cost centre'),
  });

  if (!open) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Cost centre name is required');
    createMut.mutate(form);
  };

  return (
    <div className={`fixed inset-0 ${stacked ? 'z-60' : 'z-50'} flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm`}>
      <div className="glass max-w-sm w-full p-6 rounded-xl border border-gray-800">
        <h3 className="text-base font-bold text-white mb-1">Add New Cost Centre</h3>
        <p className="text-xs text-gray-500 mb-4">Create it here — you'll be sent right back to your form.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Cost Centre Name</label>
            <input autoFocus type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="E.g., Bariatu Branch" className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white placeholder-gray-600 outline-none text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Parent Cost Centre (Optional)</label>
            <select value={form.parentId} onChange={e => setForm({ ...form, parentId: e.target.value })} className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white outline-none text-sm">
              <option value="">None (Top Level)</option>
              {costCentres.map(cc => (
                <option key={cc.id} value={cc.id}>{cc.name}</option>
              ))}
            </select>
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
