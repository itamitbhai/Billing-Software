import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tallyApi } from '../../api/tally.api';
import { Plus, Trash2, Edit2, Loader2, Users, Package, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '../../utils/format';

export default function MastersPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('parties');

  // Modal States
  const [partyModal, setPartyModal] = useState(false);
  const [editingPartyId, setEditingPartyId] = useState(null);
  const [partyForm, setPartyForm] = useState({ name: '', type: 'CUSTOMER', gstin: '', dlNumber: '', phone: '', email: '', address: '', state: '', creditLimit: '0', creditDays: 0 });
  const [selectedParty, setSelectedParty] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);

  const [itemModal, setItemModal] = useState(false);
  const [editingProductId, setEditingProductId] = useState(null);
  const [itemForm, setItemForm] = useState({ name: '', price: '', unit: 'PCS', hsnCode: '', gstRate: '0', reorderLevel: '0' });

  const [batchModal, setBatchModal] = useState(false);
  const [editingBatchId, setEditingBatchId] = useState(null);
  const [batchForm, setBatchForm] = useState({ batchNumber: '', expiryDate: '', mrp: '', currentQty: '0' });

  const [costCentreModal, setCostCentreModal] = useState(false);
  const [editingCostCentreId, setEditingCostCentreId] = useState(null);
  const [costCentreForm, setCostCentreForm] = useState({ name: '', parentId: '' });

  // ── Queries ───────────────────────────────────────────────────
  const { data: partiesRes, isLoading: partiesLoading } = useQuery({ queryKey: ['parties'], queryFn: () => tallyApi.parties.list() });
  const { data: itemsRes, isLoading: itemsLoading } = useQuery({ queryKey: ['stock-items'], queryFn: tallyApi.stockItems.list });
  const { data: costCentresRes, isLoading: costCentresLoading } = useQuery({ queryKey: ['cost-centres'], queryFn: tallyApi.costCentres.list, enabled: activeTab === 'costCentres' });

  const parties = partiesRes?.data || [];
  const items = itemsRes?.data || [];
  const costCentres = costCentresRes?.data || [];

  // ── Mutations ─────────────────────────────────────────────────
  const createPartyMut = useMutation({
    mutationFn: tallyApi.parties.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parties'] });
      toast.success('Party and backing ledger created');
      setPartyModal(false);
      setPartyForm({ name: '', type: 'CUSTOMER', gstin: '', dlNumber: '', phone: '', email: '', address: '', state: '', creditLimit: '0', creditDays: 0 });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error creating party')
  });

  const deletePartyMut = useMutation({
    mutationFn: tallyApi.parties.delete,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['parties'] }); toast.success('Party deleted'); },
    onError: (err) => toast.error(err.response?.data?.message || 'Error deleting party')
  });

  const updatePartyMut = useMutation({
    mutationFn: ({ id, data }) => tallyApi.parties.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parties'] });
      toast.success('Party updated');
      setPartyModal(false);
      setEditingPartyId(null);
      setPartyForm({ name: '', type: 'CUSTOMER', gstin: '', dlNumber: '', phone: '', email: '', address: '', state: '', creditLimit: '0', creditDays: 0 });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error updating party')
  });

  const createItemMut = useMutation({
    mutationFn: tallyApi.stockItems.create,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['stock-items'] });
      toast.success('Stock Item registered — now add its first batch');
      setItemModal(false);
      setItemForm({ name: '', price: '', unit: 'PCS', hsnCode: '', gstRate: '0', reorderLevel: '0' });
      // Chain straight into Add Batch for the item just created, so the user
      // isn't forced to exit and re-open it from the list.
      const created = res?.data;
      if (created) {
        setSelectedItem(created);
        setEditingBatchId(null);
        setBatchForm({ batchNumber: '', expiryDate: '', mrp: '', currentQty: '0' });
        setBatchModal(true);
      }
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error creating item')
  });

  const deleteItemMut = useMutation({
    mutationFn: tallyApi.stockItems.delete,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['stock-items'] }); toast.success('Item deleted'); },
    onError: (err) => toast.error(err.response?.data?.message || 'Error deleting item')
  });

  const updateItemMut = useMutation({
    mutationFn: ({ id, data }) => tallyApi.stockItems.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-items'] });
      toast.success('Stock Item updated');
      setItemModal(false);
      setEditingProductId(null);
      setItemForm({ name: '', price: '', unit: 'PCS', hsnCode: '', gstRate: '0', reorderLevel: '0' });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error updating item')
  });

  const createBatchMut = useMutation({
    mutationFn: tallyApi.batches.create,
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['stock-items'] });
      toast.success('Batch added to stock');
      setBatchModal(false);
      setBatchForm({ batchNumber: '', expiryDate: '', mrp: '', currentQty: '0' });
      if (selectedItem) {
        const fresh = await tallyApi.stockItems.get(selectedItem.id);
        setSelectedItem(fresh.data);
      }
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error adding batch')
  });

  const updateBatchMut = useMutation({
    mutationFn: ({ id, data }) => tallyApi.batches.update(id, data),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['stock-items'] });
      toast.success('Batch updated');
      setBatchModal(false);
      setEditingBatchId(null);
      setBatchForm({ batchNumber: '', expiryDate: '', mrp: '', currentQty: '0' });
      if (selectedItem) {
        const fresh = await tallyApi.stockItems.get(selectedItem.id);
        setSelectedItem(fresh.data);
      }
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error updating batch')
  });

  const deleteBatchMut = useMutation({
    mutationFn: tallyApi.batches.delete,
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['stock-items'] });
      toast.success('Batch deleted');
      if (selectedItem) {
        const fresh = await tallyApi.stockItems.get(selectedItem.id);
        setSelectedItem(fresh.data);
      }
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error deleting batch')
  });

  const createCostCentreMut = useMutation({
    mutationFn: tallyApi.costCentres.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cost-centres'] });
      toast.success('Cost Centre created');
      setCostCentreModal(false);
      setCostCentreForm({ name: '', parentId: '' });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error creating cost centre')
  });

  const updateCostCentreMut = useMutation({
    mutationFn: ({ id, data }) => tallyApi.costCentres.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cost-centres'] });
      toast.success('Cost Centre updated');
      setCostCentreModal(false);
      setEditingCostCentreId(null);
      setCostCentreForm({ name: '', parentId: '' });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error updating cost centre')
  });

  const deleteCostCentreMut = useMutation({
    mutationFn: tallyApi.costCentres.delete,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['cost-centres'] }); toast.success('Cost Centre deleted'); },
    onError: (err) => toast.error(err.response?.data?.message || 'Error deleting cost centre')
  });

  // ── Handlers ──────────────────────────────────────────────────
  const openPartyModal = (party) => {
    if (party) {
      setEditingPartyId(party.id);
      setPartyForm({
        name: party.name, type: party.type, gstin: party.gstin || '', dlNumber: party.dlNumber || '',
        phone: party.phone || '', email: party.email || '', address: party.address || '', state: party.state || '',
        creditLimit: String(party.creditLimit || '0'), creditDays: party.creditPeriodDays || 0
      });
    } else {
      setEditingPartyId(null);
      setPartyForm({ name: '', type: 'CUSTOMER', gstin: '', dlNumber: '', phone: '', email: '', address: '', state: '', creditLimit: '0', creditDays: 0 });
    }
    setPartyModal(true);
  };

  const openItemModal = (item) => {
    if (item) {
      setEditingProductId(item.id);
      setItemForm({
        name: item.name, price: String(item.price), unit: item.unit || 'PCS',
        hsnCode: item.hsnCode || '', gstRate: String(item.gstRate || '0'), reorderLevel: String(item.reorderLevel || '0')
      });
    } else {
      setEditingProductId(null);
      setItemForm({ name: '', price: '', unit: 'PCS', hsnCode: '', gstRate: '0', reorderLevel: '0' });
    }
    setItemModal(true);
  };

  const openBatchModal = (batch) => {
    if (batch) {
      setEditingBatchId(batch.id);
      setBatchForm({
        batchNumber: batch.batchNumber,
        expiryDate: new Date(batch.expiryDate).toISOString().split('T')[0],
        mrp: String(batch.mrp), currentQty: String(batch.currentQty)
      });
    } else {
      setEditingBatchId(null);
      setBatchForm({ batchNumber: '', expiryDate: '', mrp: '', currentQty: '0' });
    }
    setBatchModal(true);
  };

  const openCostCentreModal = (cc) => {
    if (cc) {
      setEditingCostCentreId(cc.id);
      setCostCentreForm({ name: cc.name, parentId: cc.parentId || '' });
    } else {
      setEditingCostCentreId(null);
      setCostCentreForm({ name: '', parentId: '' });
    }
    setCostCentreModal(true);
  };

  const handlePartySubmit = (e) => {
    e.preventDefault();
    const payload = {
      ...partyForm,
      creditLimit: Number(partyForm.creditLimit), // Party.creditLimit is a plain rupee decimal, not paise
      creditPeriodDays: Number(partyForm.creditDays) || 0
    };
    if (editingPartyId) {
      updatePartyMut.mutate({ id: editingPartyId, data: payload });
    } else {
      createPartyMut.mutate(payload);
    }
  };

  const handleItemSubmit = (e) => {
    e.preventDefault();
    const payload = {
      ...itemForm,
      price: Number(itemForm.price),
      gstRate: Number(itemForm.gstRate),
      reorderLevel: Number(itemForm.reorderLevel)
    };
    if (editingProductId) {
      updateItemMut.mutate({ id: editingProductId, data: payload });
    } else {
      createItemMut.mutate(payload);
    }
  };

  const handleBatchSubmit = (e) => {
    e.preventDefault();
    const payload = {
      productId: selectedItem.id,
      batchNumber: batchForm.batchNumber,
      expiryDate: batchForm.expiryDate,
      mrp: Number(batchForm.mrp),
      currentQty: Number(batchForm.currentQty)
    };
    if (editingBatchId) {
      updateBatchMut.mutate({ id: editingBatchId, data: payload });
    } else {
      createBatchMut.mutate(payload);
    }
  };

  const handleCostCentreSubmit = (e) => {
    e.preventDefault();
    if (!costCentreForm.name) return toast.error('Cost centre name required');
    if (editingCostCentreId) {
      updateCostCentreMut.mutate({ id: editingCostCentreId, data: costCentreForm });
    } else {
      createCostCentreMut.mutate(costCentreForm);
    }
  };

  const openItemDetails = async (item) => {
    try {
      const res = await tallyApi.stockItems.get(item.id);
      setSelectedItem(res.data);
    } catch (err) {
      toast.error('Failed to load item details');
    }
  };

  const subTabs = [
    { id: 'parties', name: 'Parties Contacts', icon: Users },
    { id: 'items', name: 'Stock Items', icon: Package },
    { id: 'costCentres', name: 'Cost Centres', icon: Layers }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">Masters Directory</h2>
          <p className="text-gray-400 text-xs mt-1">Configure customers/suppliers and your medicine catalog with batches, HSN codes, and GST rates</p>
        </div>
        <div>
          {activeTab === 'parties' && (
            <button onClick={() => openPartyModal(null)} className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-[#0a0e1a] font-semibold rounded-lg text-sm transition cursor-pointer">
              <Plus className="h-4 w-4" /> Add Party
            </button>
          )}
          {activeTab === 'items' && (
            <button onClick={() => openItemModal(null)} className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-[#0a0e1a] font-semibold rounded-lg text-sm transition cursor-pointer">
              <Plus className="h-4 w-4" /> Add Stock Item
            </button>
          )}
          {activeTab === 'costCentres' && (
            <button onClick={() => openCostCentreModal(null)} className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-[#0a0e1a] font-semibold rounded-lg text-sm transition cursor-pointer">
              <Plus className="h-4 w-4" /> Add Cost Centre
            </button>
          )}
        </div>
      </div>

      {/* Sub tabs list */}
      <div className="flex flex-wrap gap-2 border-b border-gray-800 pb-px">
        {subTabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wider transition border-b-2 -mb-px ${
                activeTab === tab.id ? 'border-amber-500 text-amber-500' : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.name}
            </button>
          );
        })}
      </div>

      {/* Dynamic Views */}
      <div className="glass rounded-xl border border-gray-800 p-6">
        {activeTab === 'parties' && (
          <div>
            {partiesLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-5 text-xs font-bold text-gray-400 uppercase border-b border-gray-800 pb-3">
                  <div>Name</div>
                  <div>Type</div>
                  <div>GSTIN</div>
                  <div>Phone</div>
                  <div className="text-right">Action</div>
                </div>
                <div className="divide-y divide-gray-800/40">
                  {parties.map(p => (
                    <div key={p.id} className="grid grid-cols-5 py-3 items-center text-sm">
                      <button
                        onClick={() => setSelectedParty(p)}
                        type="button"
                        className="font-semibold text-left text-white hover:text-amber-500 hover:underline transition cursor-pointer"
                      >
                        {p.name}
                      </button>
                      <div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          p.type === 'CUSTOMER' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                        }`}>{p.type}</span>
                      </div>
                      <div className="text-gray-400 font-mono">{p.gstin || '-'}</div>
                      <div className="text-gray-400">{p.phone || '-'}</div>
                      <div className="flex items-center justify-end gap-3 text-gray-400">
                        <button onClick={() => openPartyModal(p)} className="hover:text-amber-500 transition"><Edit2 className="h-4 w-4" /></button>
                        <button onClick={() => deletePartyMut.mutate(p.id)} className="hover:text-red-400 transition"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'items' && (
          <div>
            {itemsLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-5 text-xs font-bold text-gray-400 uppercase border-b border-gray-800 pb-3">
                  <div>Item Name</div>
                  <div>Unit</div>
                  <div className="text-right">Total Available Stock</div>
                  <div className="text-right">Retail Price</div>
                  <div className="text-right">Action</div>
                </div>
                <div className="divide-y divide-gray-800/40">
                  {items.map(item => (
                    <div key={item.id} className="grid grid-cols-5 py-3 items-center text-sm">
                      <button
                        onClick={() => openItemDetails(item)}
                        type="button"
                        className="font-semibold text-left text-white hover:text-amber-500 hover:underline transition cursor-pointer"
                      >
                        {item.name}
                      </button>
                      <div className="text-gray-400 uppercase">{item.unit || 'PCS'}</div>
                      <div className="text-right font-mono">{item.batches?.reduce((sum, b) => sum + b.currentQty, 0) || 0}</div>
                      <div className="text-right font-mono">₹{formatCurrency(item.price)}</div>
                      <div className="flex items-center justify-end gap-3 text-gray-400">
                        <button onClick={() => openItemModal(item)} className="hover:text-amber-500 transition"><Edit2 className="h-4 w-4" /></button>
                        <button onClick={() => deleteItemMut.mutate(item.id)} className="hover:text-red-400 transition"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'costCentres' && (
          <div>
            {costCentresLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
            ) : costCentres.length === 0 ? (
              <div className="text-center py-12 text-gray-500 text-sm">
                <Layers className="h-8 w-8 mx-auto mb-3 text-gray-700" />
                No cost centres yet. Add one to start tagging voucher lines by department/branch.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-3 text-xs font-bold text-gray-400 uppercase border-b border-gray-800 pb-3">
                  <div>Cost Centre Name</div>
                  <div>Parent Cost Centre</div>
                  <div className="text-right">Action</div>
                </div>
                <div className="divide-y divide-gray-800/40">
                  {costCentres.map(cc => (
                    <div key={cc.id} className="grid grid-cols-3 py-3 items-center text-sm">
                      <div className="font-semibold text-white flex items-center gap-2">
                        <Layers className="h-4 w-4 text-amber-500" /> {cc.name}
                      </div>
                      <div className="text-gray-400">{costCentres.find(p => p.id === cc.parentId)?.name || '-'}</div>
                      <div className="flex items-center justify-end gap-3 text-gray-400">
                        <button onClick={() => openCostCentreModal(cc)} className="hover:text-amber-500 transition"><Edit2 className="h-4 w-4" /></button>
                        <button onClick={() => deleteCostCentreMut.mutate(cc.id)} className="hover:text-red-400 transition"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* ── Party Modal ── */}
      {partyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass max-w-lg w-full p-6 rounded-xl border border-gray-800">
            <h3 className="text-base font-bold text-white mb-4">{editingPartyId ? 'Edit Stakeholder / Party' : 'Add Stakeholder / Party'}</h3>
            <form onSubmit={handlePartySubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Party Name</label>
                  <input type="text" required value={partyForm.name} onChange={e => setPartyForm({ ...partyForm, name: e.target.value })} placeholder="Apex Stores" className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white placeholder-gray-600 outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Type</label>
                  <select value={partyForm.type} onChange={e => setPartyForm({ ...partyForm, type: e.target.value })} className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white outline-none text-sm">
                    <option value="CUSTOMER">CUSTOMER (Sundry Debtor)</option>
                    <option value="SUPPLIER">SUPPLIER (Sundry Creditor)</option>
                    <option value="BOTH">BOTH (Debtor & Creditor)</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">GSTIN (Optional)</label>
                  <input type="text" value={partyForm.gstin} onChange={e => setPartyForm({ ...partyForm, gstin: e.target.value })} placeholder="07AAAAA1111A1Z1" className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white placeholder-gray-600 outline-none text-sm font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Phone Number</label>
                  <input type="text" value={partyForm.phone} onChange={e => setPartyForm({ ...partyForm, phone: e.target.value })} className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white placeholder-gray-600 outline-none text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Email Address</label>
                  <input type="email" value={partyForm.email} onChange={e => setPartyForm({ ...partyForm, email: e.target.value })} placeholder="info@company.com" className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white placeholder-gray-600 outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">State (GST Region)</label>
                  <input type="text" value={partyForm.state} onChange={e => setPartyForm({ ...partyForm, state: e.target.value })} placeholder="Maharashtra" className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white placeholder-gray-600 outline-none text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Drug License No. (Optional)</label>
                  <input type="text" value={partyForm.dlNumber} onChange={e => setPartyForm({ ...partyForm, dlNumber: e.target.value })} placeholder="JH-DH1-155063/155064" className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white placeholder-gray-600 outline-none text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Billing Address</label>
                <textarea rows={2} value={partyForm.address} onChange={e => setPartyForm({ ...partyForm, address: e.target.value })} placeholder="Enter street address..." className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white placeholder-gray-600 outline-none text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Credit Limit (₹)</label>
                  <input type="number" value={partyForm.creditLimit} onChange={e => setPartyForm({ ...partyForm, creditLimit: e.target.value })} className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white outline-none text-sm font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Credit Payment Days</label>
                  <input type="number" value={partyForm.creditDays} onChange={e => setPartyForm({ ...partyForm, creditDays: parseInt(e.target.value) })} className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white outline-none text-sm" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-3">
                <button type="button" onClick={() => { setPartyModal(false); setEditingPartyId(null); }} className="px-4 py-2 border border-gray-800 text-gray-400 hover:text-white rounded-lg text-xs">Cancel</button>
                <button type="submit" disabled={createPartyMut.isPending || updatePartyMut.isPending} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-[#0a0e1a] font-semibold rounded-lg text-xs">{editingPartyId ? 'Update Party' : 'Save Party'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Stock Item Modal ── */}
      {itemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass max-w-lg w-full p-6 rounded-xl border border-gray-800">
            <h3 className="text-base font-bold text-white mb-4">{editingProductId ? 'Edit Inventory Item' : 'Add Inventory Item'}</h3>
            <form onSubmit={handleItemSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Item Name</label>
                <input type="text" required value={itemForm.name} onChange={e => setItemForm({ ...itemForm, name: e.target.value })} placeholder="E.g., Acetaminophen 500mg" className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white placeholder-gray-600 outline-none text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Retail Price (₹)</label>
                  <input type="number" step="0.01" min="0" required value={itemForm.price} onChange={e => setItemForm({ ...itemForm, price: e.target.value })} placeholder="85.00" className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white placeholder-gray-600 outline-none text-sm font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Unit</label>
                  <input type="text" required value={itemForm.unit} onChange={e => setItemForm({ ...itemForm, unit: e.target.value })} placeholder="STRIP / INJ / PCS" className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white placeholder-gray-600 outline-none text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">HSN Code</label>
                  <input type="text" value={itemForm.hsnCode} onChange={e => setItemForm({ ...itemForm, hsnCode: e.target.value })} placeholder="3004" className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white placeholder-gray-600 outline-none text-sm font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">GST Rate (%)</label>
                  <input type="number" step="0.01" min="0" value={itemForm.gstRate} onChange={e => setItemForm({ ...itemForm, gstRate: e.target.value })} placeholder="5" className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white outline-none text-sm font-mono" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Reorder Level</label>
                <input type="number" min="0" value={itemForm.reorderLevel} onChange={e => setItemForm({ ...itemForm, reorderLevel: e.target.value })} className="w-full md:w-1/2 bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white outline-none text-sm font-mono" />
              </div>
              {!editingProductId && (
                <p className="text-[10px] text-gray-500">After saving, you'll be prompted to add a batch (batch number, expiry & MRP) for this item right away.</p>
              )}
              <div className="flex justify-end gap-3 pt-3">
                <button type="button" onClick={() => { setItemModal(false); setEditingProductId(null); }} className="px-4 py-2 border border-gray-800 text-gray-400 hover:text-white rounded-lg text-xs">Cancel</button>
                <button type="submit" disabled={createItemMut.isPending || updateItemMut.isPending} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-[#0a0e1a] font-semibold rounded-lg text-xs">{editingProductId ? 'Update Item' : 'Save Item'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Add Batch Modal ── */}
      {batchModal && selectedItem && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass max-w-sm w-full p-6 rounded-xl border border-gray-800">
            <h3 className="text-base font-bold text-white mb-1">{editingBatchId ? 'Edit Batch' : 'Add Batch'} — {selectedItem.name}</h3>
            <p className="text-xs text-gray-500 mb-4">{editingBatchId ? 'Update batch details.' : 'Records incoming stock for this medicine.'}</p>
            <form onSubmit={handleBatchSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Batch Number</label>
                <input type="text" required value={batchForm.batchNumber} onChange={e => setBatchForm({ ...batchForm, batchNumber: e.target.value })} placeholder="BA00148A" className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white placeholder-gray-600 outline-none text-sm font-mono" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Expiry Date</label>
                  <input type="date" required value={batchForm.expiryDate} onChange={e => setBatchForm({ ...batchForm, expiryDate: e.target.value })} className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">MRP (₹)</label>
                  <input type="number" step="0.01" min="0" required value={batchForm.mrp} onChange={e => setBatchForm({ ...batchForm, mrp: e.target.value })} className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white outline-none text-sm font-mono" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Quantity Received</label>
                <input type="number" min="0" required value={batchForm.currentQty} onChange={e => setBatchForm({ ...batchForm, currentQty: e.target.value })} className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white outline-none text-sm font-mono" />
              </div>
              <div className="flex justify-end gap-3 pt-3">
                <button type="button" onClick={() => { setBatchModal(false); setEditingBatchId(null); }} className="px-4 py-2 border border-gray-800 text-gray-400 hover:text-white rounded-lg text-xs">{editingBatchId ? 'Cancel' : 'Skip for now'}</button>
                <button type="submit" disabled={createBatchMut.isPending || updateBatchMut.isPending} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-[#0a0e1a] font-semibold rounded-lg text-xs">{editingBatchId ? 'Update Batch' : 'Save Batch'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Party Details Modal ── */}
      {selectedParty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass max-w-md w-full p-6 rounded-xl border border-gray-800 shadow-2xl relative">
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border mb-2 ${
                  selectedParty.type === 'CUSTOMER' 
                    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' 
                    : 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                }`}>
                  {selectedParty.type}
                </span>
                <h3 className="text-lg font-bold text-white leading-tight">{selectedParty.name}</h3>
              </div>
              <button 
                onClick={() => setSelectedParty(null)}
                className="text-gray-500 hover:text-white transition text-sm font-bold px-2 py-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4 border-t border-gray-800 pt-3">
                <div>
                  <span className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider">GSTIN</span>
                  <span className="text-white font-mono font-medium">{selectedParty.gstin || 'Not Provided'}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Phone</span>
                  <span className="text-white font-medium">{selectedParty.phone || 'Not Provided'}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Email</span>
                  <span className="text-white font-medium break-all">{selectedParty.email || 'Not Provided'}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider">State Region</span>
                  <span className="text-white font-medium">{selectedParty.state || 'Not Provided'}</span>
                </div>
              </div>

              <div className="border-t border-gray-800 pt-3">
                <span className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Drug License No.</span>
                <span className="text-white font-mono font-medium">{selectedParty.dlNumber || 'Not Provided'}</span>
              </div>

              <div className="border-t border-gray-800 pt-3">
                <span className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Billing Address</span>
                <p className="text-gray-300 font-medium whitespace-pre-line leading-relaxed bg-[#0d1224] p-3 rounded-lg border border-gray-800/40">
                  {selectedParty.address || 'No address provided'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-gray-800 pt-3">
                <div>
                  <span className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Credit Limit</span>
                  <span className="text-white font-mono font-semibold">₹{formatCurrency(selectedParty.creditLimit)}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Credit Days</span>
                  <span className="text-white font-semibold">{selectedParty.creditPeriodDays || selectedParty.creditDays || 0} Days</span>
                </div>
              </div>

              {selectedParty.ledger && (
                <div className="border-t border-gray-800 pt-3">
                  <span className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Linked General Ledger</span>
                  <span className="text-amber-500 font-medium">{selectedParty.ledger.name}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4 mt-4 border-t border-gray-800">
              <button 
                onClick={() => setSelectedParty(null)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-[#0a0e1a] font-bold rounded-lg text-xs cursor-pointer"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Stock Item Details Modal ── */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass max-w-md w-full p-6 rounded-xl border border-gray-800 shadow-2xl relative">
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border border-indigo-500/20 bg-indigo-500/10 text-indigo-400 mb-2 uppercase">
                  {selectedItem.type || 'MEDICINE'}
                </span>
                <h3 className="text-lg font-bold text-white leading-tight">{selectedItem.name}</h3>
              </div>
              <button 
                onClick={() => setSelectedItem(null)}
                className="text-gray-500 hover:text-white transition text-sm font-bold px-2 py-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4 border-t border-gray-800 pt-3">
                <div>
                  <span className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider">HSN Code</span>
                  <span className="text-white font-mono font-medium">{selectedItem.hsnCode || 'Not Provided'}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider">GST Rate</span>
                  <span className="text-white font-mono font-semibold">{selectedItem.gstRate}%</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Retail Price</span>
                  <span className="text-white font-mono font-semibold">₹{formatCurrency(selectedItem.price)}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Base Unit</span>
                  <span className="text-white font-semibold uppercase">{selectedItem.unit || 'PCS'}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Reorder Level</span>
                  <span className="text-white font-semibold font-mono">{selectedItem.reorderLevel || 0} {selectedItem.unit || 'PCS'}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Total Available Stock</span>
                  <span className="text-emerald-400 font-bold font-mono">
                    {selectedItem.batches?.reduce((sum, b) => sum + b.currentQty, 0) || 0} {selectedItem.unit || 'PCS'}
                  </span>
                </div>
              </div>

              {/* Batches Table */}
              <div className="border-t border-gray-800 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Active Batches Stock</span>
                  <button
                    type="button"
                    onClick={() => openBatchModal(null)}
                    className="flex items-center gap-1 text-[9px] font-bold text-amber-500 bg-amber-500/5 border border-amber-500/10 px-2 py-0.5 rounded hover:bg-amber-500 hover:text-[#0a0e1a] cursor-pointer"
                  >
                    <Plus className="h-3 w-3" /> Add Batch
                  </button>
                </div>
                {selectedItem.batches && selectedItem.batches.length > 0 ? (
                  <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                    <div className="grid grid-cols-4 text-[10px] font-bold text-gray-500 uppercase border-b border-gray-800/40 pb-1">
                      <div>Batch No.</div>
                      <div>Expiry</div>
                      <div className="text-right">Qty</div>
                      <div className="text-right">Action</div>
                    </div>
                    {selectedItem.batches.map(b => (
                      <div key={b.id} className="grid grid-cols-4 text-xs py-1 text-gray-300 font-mono items-center">
                        <div className="font-semibold text-white">{b.batchNumber}</div>
                        <div>{new Date(b.expiryDate).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })}</div>
                        <div className="text-right font-bold text-emerald-400">{b.currentQty}</div>
                        <div className="flex items-center justify-end gap-2 text-gray-400">
                          <button type="button" onClick={() => openBatchModal(b)} className="hover:text-amber-500 transition"><Edit2 className="h-3 w-3" /></button>
                          <button type="button" onClick={() => deleteBatchMut.mutate(b.id)} className="hover:text-red-400 transition"><Trash2 className="h-3 w-3" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-600 italic">No active batches or stock registered.</p>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-4 mt-4 border-t border-gray-800">
              <button
                onClick={() => setSelectedItem(null)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-[#0a0e1a] font-bold rounded-lg text-xs cursor-pointer"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cost Centre Modal ── */}
      {costCentreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass max-w-sm w-full p-6 rounded-xl border border-gray-800">
            <h3 className="text-base font-bold text-white mb-4">{editingCostCentreId ? 'Edit Cost Centre' : 'Add Cost Centre'}</h3>
            <form onSubmit={handleCostCentreSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Cost Centre Name</label>
                <input type="text" required value={costCentreForm.name} onChange={e => setCostCentreForm({ ...costCentreForm, name: e.target.value })} placeholder="E.g., Bariatu Branch" className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white placeholder-gray-600 outline-none text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Parent Cost Centre (Optional)</label>
                <select value={costCentreForm.parentId} onChange={e => setCostCentreForm({ ...costCentreForm, parentId: e.target.value })} className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white outline-none text-sm">
                  <option value="">None (Top Level)</option>
                  {costCentres.filter(cc => cc.id !== editingCostCentreId).map(cc => (
                    <option key={cc.id} value={cc.id}>{cc.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-3">
                <button type="button" onClick={() => { setCostCentreModal(false); setEditingCostCentreId(null); }} className="px-4 py-2 border border-gray-800 text-gray-400 hover:text-white rounded-lg text-xs">Cancel</button>
                <button type="submit" disabled={createCostCentreMut.isPending || updateCostCentreMut.isPending} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-[#0a0e1a] font-semibold rounded-lg text-xs">{editingCostCentreId ? 'Update' : 'Save'} Cost Centre</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
