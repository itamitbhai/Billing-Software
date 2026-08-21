import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tallyApi } from '../../api/tally.api';
import { Plus, Trash2, Save, Undo2, Package } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '../../utils/format';
import QuickAddPartyModal from '../../components/quickadd/QuickAddPartyModal';
import QuickAddProductModal from '../../components/quickadd/QuickAddProductModal';
import QuickAddBatchModal from '../../components/quickadd/QuickAddBatchModal';

const SUPPLY_TYPES = [
  { value: 'TAXABLE', label: 'Taxable' },
  { value: 'EXEMPT', label: 'Exempt' },
  { value: 'NIL_RATED', label: 'Nil Rated' },
  { value: 'ZERO_RATED_EXPORT', label: 'Zero Rated (Export)' },
  { value: 'ZERO_RATED_SEZ', label: 'Zero Rated (SEZ)' },
  { value: 'NON_GST', label: 'Non-GST' },
];

const emptyRow = () => ({ productId: '', batchId: '', qty: '1', rate: '' });

export default function SaleForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [customerId, setCustomerId] = useState('');
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [supplyType, setSupplyType] = useState('TAXABLE');
  const [placeOfSupply, setPlaceOfSupply] = useState('');
  const [rows, setRows] = useState([emptyRow()]);

  // Quick-add: create a missing Customer/Product/Batch inline instead of leaving this page.
  const [quickAddCustomerOpen, setQuickAddCustomerOpen] = useState(false);
  const [quickAddProductRowIdx, setQuickAddProductRowIdx] = useState(null);
  const [quickAddBatchRowIdx, setQuickAddBatchRowIdx] = useState(null);

  // ── Queries ───────────────────────────────────────────────────
  const { data: partiesRes } = useQuery({ queryKey: ['parties'], queryFn: () => tallyApi.parties.list() });
  const { data: productsRes } = useQuery({ queryKey: ['stock-items'], queryFn: tallyApi.stockItems.list });
  const { data: companyRes } = useQuery({ queryKey: ['company-profile'], queryFn: tallyApi.utilities.company.get });
  const { data: batchesRes } = useQuery({ queryKey: ['batches-all'], queryFn: () => tallyApi.batches.list() });

  const customers = (partiesRes?.data || []).filter(p => p.type === 'CUSTOMER' || p.type === 'BOTH');
  const products = productsRes?.data || [];
  const company = companyRes?.data;
  const allBatches = batchesRes?.data || [];

  const selectedCustomer = customers.find(c => c.id === customerId);
  const effectivePlaceOfSupply = placeOfSupply || selectedCustomer?.state || '';
  const isIntraState = !company?.state || !effectivePlaceOfSupply
    || company.state.trim().toLowerCase() === effectivePlaceOfSupply.trim().toLowerCase();

  // ── Mutations ─────────────────────────────────────────────────
  const createSaleMut = useMutation({
    mutationFn: tallyApi.billing.sales.create,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      toast.success('GST sale invoice created successfully');
      const saleId = res?.data?.id;
      navigate(saleId ? `/sales/${saleId}/invoice` : '/sales');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error creating sale invoice'),
  });

  // ── Row helpers ───────────────────────────────────────────────
  const batchesForProduct = (productId) => allBatches.filter(b => b.productId === productId && b.currentQty > 0);

  const addRow = () => setRows([...rows, emptyRow()]);
  const removeRow = (idx) => {
    if (rows.length <= 1) return;
    setRows(rows.filter((_, i) => i !== idx));
  };

  const updateRow = (idx, field, value) => {
    const updated = [...rows];
    const row = { ...updated[idx], [field]: value };

    if (field === 'productId') {
      row.batchId = '';
      const product = products.find(p => p.id === value);
      row.rate = product ? String(product.price) : '';
    }
    updated[idx] = row;
    setRows(updated);
  };

  // ── Priced preview (mirrors backend priceItems logic) ──────────
  const pricedRows = useMemo(() => rows.map((row) => {
    const product = products.find(p => p.id === row.productId);
    const batch = allBatches.find(b => b.id === row.batchId);
    const qty = Number(row.qty) || 0;
    const rate = Number(row.rate) || 0;
    const gstRate = supplyType !== 'TAXABLE' ? 0 : Number(product?.gstRate || 0);
    const taxableValue = qty * rate;
    const gstAmount = (taxableValue * gstRate) / 100;
    return {
      product, batch, qty, rate, gstRate,
      taxableValue, gstAmount,
      amount: taxableValue + gstAmount,
    };
  }), [rows, products, allBatches, supplyType]);

  const totals = pricedRows.reduce((acc, r) => ({
    subTotal: acc.subTotal + r.taxableValue,
    gstAmount: acc.gstAmount + r.gstAmount,
    totalAmount: acc.totalAmount + r.amount,
  }), { subTotal: 0, gstAmount: 0, totalAmount: 0 });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!customerId) return toast.error('Please select a customer.');
    if (!rows.length || rows.some(r => !r.batchId || !r.qty || !r.rate)) {
      return toast.error('Every line requires a product, batch, quantity, and rate.');
    }

    createSaleMut.mutate({
      customerId,
      saleDate,
      supplyType,
      placeOfSupply: effectivePlaceOfSupply,
      items: rows.map(r => ({
        batchId: r.batchId,
        qty: Number(r.qty),
        rate: Number(r.rate),
      })),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">New GST Sale Invoice</h2>
          <p className="text-gray-400 text-xs mt-1">Bill medicine to a customer — stock decrements from the selected batch and GST posts automatically</p>
        </div>
        <button
          onClick={() => navigate('/sales')}
          className="flex items-center gap-1.5 px-3 py-2 border border-gray-800 text-gray-400 hover:text-white rounded-lg text-xs cursor-pointer"
        >
          <Undo2 className="h-4 w-4" /> Cancel & Back
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header fields */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-[#111827]/40 p-4 rounded-xl border border-gray-800">
          <div className="md:col-span-2">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Customer (Buyer)</label>
              <button
                type="button"
                onClick={() => setQuickAddCustomerOpen(true)}
                className="flex items-center gap-0.5 text-[10px] font-bold text-amber-500 hover:underline cursor-pointer"
              >
                <Plus className="h-3 w-3" /> New Customer
              </button>
            </div>
            <select
              required
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2 text-white outline-none text-xs"
            >
              <option value="">Select customer...</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name} {c.gstin ? `(${c.gstin})` : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Invoice Date</label>
            <input
              type="date"
              required
              value={saleDate}
              onChange={(e) => setSaleDate(e.target.value)}
              className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2 text-white outline-none text-xs"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Supply Type</label>
            <select
              value={supplyType}
              onChange={(e) => setSupplyType(e.target.value)}
              className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2 text-white outline-none text-xs"
            >
              {SUPPLY_TYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Place of Supply (State)</label>
            <input
              type="text"
              value={placeOfSupply}
              onChange={(e) => setPlaceOfSupply(e.target.value)}
              placeholder={selectedCustomer?.state || 'Defaults to customer state'}
              className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2 text-white placeholder-gray-600 outline-none text-xs"
            />
          </div>
          <div className="md:col-span-2 flex items-end">
            <div className={`w-full text-center py-2 rounded-lg text-xs font-bold border ${
              isIntraState ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
            }`}>
              {isIntraState ? 'Intra-State — CGST + SGST applies' : 'Inter-State — IGST applies'}
            </div>
          </div>
        </div>

        {/* Item Lines */}
        <div className="glass rounded-xl border border-gray-800 overflow-hidden">
          <div className="px-5 py-3.5 bg-[#111827]/40 border-b border-gray-800 flex justify-between items-center">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-500">Medicine / Item Lines</h3>
            <button
              type="button"
              onClick={addRow}
              className="flex items-center gap-1 text-[10px] font-bold bg-amber-500/10 text-amber-500 px-2.5 py-1 rounded border border-amber-500/20 hover:bg-amber-500 hover:text-[#0a0e1a] cursor-pointer"
            >
              <Plus className="h-3 w-3" /> Add Item
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-gray-400 font-bold uppercase border-b border-gray-800">
                  <th className="p-3">Product</th>
                  <th className="p-3">Batch (Expiry / MRP / Stock)</th>
                  <th className="p-3 w-20">Qty</th>
                  <th className="p-3 w-28">Rate (₹)</th>
                  <th className="p-3 w-16 text-right">GST%</th>
                  <th className="p-3 w-28 text-right">Taxable</th>
                  <th className="p-3 w-28 text-right">Amount</th>
                  <th className="p-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/40">
                {rows.map((row, idx) => {
                  const priced = pricedRows[idx];
                  const availableBatches = batchesForProduct(row.productId);
                  return (
                    <tr key={idx}>
                      <td className="p-2 min-w-[180px]">
                        <div className="flex items-center gap-1">
                          <select
                            required
                            value={row.productId}
                            onChange={(e) => updateRow(idx, 'productId', e.target.value)}
                            className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-1.5 text-white outline-none text-xs"
                          >
                            <option value="">Select medicine...</option>
                            {products.map(p => (
                              <option key={p.id} value={p.id}>{p.name} {p.hsnCode ? `[HSN ${p.hsnCode}]` : ''}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            title="Add new stock item"
                            onClick={() => setQuickAddProductRowIdx(idx)}
                            className="shrink-0 p-1.5 border border-gray-800 rounded-lg text-amber-500 hover:bg-amber-500 hover:text-[#0a0e1a] cursor-pointer"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="p-2 min-w-[220px]">
                        <div className="flex items-center gap-1">
                          <select
                            required
                            disabled={!row.productId}
                            value={row.batchId}
                            onChange={(e) => updateRow(idx, 'batchId', e.target.value)}
                            className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-1.5 text-white outline-none text-xs disabled:opacity-40"
                          >
                            <option value="">Select batch...</option>
                            {availableBatches.map(b => (
                              <option key={b.id} value={b.id}>
                                {b.batchNumber} · Exp {new Date(b.expiryDate).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })} · MRP ₹{formatCurrency(b.mrp)} · Qty {b.currentQty}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            title="Add new batch"
                            disabled={!row.productId}
                            onClick={() => setQuickAddBatchRowIdx(idx)}
                            className="shrink-0 p-1.5 border border-gray-800 rounded-lg text-amber-500 hover:bg-amber-500 hover:text-[#0a0e1a] cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="p-2">
                        <input
                          type="number" min="1" required
                          value={row.qty}
                          onChange={(e) => updateRow(idx, 'qty', e.target.value)}
                          className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-1.5 text-white outline-none text-xs font-mono"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number" step="0.01" min="0" required
                          value={row.rate}
                          onChange={(e) => updateRow(idx, 'rate', e.target.value)}
                          className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-1.5 text-white outline-none text-xs font-mono"
                        />
                      </td>
                      <td className="p-2 text-right font-mono text-gray-400">{priced.gstRate}%</td>
                      <td className="p-2 text-right font-mono text-gray-300">{formatCurrency(priced.taxableValue)}</td>
                      <td className="p-2 text-right font-mono font-semibold text-white">{formatCurrency(priced.amount)}</td>
                      <td className="p-2 text-right">
                        <button type="button" onClick={() => removeRow(idx)} className="text-gray-500 hover:text-red-400 transition cursor-pointer">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {products.length === 0 && (
            <div className="flex items-center gap-2 text-xs text-gray-500 p-4 border-t border-gray-800/60">
              <Package className="h-4 w-4" /> No stock items found — use the <Plus className="h-3 w-3 inline text-amber-500" /> button in the Product column to add one.
            </div>
          )}

          {/* Totals footer */}
          <div className="bg-[#111827]/40 border-t border-gray-800 p-5 flex flex-col md:flex-row md:justify-end gap-6 text-xs font-mono">
            <div className="text-right">
              <span className="text-gray-400 block">Taxable Value</span>
              <span className="text-white font-bold text-sm">₹{formatCurrency(totals.subTotal)}</span>
            </div>
            <div className="text-right">
              <span className="text-gray-400 block">{isIntraState ? 'CGST + SGST' : 'IGST'}</span>
              <span className="text-white font-bold text-sm">₹{formatCurrency(totals.gstAmount)}</span>
            </div>
            <div className="text-right">
              <span className="text-gray-400 block">Total Payable</span>
              <span className="text-amber-500 font-bold text-base">₹{formatCurrency(totals.totalAmount)}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={createSaleMut.isPending}
            className="w-full md:w-auto flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-[#0a0e1a] font-bold px-6 py-4 rounded-xl shadow-lg shadow-amber-500/10 transition cursor-pointer disabled:opacity-50"
          >
            <Save className="h-5 w-5" /> Save & Generate GST Invoice
          </button>
        </div>
      </form>

      <QuickAddPartyModal
        open={quickAddCustomerOpen}
        onClose={() => setQuickAddCustomerOpen(false)}
        defaultType="CUSTOMER"
        onCreated={(party) => setCustomerId(party.id)}
      />
      <QuickAddProductModal
        open={quickAddProductRowIdx !== null}
        onClose={() => setQuickAddProductRowIdx(null)}
        onCreated={(product) => {
          updateRow(quickAddProductRowIdx, 'productId', product.id);
          setQuickAddBatchRowIdx(quickAddProductRowIdx);
          setQuickAddProductRowIdx(null);
        }}
      />
      <QuickAddBatchModal
        open={quickAddBatchRowIdx !== null}
        onClose={() => setQuickAddBatchRowIdx(null)}
        productId={quickAddBatchRowIdx !== null ? rows[quickAddBatchRowIdx]?.productId : null}
        productName={quickAddBatchRowIdx !== null ? products.find(p => p.id === rows[quickAddBatchRowIdx]?.productId)?.name : ''}
        onCreated={(batch) => {
          updateRow(quickAddBatchRowIdx, 'batchId', batch.id);
          setQuickAddBatchRowIdx(null);
        }}
      />
    </div>
  );
}
