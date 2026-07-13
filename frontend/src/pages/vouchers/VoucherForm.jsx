import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tallyApi } from '../../api/tally.api';
import { Plus, Trash2, Save, Undo2, Calculator, Package } from 'lucide-react';
import { toast } from 'sonner';
import { formatRupees } from '../../utils/format';

export default function VoucherForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [type, setType] = useState('SALES');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [narration, setNarration] = useState('');
  const [partyId, setPartyId] = useState('');
  
  // Ledger rows: list of { ledgerId, type, amount, description, costCentreId, items }
  const [lines, setLines] = useState([
    { ledgerId: '', type: 'DEBIT', amount: '', description: '', costCentreId: '', items: [] },
    { ledgerId: '', type: 'CREDIT', amount: '', description: '', costCentreId: '', items: [] }
  ]);

  // ── Queries ───────────────────────────────────────────────────
  const { data: ledgersRes } = useQuery({ queryKey: ['ledgers'], queryFn: () => tallyApi.ledgers.list() });
  const { data: partiesRes } = useQuery({ queryKey: ['parties'], queryFn: () => tallyApi.parties.list() });
  const { data: stockItemsRes } = useQuery({ queryKey: ['stock-items'], queryFn: tallyApi.stockItems.list });
  const { data: costCentresRes } = useQuery({ queryKey: ['cost-centres'], queryFn: tallyApi.costCentres.list });

  const ledgers = ledgersRes?.data || [];
  const parties = partiesRes?.data || [];
  const stockItems = stockItemsRes?.data || [];
  const costCentres = costCentresRes?.data || [];

  // ── Mutations ─────────────────────────────────────────────────
  const createVoucherMut = useMutation({
    mutationFn: tallyApi.vouchers.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vouchers'] });
      toast.success('Double-entry voucher posted successfully');
      navigate('/vouchers');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error posting voucher')
  });

  // ── Calculations ──────────────────────────────────────────────
  const debitsTotal = lines.filter(l => l.type === 'DEBIT').reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const creditsTotal = lines.filter(l => l.type === 'CREDIT').reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const difference = Math.abs(debitsTotal - creditsTotal);

  // ── Row Management Handlers ────────────────────────────────────
  const addLineRow = () => {
    setLines([...lines, { ledgerId: '', type: 'CREDIT', amount: '', description: '', costCentreId: '', items: [] }]);
  };

  const removeLineRow = (index) => {
    if (lines.length <= 2) return toast.error('A voucher requires at least two lines.');
    setLines(lines.filter((_, idx) => idx !== index));
  };

  const handleLineChange = (index, field, value) => {
    const updated = [...lines];
    updated[index][field] = value;
    setLines(updated);
  };

  // Nested Stock items for Sales/Purchase line rows
  const handleAddStockItem = (index) => {
    const updated = [...lines];
    updated[index].items.push({ stockItemId: '', quantity: '1', rate: '0', discount: '0', amount: '0' });
    setLines(updated);
  };

  const handleStockItemChange = (lineIndex, itemIndex, field, value) => {
    const updated = [...lines];
    const item = updated[lineIndex].items[itemIndex];
    item[field] = value;

    // Auto calculate amount = (qty * rate) - discount
    if (field === 'quantity' || field === 'rate' || field === 'discount') {
      const q = Number(item.quantity) || 0;
      const r = Number(item.rate) || 0;
      const d = Number(item.discount) || 0;
      item.amount = String((q * r) - d);
      
      // Auto fill the parent ledger line amount
      const lineTotal = updated[lineIndex].items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
      updated[lineIndex].amount = String(lineTotal);
    }

    setLines(updated);
  };

  const handleRemoveStockItem = (lineIndex, itemIndex) => {
    const updated = [...lines];
    updated[lineIndex].items = updated[lineIndex].items.filter((_, idx) => idx !== itemIndex);
    
    // Recalculate parent ledger line amount
    const lineTotal = updated[lineIndex].items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
    updated[lineIndex].amount = String(lineTotal);

    setLines(updated);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (difference !== 0) return toast.error('Double-entry violation: Total Debits must match Total Credits.');
    
    const formattedLines = lines.map(l => ({
      ledgerId: l.ledgerId,
      type: l.type,
      amount: BigInt(Math.round(Number(l.amount) * 100)).toString(), // to paise String
      description: l.description,
      costCentreId: l.costCentreId || null,
      items: l.items.length ? l.items.map(it => ({
        stockItemId: it.stockItemId,
        quantity: parseFloat(it.quantity),
        rate: BigInt(Math.round(Number(it.rate) * 100)).toString(),
        discount: BigInt(Math.round(Number(it.discount) * 100)).toString(),
        amount: BigInt(Math.round(Number(it.amount) * 100)).toString()
      })) : undefined
    }));

    createVoucherMut.mutate({
      type,
      date,
      narration,
      partyId: partyId || null,
      lines: formattedLines
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">Post Accounting Voucher</h2>
          <p className="text-gray-400 text-xs mt-1">Configure double-entry transaction lines with real-time balance calculations</p>
        </div>
        <button
          onClick={() => navigate('/vouchers')}
          className="flex items-center gap-1.5 px-3 py-2 border border-gray-800 text-gray-400 hover:text-white rounded-lg text-xs cursor-pointer"
        >
          <Undo2 className="h-4 w-4" /> Cancel & Back
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header fields */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-[#111827]/40 p-4 rounded-xl border border-gray-800">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Voucher Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2 text-white outline-none text-xs"
            >
              <option value="SALES">SALES</option>
              <option value="PURCHASE">PURCHASE</option>
              <option value="RECEIPT">RECEIPT</option>
              <option value="PAYMENT">PAYMENT</option>
              <option value="CONTRA">CONTRA</option>
              <option value="JOURNAL">JOURNAL</option>
              <option value="CREDIT_NOTE">CREDIT NOTE</option>
              <option value="DEBIT_NOTE">DEBIT NOTE</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Posting Date</label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2 text-white outline-none text-xs"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Ledger Party (Optional)</label>
            <select
              value={partyId}
              onChange={(e) => setPartyId(e.target.value)}
              className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2 text-white outline-none text-xs"
            >
              <option value="">None / Internal Journal</option>
              {parties.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
              ))}
            </select>
          </div>
        </div>

        {/* Ledger Sheet Grid */}
        <div className="glass rounded-xl border border-gray-800 overflow-hidden">
          <div className="px-5 py-3.5 bg-[#111827]/40 border-b border-gray-800 flex justify-between items-center">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-500">Double Entry Ledger Sheet</h3>
            <button
              type="button"
              onClick={addLineRow}
              className="flex items-center gap-1 text-[10px] font-bold bg-amber-500/10 text-amber-500 px-2.5 py-1 rounded border border-amber-500/20 hover:bg-amber-500 hover:text-[#0a0e1a] cursor-pointer"
            >
              <Plus className="h-3 w-3" /> Add Ledger Row
            </button>
          </div>

          <div className="p-6 space-y-4 divide-y divide-gray-800/40">
            {lines.map((line, lineIdx) => (
              <div key={lineIdx} className="pt-4 first:pt-0 space-y-3">
                <div className="flex flex-col md:flex-row gap-4 items-start">
                  <div className="w-full md:w-32">
                    <select
                      value={line.type}
                      onChange={(e) => handleLineChange(lineIdx, 'type', e.target.value)}
                      className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2 text-xs font-bold text-white"
                    >
                      <option value="DEBIT">Dr (Debit)</option>
                      <option value="CREDIT">Cr (Credit)</option>
                    </select>
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <select
                      value={line.ledgerId}
                      required
                      onChange={(e) => handleLineChange(lineIdx, 'ledgerId', e.target.value)}
                      className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2 text-xs text-white"
                    >
                      <option value="">Select Ledger Account...</option>
                      {ledgers.map(l => (
                        <option key={l.id} value={l.id}>{l.name} ({l.group?.name})</option>
                      ))}
                    </select>
                  </div>
                  <div className="w-full md:w-44">
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={line.amount}
                      onChange={(e) => handleLineChange(lineIdx, 'amount', e.target.value)}
                      placeholder="Amount (₹)"
                      className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2 text-xs text-white font-mono"
                    />
                  </div>
                  <div className="flex-1 min-w-[150px]">
                    <select
                      value={line.costCentreId}
                      onChange={(e) => handleLineChange(lineIdx, 'costCentreId', e.target.value)}
                      className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2 text-xs text-white"
                    >
                      <option value="">Cost Centre (Optional)</option>
                      {costCentres.map(cc => (
                        <option key={cc.id} value={cc.id}>{cc.name}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLineRow(lineIdx)}
                    className="p-2 border border-gray-800 text-gray-500 hover:text-red-400 rounded-lg cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Optional Inventory allocation inside the ledger row (for Sales/Purchase lines) */}
                {line.ledgerId && (type === 'SALES' || type === 'PURCHASE') && (
                  <div className="bg-[#111827]/20 border border-gray-800/40 p-4 rounded-lg ml-0 md:ml-36 space-y-3">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Inventory Allocation</span>
                      <button
                        type="button"
                        onClick={() => handleAddStockItem(lineIdx)}
                        className="flex items-center gap-1 text-[9px] font-bold text-amber-500 bg-amber-500/5 border border-amber-500/10 px-2 py-0.5 rounded hover:bg-amber-500 hover:text-[#0a0e1a] cursor-pointer"
                      >
                        <Package className="h-3 w-3" /> Alloc Item
                      </button>
                    </div>
                    {line.items.map((item, itemIdx) => (
                      <div key={itemIdx} className="flex flex-col md:flex-row gap-3 items-center">
                        <select
                          value={item.stockItemId}
                          required
                          onChange={(e) => handleStockItemChange(lineIdx, itemIdx, 'stockItemId', e.target.value)}
                          className="flex-1 bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-1.5 text-xs text-white"
                        >
                          <option value="">Select Item...</option>
                          {stockItems.map(it => (
                            <option key={it.id} value={it.id}>{it.name}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) => handleStockItemChange(lineIdx, itemIdx, 'quantity', e.target.value)}
                          className="w-20 bg-[#0d1224] border border-gray-800 rounded-lg p-1.5 text-xs text-white font-mono"
                        />
                        <input
                          type="number"
                          placeholder="Rate (₹)"
                          value={item.rate}
                          onChange={(e) => handleStockItemChange(lineIdx, itemIdx, 'rate', e.target.value)}
                          className="w-24 bg-[#0d1224] border border-gray-800 rounded-lg p-1.5 text-xs text-white font-mono"
                        />
                        <input
                          type="number"
                          placeholder="Disc (₹)"
                          value={item.discount}
                          onChange={(e) => handleStockItemChange(lineIdx, itemIdx, 'discount', e.target.value)}
                          className="w-20 bg-[#0d1224] border border-gray-800 rounded-lg p-1.5 text-xs text-white font-mono"
                        />
                        <span className="w-28 text-right font-mono font-bold text-xs text-white">
                          {formatRupees(Number(item.amount) * 100)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveStockItem(lineIdx, itemIdx)}
                          className="text-gray-500 hover:text-red-400 transition cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Ledger calculations footer */}
          <div className="bg-[#111827]/40 border-t border-gray-800 p-5 flex flex-col md:flex-row md:justify-between md:items-center gap-4 text-xs font-mono">
            <div className="flex flex-wrap gap-6">
              <div>
                <span className="text-gray-400">Total Debits: </span>
                <span className="text-white font-bold text-sm">{formatRupees(debitsTotal * 100)}</span>
              </div>
              <div>
                <span className="text-gray-400">Total Credits: </span>
                <span className="text-white font-bold text-sm">{formatRupees(creditsTotal * 100)}</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {difference !== 0 ? (
                <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 text-red-400 px-3 py-1.5 rounded-lg">
                  <Calculator className="h-4 w-4" />
                  Difference: {formatRupees(difference * 100)} Out of Balance
                </div>
              ) : (
                <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-lg">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Ledger Balanced
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom narration & submit row */}
        <div className="flex flex-col md:flex-row gap-4 items-start">
          <div className="flex-1 w-full">
            <textarea
              placeholder="Provide a narration note here..."
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
              rows={2}
              className="w-full bg-[#111827]/40 border border-gray-800 focus:border-amber-500/50 rounded-xl p-3 text-white placeholder-gray-600 outline-none text-xs"
            />
          </div>
          <button
            type="submit"
            disabled={createVoucherMut.isPending || difference !== 0}
            className="w-full md:w-auto flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-[#0a0e1a] font-bold px-6 py-4 rounded-xl shadow-lg shadow-amber-500/10 transition cursor-pointer disabled:opacity-50"
          >
            <Save className="h-5 w-5" /> Post Voucher Transaction
          </button>
        </div>
      </form>
    </div>
  );
}
