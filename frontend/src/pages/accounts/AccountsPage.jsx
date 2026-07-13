import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tallyApi } from '../../api/tally.api';
import { FolderTree, Plus, Trash2, Edit2, Loader2, Folder, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { formatRupees } from '../../utils/format';

export default function AccountsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('groups');
  const [editingItem, setEditingItem] = useState(null);
  
  // Group creation modal state
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupFormData, setGroupFormData] = useState({ name: '', nature: 'ASSET', parentId: '' });

  // Ledger creation modal state
  const [ledgerModalOpen, setLedgerModalOpen] = useState(false);
  const [ledgerFormData, setLedgerFormData] = useState({ name: '', groupId: '', openingBalance: '0', openingBalanceType: 'DEBIT', description: '' });

  // ── Queries ───────────────────────────────────────────────────
  const { data: groupsRes, isLoading: groupsLoading } = useQuery({
    queryKey: ['ledger-groups'],
    queryFn: tallyApi.groups.list
  });

  const { data: ledgersRes, isLoading: ledgersLoading } = useQuery({
    queryKey: ['ledgers'],
    queryFn: () => tallyApi.ledgers.list()
  });

  const groups = groupsRes?.data || [];
  const ledgers = ledgersRes?.data || [];

  // ── Mutations ─────────────────────────────────────────────────
  const createGroupMutation = useMutation({
    mutationFn: tallyApi.groups.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ledger-groups'] });
      toast.success('Ledger Group created');
      setGroupModalOpen(false);
      setGroupFormData({ name: '', nature: 'ASSET', parentId: '' });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error creating group')
  });

  const updateGroupMutation = useMutation({
    mutationFn: ({ id, data }) => tallyApi.groups.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ledger-groups'] });
      toast.success('Ledger Group updated');
      setEditingItem(null);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error updating group')
  });

  const deleteGroupMutation = useMutation({
    mutationFn: tallyApi.groups.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ledger-groups'] });
      toast.success('Ledger Group deleted');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error deleting group')
  });

  const createLedgerMutation = useMutation({
    mutationFn: tallyApi.ledgers.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ledgers'] });
      toast.success('Ledger created successfully');
      setLedgerModalOpen(false);
      setLedgerFormData({ name: '', groupId: '', openingBalance: '0', openingBalanceType: 'DEBIT', description: '' });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error creating ledger')
  });

  const deleteLedgerMutation = useMutation({
    mutationFn: tallyApi.ledgers.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ledgers'] });
      toast.success('Ledger deleted');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error deleting ledger')
  });

  // ── Handlers ──────────────────────────────────────────────────
  const handleGroupSubmit = (e) => {
    e.preventDefault();
    if (!groupFormData.name) return toast.error('Group name required');
    createGroupMutation.mutate(groupFormData);
  };

  const handleLedgerSubmit = (e) => {
    e.preventDefault();
    if (!ledgerFormData.name || !ledgerFormData.groupId) {
      return toast.error('Name and Group are required');
    }
    createLedgerMutation.mutate({
      ...ledgerFormData,
      openingBalance: Number(ledgerFormData.openingBalance) * 100 // convert to paise
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">Chart of Accounts</h2>
          <p className="text-gray-400 text-xs mt-1">Configure Ledger Groups hierarchy and General Ledger accounts</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setGroupModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#111827] border border-gray-800 text-gray-300 hover:text-white rounded-lg text-sm transition cursor-pointer"
          >
            <Plus className="h-4 w-4 text-amber-500" />
            Add Group
          </button>
          <button
            onClick={() => setLedgerModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-[#0a0e1a] font-semibold rounded-lg text-sm transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Create Ledger
          </button>
        </div>
      </div>

      {/* Tabs bar */}
      <div className="flex border-b border-gray-800">
        <button
          onClick={() => setActiveTab('groups')}
          className={`px-5 py-3 text-sm font-semibold transition border-b-2 ${
            activeTab === 'groups' ? 'border-amber-500 text-amber-500' : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          Ledger Groups Hierarchy
        </button>
        <button
          onClick={() => setActiveTab('ledgers')}
          className={`px-5 py-3 text-sm font-semibold transition border-b-2 ${
            activeTab === 'ledgers' ? 'border-amber-500 text-amber-500' : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          All Ledger Accounts
        </button>
      </div>

      {/* Active Tab View */}
      {activeTab === 'groups' ? (
        <div className="glass rounded-xl border border-gray-800 p-6">
          {groupsLoading ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading Groups...
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 text-xs font-bold text-gray-400 uppercase border-b border-gray-800 pb-3">
                <div>Group Name</div>
                <div>Nature</div>
                <div className="text-right">Actions</div>
              </div>
              <div className="divide-y divide-gray-800/40">
                {groups.map((group) => (
                  <div key={group.id} className="grid grid-cols-3 py-3 items-center text-sm">
                    <div className="flex items-center gap-2">
                      <Folder className="h-4 w-4 text-amber-500" />
                      <span className="font-medium text-white">{group.name}</span>
                    </div>
                    <div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-400 uppercase">
                        {group.nature}
                      </span>
                    </div>
                    <div className="flex items-center justify-end gap-3 text-gray-400">
                      {!group.isSystem && (
                        <button
                          onClick={() => deleteGroupMutation.mutate(group.id)}
                          className="hover:text-red-400 transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                      {group.isSystem && (
                        <span className="text-[10px] font-semibold text-gray-600 bg-gray-800/30 px-1.5 py-0.5 rounded">System</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="glass rounded-xl border border-gray-800 p-6">
          {ledgersLoading ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading Ledgers...
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-4 text-xs font-bold text-gray-400 uppercase border-b border-gray-800 pb-3">
                <div>Ledger Name</div>
                <div>Under Group</div>
                <div className="text-right">Opening Balance</div>
                <div className="text-right">Actions</div>
              </div>
              <div className="divide-y divide-gray-800/40">
                {ledgers.map((ledger) => (
                  <div key={ledger.id} className="grid grid-cols-4 py-3 items-center text-sm">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-400" />
                      <span className="font-medium text-white">{ledger.name}</span>
                    </div>
                    <div className="text-gray-400">{ledger.group?.name || '-'}</div>
                    <div className="text-right font-mono">
                      {formatRupees(ledger.openingBalance)}
                      <span className="text-[10px] text-gray-500 ml-1 uppercase">{ledger.openingBalanceType}</span>
                    </div>
                    <div className="flex items-center justify-end gap-3 text-gray-400">
                      {!ledger.isSystem && (
                        <button
                          onClick={() => deleteLedgerMutation.mutate(ledger.id)}
                          className="hover:text-red-400 transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                      {ledger.isSystem && (
                        <span className="text-[10px] font-semibold text-gray-600 bg-gray-800/30 px-1.5 py-0.5 rounded">System</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Group Modal ── */}
      {groupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass max-w-md w-full p-6 rounded-xl border border-gray-800">
            <h3 className="text-base font-bold text-white mb-4">Add Ledger Group</h3>
            <form onSubmit={handleGroupSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Group Name</label>
                <input
                  type="text"
                  required
                  value={groupFormData.name}
                  onChange={(e) => setGroupFormData({ ...groupFormData, name: e.target.value })}
                  placeholder="E.g., Secured Loans"
                  className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white placeholder-gray-600 outline-none text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Nature</label>
                  <select
                    value={groupFormData.nature}
                    onChange={(e) => setGroupFormData({ ...groupFormData, nature: e.target.value })}
                    className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white outline-none text-sm"
                  >
                    <option value="ASSET">ASSET</option>
                    <option value="LIABILITY">LIABILITY</option>
                    <option value="EQUITY">EQUITY</option>
                    <option value="INCOME">INCOME</option>
                    <option value="EXPENSE">EXPENSE</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Parent Group (Optional)</label>
                  <select
                    value={groupFormData.parentId}
                    onChange={(e) => setGroupFormData({ ...groupFormData, parentId: e.target.value })}
                    className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white outline-none text-sm"
                  >
                    <option value="">None (Root Group)</option>
                    {groups.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setGroupModalOpen(false)}
                  className="px-4 py-2 border border-gray-800 text-gray-400 hover:text-white rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createGroupMutation.isPending}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-[#0a0e1a] font-semibold rounded-lg text-xs"
                >
                  Create Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Ledger Modal ── */}
      {ledgerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass max-w-md w-full p-6 rounded-xl border border-gray-800">
            <h3 className="text-base font-bold text-white mb-4">Create Ledger Account</h3>
            <form onSubmit={handleLedgerSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Ledger Name</label>
                <input
                  type="text"
                  required
                  value={ledgerFormData.name}
                  onChange={(e) => setLedgerFormData({ ...ledgerFormData, name: e.target.value })}
                  placeholder="E.g., SBI Current Account"
                  className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white placeholder-gray-600 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Under Group</label>
                <select
                  value={ledgerFormData.groupId}
                  required
                  onChange={(e) => setLedgerFormData({ ...ledgerFormData, groupId: e.target.value })}
                  className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white outline-none text-sm"
                >
                  <option value="">Select Group...</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name} ({g.nature})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Opening Balance (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={ledgerFormData.openingBalance}
                    onChange={(e) => setLedgerFormData({ ...ledgerFormData, openingBalance: e.target.value })}
                    className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white outline-none text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Balance Type</label>
                  <select
                    value={ledgerFormData.openingBalanceType}
                    onChange={(e) => setLedgerFormData({ ...ledgerFormData, openingBalanceType: e.target.value })}
                    className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white outline-none text-sm"
                  >
                    <option value="DEBIT">DEBIT (Dr)</option>
                    <option value="CREDIT">CREDIT (Cr)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Description (Optional)</label>
                <textarea
                  value={ledgerFormData.description}
                  onChange={(e) => setLedgerFormData({ ...ledgerFormData, description: e.target.value })}
                  rows={2}
                  className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white placeholder-gray-600 outline-none text-sm"
                />
              </div>
              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setLedgerModalOpen(false)}
                  className="px-4 py-2 border border-gray-800 text-gray-400 hover:text-white rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLedgerMutation.isPending}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-[#0a0e1a] font-semibold rounded-lg text-xs"
                >
                  Create Ledger
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
