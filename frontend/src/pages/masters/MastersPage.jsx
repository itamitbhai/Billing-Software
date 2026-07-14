import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tallyApi } from '../../api/tally.api';
import { Plus, Trash2, Loader2, Users, Package, Settings, Calculator, Globe, Milestone } from 'lucide-react';
import { toast } from 'sonner';
import { formatRupees } from '../../utils/format';

export default function MastersPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('parties');

  // Modal States
  const [partyModal, setPartyModal] = useState(false);
  const [partyForm, setPartyForm] = useState({ name: '', type: 'CUSTOMER', gstin: '', phone: '', email: '', address: '', state: '', creditLimit: '0', creditDays: 0 });
  const [selectedParty, setSelectedParty] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);

  const [itemModal, setItemModal] = useState(false);
  const [itemForm, setItemForm] = useState({ name: '', stockGroupId: '', unitId: '', taxRateId: '', openingQuantity: '0', openingRate: '0', hsn: '' });

  const [unitModal, setUnitModal] = useState(false);
  const [unitForm, setUnitForm] = useState({ name: '', symbol: '' });

  const [taxModal, setTaxModal] = useState(false);
  const [taxForm, setTaxForm] = useState({ name: '', rate: '0', cgst: '0', sgst: '0', igst: '0' });

  // ── Queries ───────────────────────────────────────────────────
  const { data: partiesRes, isLoading: partiesLoading } = useQuery({ queryKey: ['parties'], queryFn: () => tallyApi.parties.list() });
  const { data: itemsRes, isLoading: itemsLoading } = useQuery({ queryKey: ['stock-items'], queryFn: tallyApi.stockItems.list });
  const { data: unitsRes } = useQuery({ queryKey: ['units'], queryFn: tallyApi.units.list });
  const { data: taxRes } = useQuery({ queryKey: ['tax-rates'], queryFn: tallyApi.taxRates.list });
  const { data: stockGroupsRes } = useQuery({ queryKey: ['stock-groups'], queryFn: tallyApi.stockGroups.list });

  const parties = partiesRes?.data || [];
  const items = itemsRes?.data || [];
  const units = unitsRes?.data || [];
  const taxRates = taxRes?.data || [];
  const stockGroups = stockGroupsRes?.data || [];

  // ── Mutations ─────────────────────────────────────────────────
  const createPartyMut = useMutation({
    mutationFn: tallyApi.parties.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parties'] });
      toast.success('Party and backing ledger created');
      setPartyModal(false);
      setPartyForm({ name: '', type: 'CUSTOMER', gstin: '', phone: '', email: '', address: '', state: '', creditLimit: '0', creditDays: 0 });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error creating party')
  });

  const deletePartyMut = useMutation({
    mutationFn: tallyApi.parties.delete,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['parties'] }); toast.success('Party deleted'); },
    onError: (err) => toast.error(err.response?.data?.message || 'Error deleting party')
  });

  const createItemMut = useMutation({
    mutationFn: tallyApi.stockItems.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-items'] });
      toast.success('Stock Item registered');
      setItemModal(false);
      setItemForm({ name: '', stockGroupId: '', unitId: '', taxRateId: '', openingQuantity: '0', openingRate: '0', hsn: '' });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error creating item')
  });

  const deleteItemMut = useMutation({
    mutationFn: tallyApi.stockItems.delete,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['stock-items'] }); toast.success('Item deleted'); },
    onError: (err) => toast.error(err.response?.data?.message || 'Error deleting item')
  });

  const createUnitMut = useMutation({
    mutationFn: tallyApi.units.create,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['units'] }); toast.success('Unit added'); setUnitModal(false); setUnitForm({ name: '', symbol: '' }); },
    onError: (err) => toast.error(err.response?.data?.message || 'Error creating unit')
  });

  const createTaxMut = useMutation({
    mutationFn: tallyApi.taxRates.create,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tax-rates'] }); toast.success('Tax rate added'); setTaxModal(false); setTaxForm({ name: '', rate: '0', cgst: '0', sgst: '0', igst: '0' }); },
    onError: (err) => toast.error(err.response?.data?.message || 'Error creating tax rate')
  });

  // ── Handlers ──────────────────────────────────────────────────
  const handlePartySubmit = (e) => {
    e.preventDefault();
    createPartyMut.mutate({
      ...partyForm,
      creditLimit: Number(partyForm.creditLimit) * 100 // convert to paise
    });
  };

  const handleItemSubmit = (e) => {
    e.preventDefault();
    createItemMut.mutate({
      ...itemForm,
      openingQuantity: Number(itemForm.openingQuantity),
      openingRate: Number(itemForm.openingRate) * 100 // convert to paise
    });
  };

  const handleUnitSubmit = (e) => {
    e.preventDefault();
    createUnitMut.mutate(unitForm);
  };

  const handleTaxSubmit = (e) => {
    e.preventDefault();
    createTaxMut.mutate({
      name: taxForm.name,
      rate: Math.round(Number(taxForm.rate) * 100),
      cgst: Math.round(Number(taxForm.cgst) * 100),
      sgst: Math.round(Number(taxForm.sgst) * 100),
      igst: Math.round(Number(taxForm.igst) * 100)
    });
  };

  const subTabs = [
    { id: 'parties', name: 'Parties Contacts', icon: Users },
    { id: 'items', name: 'Stock Items', icon: Package },
    { id: 'units', name: 'Units of Measure', icon: Settings },
    { id: 'tax', name: 'GST Tax Rates', icon: Calculator }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">Masters Directory</h2>
          <p className="text-gray-400 text-xs mt-1">Configure business stakeholders, inventory catalog, tax schemas and measurement units</p>
        </div>
        <div>
          {activeTab === 'parties' && (
            <button onClick={() => setPartyModal(true)} className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-[#0a0e1a] font-semibold rounded-lg text-sm transition cursor-pointer">
              <Plus className="h-4 w-4" /> Add Party
            </button>
          )}
          {activeTab === 'items' && (
            <button onClick={() => setItemModal(true)} className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-[#0a0e1a] font-semibold rounded-lg text-sm transition cursor-pointer">
              <Plus className="h-4 w-4" /> Add Stock Item
            </button>
          )}
          {activeTab === 'units' && (
            <button onClick={() => setUnitModal(true)} className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-[#0a0e1a] font-semibold rounded-lg text-sm transition cursor-pointer">
              <Plus className="h-4 w-4" /> Add Unit
            </button>
          )}
          {activeTab === 'tax' && (
            <button onClick={() => setTaxModal(true)} className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-[#0a0e1a] font-semibold rounded-lg text-sm transition cursor-pointer">
              <Plus className="h-4 w-4" /> Add Tax Rate
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
                      <div className="text-right text-gray-400">
                        <button onClick={() => deletePartyMut.mutate(p.id)} className="hover:text-red-400 transition"><Trash2 className="h-4 w-4 ml-auto" /></button>
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
                        onClick={() => setSelectedItem(item)}
                        type="button"
                        className="font-semibold text-left text-white hover:text-amber-500 hover:underline transition cursor-pointer"
                      >
                        {item.name}
                      </button>
                      <div className="text-gray-400 uppercase">{item.unit || 'PCS'}</div>
                      <div className="text-right font-mono">{item.batches?.reduce((sum, b) => sum + b.currentQty, 0) || 0}</div>
                      <div className="text-right font-mono">{formatRupees(item.price)}</div>
                      <div className="text-right text-gray-400">
                        <button onClick={() => deleteItemMut.mutate(item.id)} className="hover:text-red-400 transition"><Trash2 className="h-4 w-4 ml-auto" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'units' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="grid grid-cols-2 text-xs font-bold text-gray-400 uppercase border-b border-gray-800 pb-3">
                <div>Unit Name</div>
                <div>Symbol</div>
              </div>
              <div className="divide-y divide-gray-800/40">
                {units.map(u => (
                  <div key={u.id} className="grid grid-cols-2 py-3 text-sm">
                    <div className="text-white">{u.name}</div>
                    <div className="text-amber-500 font-bold">{u.symbol}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tax' && (
          <div className="space-y-4">
            <div className="grid grid-cols-5 text-xs font-bold text-gray-400 uppercase border-b border-gray-800 pb-3">
              <div>Tax Bracket</div>
              <div className="text-right">Overall Rate</div>
              <div className="text-right">CGST</div>
              <div className="text-right">SGST</div>
              <div className="text-right">IGST</div>
            </div>
            <div className="divide-y divide-gray-800/40">
              {taxRates.map(tr => (
                <div key={tr.id} className="grid grid-cols-5 py-3 items-center text-sm font-mono">
                  <div className="text-white font-sans">{tr.name}</div>
                  <div className="text-right text-amber-500 font-bold">{tr.rate / 100}%</div>
                  <div className="text-right text-gray-400">{tr.cgst / 100}%</div>
                  <div className="text-right text-gray-400">{tr.sgst / 100}%</div>
                  <div className="text-right text-gray-400">{tr.igst / 100}%</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Party Modal ── */}
      {partyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass max-w-lg w-full p-6 rounded-xl border border-gray-800">
            <h3 className="text-base font-bold text-white mb-4">Add Stakeholder / Party</h3>
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
                <button type="button" onClick={() => setPartyModal(false)} className="px-4 py-2 border border-gray-800 text-gray-400 hover:text-white rounded-lg text-xs">Cancel</button>
                <button type="submit" disabled={createPartyMut.isPending} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-[#0a0e1a] font-semibold rounded-lg text-xs">Save Party</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Stock Item Modal ── */}
      {itemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass max-w-lg w-full p-6 rounded-xl border border-gray-800">
            <h3 className="text-base font-bold text-white mb-4">Add Inventory Item</h3>
            <form onSubmit={handleItemSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Item Name</label>
                  <input type="text" required value={itemForm.name} onChange={e => setItemForm({ ...itemForm, name: e.target.value })} placeholder="E.g., Acetaminophen 500mg" className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white placeholder-gray-600 outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Stock Group (Optional)</label>
                  <select value={itemForm.stockGroupId} onChange={e => setItemForm({ ...itemForm, stockGroupId: e.target.value })} className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white outline-none text-sm">
                    <option value="">Select Group...</option>
                    {stockGroups.map(sg => (
                      <option key={sg.id} value={sg.id}>{sg.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Unit</label>
                  <select value={itemForm.unitId} onChange={e => setItemForm({ ...itemForm, unitId: e.target.value })} className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white outline-none text-sm">
                    <option value="">Select...</option>
                    {units.map(u => (
                      <option key={u.id} value={u.id}>{u.symbol}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">GST Rate Profile</label>
                  <select value={itemForm.taxRateId} onChange={e => setItemForm({ ...itemForm, taxRateId: e.target.value })} className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white outline-none text-sm">
                    <option value="">Select...</option>
                    {taxRates.map(tr => (
                      <option key={tr.id} value={tr.id}>{tr.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">HSN Code (GST)</label>
                  <input type="text" value={itemForm.hsn} onChange={e => setItemForm({ ...itemForm, hsn: e.target.value })} placeholder="3004" className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white placeholder-gray-600 outline-none text-sm font-mono" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Opening Stock Quantity</label>
                  <input type="number" value={itemForm.openingQuantity} onChange={e => setItemForm({ ...itemForm, openingQuantity: e.target.value })} className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white outline-none text-sm font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Valuation Rate Per Unit (₹)</label>
                  <input type="number" step="0.01" value={itemForm.openingRate} onChange={e => setItemForm({ ...itemForm, openingRate: e.target.value })} className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white outline-none text-sm font-mono" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-3">
                <button type="button" onClick={() => setItemModal(false)} className="px-4 py-2 border border-gray-800 text-gray-400 hover:text-white rounded-lg text-xs">Cancel</button>
                <button type="submit" disabled={createItemMut.isPending} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-[#0a0e1a] font-semibold rounded-lg text-xs">Save Item</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Unit Modal ── */}
      {unitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass max-w-sm w-full p-6 rounded-xl border border-gray-800">
            <h3 className="text-base font-bold text-white mb-4">Add Measurement Unit</h3>
            <form onSubmit={handleUnitSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Unit Name</label>
                <input type="text" required value={unitForm.name} onChange={e => setUnitForm({ ...unitForm, name: e.target.value })} placeholder="E.g., Kilograms" className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white placeholder-gray-600 outline-none text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Symbol</label>
                <input type="text" required value={unitForm.symbol} onChange={e => setUnitForm({ ...unitForm, symbol: e.target.value })} placeholder="E.g., Kg" className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white placeholder-gray-600 outline-none text-sm" />
              </div>
              <div className="flex justify-end gap-3 pt-3">
                <button type="button" onClick={() => setUnitModal(false)} className="px-4 py-2 border border-gray-800 text-gray-400 hover:text-white rounded-lg text-xs">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-[#0a0e1a] font-semibold rounded-lg text-xs">Add Unit</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Tax Rate Modal ── */}
      {taxModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass max-w-sm w-full p-6 rounded-xl border border-gray-800">
            <h3 className="text-base font-bold text-white mb-4">Add GST Tax Rate Profile</h3>
            <form onSubmit={handleTaxSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Profile Name</label>
                <input type="text" required value={taxForm.name} onChange={e => setTaxForm({ ...taxForm, name: e.target.value })} placeholder="E.g., GST 18%" className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white placeholder-gray-600 outline-none text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Total GST (%)</label>
                  <input type="number" step="0.01" required value={taxForm.rate} onChange={e => setTaxForm({ ...taxForm, rate: e.target.value })} className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white outline-none text-sm font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">CGST (%)</label>
                  <input type="number" step="0.01" value={taxForm.cgst} onChange={e => setTaxForm({ ...taxForm, cgst: e.target.value })} className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white outline-none text-sm font-mono" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">SGST (%)</label>
                  <input type="number" step="0.01" value={taxForm.sgst} onChange={e => setTaxForm({ ...taxForm, sgst: e.target.value })} className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white outline-none text-sm font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">IGST (%)</label>
                  <input type="number" step="0.01" value={taxForm.igst} onChange={e => setTaxForm({ ...taxForm, igst: e.target.value })} className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2.5 text-white outline-none text-sm font-mono" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-3">
                <button type="button" onClick={() => setTaxModal(false)} className="px-4 py-2 border border-gray-800 text-gray-400 hover:text-white rounded-lg text-xs">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-[#0a0e1a] font-semibold rounded-lg text-xs">Save Tax</button>
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
                <span className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Billing Address</span>
                <p className="text-gray-300 font-medium whitespace-pre-line leading-relaxed bg-[#0d1224] p-3 rounded-lg border border-gray-800/40">
                  {selectedParty.address || 'No address provided'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-gray-800 pt-3">
                <div>
                  <span className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Credit Limit</span>
                  <span className="text-white font-mono font-semibold">{formatRupees(selectedParty.creditLimit)}</span>
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
                  <span className="text-white font-mono font-semibold">{formatRupees(selectedItem.price)}</span>
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
                <span className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Active Batches Stock</span>
                {selectedItem.batches && selectedItem.batches.length > 0 ? (
                  <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                    <div className="grid grid-cols-3 text-[10px] font-bold text-gray-500 uppercase border-b border-gray-800/40 pb-1">
                      <div>Batch No.</div>
                      <div>Expiry</div>
                      <div className="text-right">Qty</div>
                    </div>
                    {selectedItem.batches.map(b => (
                      <div key={b.id} className="grid grid-cols-3 text-xs py-1 text-gray-300 font-mono">
                        <div className="font-semibold text-white">{b.batchNumber}</div>
                        <div>{new Date(b.expiryDate).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })}</div>
                        <div className="text-right font-bold text-emerald-400">{b.currentQty}</div>
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
    </div>
  );
}
