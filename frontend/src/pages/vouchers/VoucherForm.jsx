import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tallyApi } from '../../api/tally.api';
import { Plus, Trash2, Save, Undo2, Calculator, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatRupees } from '../../utils/format';
import QuickAddPartyModal from '../../components/quickadd/QuickAddPartyModal';
import QuickAddLedgerModal from '../../components/quickadd/QuickAddLedgerModal';
import QuickAddCostCentreModal from '../../components/quickadd/QuickAddCostCentreModal';

const MANUAL_TYPES = ['JOURNAL', 'CONTRA', 'CREDIT_NOTE', 'DEBIT_NOTE'];

export default function VoucherForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = !!id;
  const queryClient = useQueryClient();

  const [type, setType] = useState('JOURNAL');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [narration, setNarration] = useState('');
  const [partyId, setPartyId] = useState('');

  // Ledger rows: list of { ledgerId, type, amount, description, costCentreId }
  const [lines, setLines] = useState([
    { ledgerId: '', type: 'DEBIT', amount: '', description: '', costCentreId: '' },
    { ledgerId: '', type: 'CREDIT', amount: '', description: '', costCentreId: '' }
  ]);

  // Quick-add: create a missing Party/Ledger/Cost Centre inline instead of leaving this page.
  const [quickAddPartyOpen, setQuickAddPartyOpen] = useState(false);
  const [quickAddLedgerLineIdx, setQuickAddLedgerLineIdx] = useState(null);
  const [quickAddCostCentreLineIdx, setQuickAddCostCentreLineIdx] = useState(null);

  // ── Queries ───────────────────────────────────────────────────
  const { data: ledgersRes } = useQuery({ queryKey: ['ledgers'], queryFn: () => tallyApi.ledgers.list() });
  const { data: partiesRes } = useQuery({ queryKey: ['parties'], queryFn: () => tallyApi.parties.list() });
  const { data: costCentresRes } = useQuery({ queryKey: ['cost-centres'], queryFn: tallyApi.costCentres.list });
  const { data: voucherRes, isLoading: voucherLoading } = useQuery({
    queryKey: ['voucher', id],
    queryFn: () => tallyApi.vouchers.get(id),
    enabled: isEditMode
  });

  const ledgers = ledgersRes?.data || [];
  const parties = partiesRes?.data || [];
  const costCentres = costCentresRes?.data || [];

  // Prefill the form once the voucher being edited has loaded.
  useEffect(() => {
    const voucher = voucherRes?.data;
    if (!voucher) return;
    if (!MANUAL_TYPES.includes(voucher.type)) {
      toast.error('Only manually posted vouchers (Journal/Contra/Credit/Debit Note) can be edited.');
      navigate('/vouchers');
      return;
    }
    setType(voucher.type);
    setDate(new Date(voucher.date).toISOString().split('T')[0]);
    setNarration(voucher.narration || '');
    setPartyId(voucher.partyId || '');
    setLines((voucher.lines || []).map(l => ({
      ledgerId: l.ledgerId,
      type: l.type,
      amount: String(Number(l.amount) / 100),
      description: l.description || '',
      costCentreId: l.costCentreId || ''
    })));
  }, [voucherRes, navigate]);

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

  const updateVoucherMut = useMutation({
    mutationFn: (data) => tallyApi.vouchers.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vouchers'] });
      toast.success('Voucher updated successfully');
      navigate('/vouchers');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error updating voucher')
  });

  // ── Calculations ──────────────────────────────────────────────
  const debitsTotal = lines.filter(l => l.type === 'DEBIT').reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const creditsTotal = lines.filter(l => l.type === 'CREDIT').reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const difference = Math.abs(debitsTotal - creditsTotal);

  // ── Row Management Handlers ────────────────────────────────────
  const addLineRow = () => {
    setLines([...lines, { ledgerId: '', type: 'CREDIT', amount: '', description: '', costCentreId: '' }]);
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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (difference !== 0) return toast.error('Double-entry violation: Total Debits must match Total Credits.');

    const formattedLines = lines.map(l => ({
      ledgerId: l.ledgerId,
      type: l.type,
      amount: BigInt(Math.round(Number(l.amount) * 100)).toString(), // to paise String
      description: l.description,
      costCentreId: l.costCentreId || null,
    }));

    if (isEditMode) {
      updateVoucherMut.mutate({ date, narration, lines: formattedLines });
    } else {
      createVoucherMut.mutate({
        type,
        date,
        narration,
        partyId: partyId || null,
        lines: formattedLines
      });
    }
  };

  if (isEditMode && voucherLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading voucher...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">{isEditMode ? 'Edit Accounting Voucher' : 'Post Accounting Voucher'}</h2>
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
              disabled={isEditMode}
              onChange={(e) => setType(e.target.value)}
              className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2 text-white outline-none text-xs disabled:opacity-40"
            >
              <option value="JOURNAL">JOURNAL</option>
              <option value="CONTRA">CONTRA</option>
              <option value="CREDIT_NOTE">CREDIT NOTE</option>
              <option value="DEBIT_NOTE">DEBIT NOTE</option>
            </select>
            {!isEditMode && (
              <p className="text-[10px] text-gray-500 mt-1.5">
                Sales, Purchase, Receipt &amp; Payment are posted automatically from{' '}
                <button type="button" onClick={() => navigate('/sales/new')} className="text-amber-500 hover:underline cursor-pointer">Sales &amp; GST Bills</button>
                {' '}— they can't be posted manually here.
              </p>
            )}
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
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Ledger Party (Optional)</label>
              {!isEditMode && (
                <button type="button" onClick={() => setQuickAddPartyOpen(true)} className="flex items-center gap-0.5 text-[10px] font-bold text-amber-500 hover:underline cursor-pointer">
                  <Plus className="h-3 w-3" /> New Party
                </button>
              )}
            </div>
            <select
              value={partyId}
              disabled={isEditMode}
              onChange={(e) => setPartyId(e.target.value)}
              className="w-full bg-[#0d1224] border border-gray-800 focus:border-amber-500/50 rounded-lg p-2 text-white outline-none text-xs disabled:opacity-40"
            >
              <option value="">None / Internal Journal</option>
              {parties.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
              ))}
            </select>
            {isEditMode && (
              <p className="text-[10px] text-gray-500 mt-1.5">Voucher type and party are locked after posting — only date, narration, and lines can be amended.</p>
            )}
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
                  <div className="flex-1 min-w-[200px] flex items-center gap-1">
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
                    <button
                      type="button"
                      title="Add new ledger"
                      onClick={() => setQuickAddLedgerLineIdx(lineIdx)}
                      className="shrink-0 p-2 border border-gray-800 rounded-lg text-amber-500 hover:bg-amber-500 hover:text-[#0a0e1a] cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
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
                  <div className="flex-1 min-w-[150px] flex items-center gap-1">
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
                    <button
                      type="button"
                      title="Add new cost centre"
                      onClick={() => setQuickAddCostCentreLineIdx(lineIdx)}
                      className="shrink-0 p-2 border border-gray-800 rounded-lg text-amber-500 hover:bg-amber-500 hover:text-[#0a0e1a] cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLineRow(lineIdx)}
                    className="p-2 border border-gray-800 text-gray-500 hover:text-red-400 rounded-lg cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
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
            disabled={createVoucherMut.isPending || updateVoucherMut.isPending || difference !== 0}
            className="w-full md:w-auto flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-[#0a0e1a] font-bold px-6 py-4 rounded-xl shadow-lg shadow-amber-500/10 transition cursor-pointer disabled:opacity-50"
          >
            <Save className="h-5 w-5" /> {isEditMode ? 'Update Voucher' : 'Post Voucher Transaction'}
          </button>
        </div>
      </form>

      <QuickAddPartyModal
        open={quickAddPartyOpen}
        onClose={() => setQuickAddPartyOpen(false)}
        defaultType="BOTH"
        onCreated={(party) => setPartyId(party.id)}
      />
      <QuickAddLedgerModal
        open={quickAddLedgerLineIdx !== null}
        onClose={() => setQuickAddLedgerLineIdx(null)}
        onCreated={(ledger) => {
          handleLineChange(quickAddLedgerLineIdx, 'ledgerId', ledger.id);
          setQuickAddLedgerLineIdx(null);
        }}
      />
      <QuickAddCostCentreModal
        open={quickAddCostCentreLineIdx !== null}
        onClose={() => setQuickAddCostCentreLineIdx(null)}
        onCreated={(costCentre) => {
          handleLineChange(quickAddCostCentreLineIdx, 'costCentreId', costCentre.id);
          setQuickAddCostCentreLineIdx(null);
        }}
      />
    </div>
  );
}
