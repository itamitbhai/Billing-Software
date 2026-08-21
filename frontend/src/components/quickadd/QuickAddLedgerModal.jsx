import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tallyApi } from '../../api/tally.api';
import { toast } from 'sonner';

const emptyForm = () => ({ name: '', groupId: '', openingBalance: '0', openingBalanceType: 'DEBIT' });

// Compact "create Ledger on the spot" modal — used from Vouchers/Banking so a
// missing ledger account doesn't force a trip to Chart of Accounts and back.
export default function QuickAddLedgerModal({ open, onClose, stacked = false, defaultGroupName, onCreated }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm());

  const { data: groupsRes } = useQuery({ queryKey: ['ledger-groups'], queryFn: tallyApi.groups.list, enabled: open });
  const groups = groupsRes?.data || [];

  // Reset once per open — must not depend on `groups` or it'll wipe whatever
  // the user has already typed the instant the groups query resolves.
  React.useEffect(() => {
    if (open) setForm(emptyForm());
  }, [open]);

  // Once groups load, quietly fill in the default group if the user hasn't
  // already picked one — never touches the rest of the form.
  React.useEffect(() => {
    if (!open || !defaultGroupName) return;
    const preselected = groups.find(g => g.name === defaultGroupName);
    if (preselected) setForm(f => (f.groupId ? f : { ...f, groupId: preselected.id }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultGroupName, groupsRes]);

  const createMut = useMutation({
    mutationFn: tallyApi.ledgers.create,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['ledgers'] });
      toast.success(`Ledger "${res.data.name}" added`);
      onCreated?.(res.data);
      onClose();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error creating ledger'),
  });

  if (!open) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Ledger name is required');
    if (!form.groupId) return toast.error('Please select a group');
    createMut.mutate({
      ...form,
      openingBalance: Number(form.openingBalance || 0) * 100, // rupees -> paise
    });
  };

  return (
    <div className={`fixed inset-0 ${stacked ? 'z-60' : 'z-50'} flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm`}>
      <div className="glass max-w-sm w-full p-6 rounded-xl border border-gray-800">
        <h3 className="text-base font-bold text-white mb-1">Add New Ledger</h3>
        <p className="text-xs text-gray-500 mb-4">Create it here — you'll be sent right back to your form.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Ledger Name</label>
            <input autoFocus type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="E.g., Freight Charges" className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white placeholder-gray-600 outline-none text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Under Group</label>
            <select required value={form.groupId} onChange={e => setForm({ ...form, groupId: e.target.value })} className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white outline-none text-sm">
              <option value="">Select group...</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.name} ({g.nature})</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Opening Balance (₹)</label>
              <input type="number" step="0.01" value={form.openingBalance} onChange={e => setForm({ ...form, openingBalance: e.target.value })} className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white outline-none text-sm font-mono" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Balance Type</label>
              <select value={form.openingBalanceType} onChange={e => setForm({ ...form, openingBalanceType: e.target.value })} className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white outline-none text-sm">
                <option value="DEBIT">Debit</option>
                <option value="CREDIT">Credit</option>
              </select>
            </div>
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
