import React, { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { tallyApi } from '../../api/tally.api';
import { Loader2, Printer, Undo2 } from 'lucide-react';
import { formatCurrency } from '../../utils/format';
import { amountInWords } from '../../utils/numberToWords';

function formatDDMMMYY(date) {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
}

export default function InvoicePrint() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: saleRes, isLoading: saleLoading } = useQuery({
    queryKey: ['sale', id],
    queryFn: () => tallyApi.billing.sales.get(id),
  });
  const { data: companyRes, isLoading: companyLoading } = useQuery({
    queryKey: ['company-profile'],
    queryFn: tallyApi.utilities.company.get,
  });

  const sale = saleRes?.data;
  const company = companyRes?.data;

  // Interstate (IGST) only when at least one line actually carries IGST; defaults to
  // intra-state (CGST+SGST) otherwise, matching the backend's isIntraState() default.
  const isIntraState = useMemo(() => {
    if (!sale) return true;
    return !sale.items?.some(i => Number(i.igstAmount) > 0);
  }, [sale]);

  // HSN/SAC-wise GST summary, rate-wise (required for GSTR-1 style reporting on the invoice)
  const hsnSummary = useMemo(() => {
    if (!sale) return [];
    const map = new Map();
    for (const item of sale.items) {
      const key = `${item.hsnCode || '-'}__${item.gstRate}`;
      const existing = map.get(key) || {
        hsnCode: item.hsnCode || '-',
        gstRate: Number(item.gstRate),
        taxableValue: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
      };
      existing.taxableValue += Number(item.taxableValue);
      existing.cgstAmount += Number(item.cgstAmount);
      existing.sgstAmount += Number(item.sgstAmount);
      existing.igstAmount += Number(item.igstAmount);
      map.set(key, existing);
    }
    return Array.from(map.values());
  }, [sale]);

  const totals = useMemo(() => {
    if (!sale) return null;
    const cgstTotal = sale.items.reduce((s, i) => s + Number(i.cgstAmount), 0);
    const sgstTotal = sale.items.reduce((s, i) => s + Number(i.sgstAmount), 0);
    const igstTotal = sale.items.reduce((s, i) => s + Number(i.igstAmount), 0);
    const totalQty = sale.items.reduce((s, i) => s + Number(i.qty), 0);
    return { cgstTotal, sgstTotal, igstTotal, totalQty };
  }, [sale]);

  if (saleLoading || companyLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 text-gray-600">
        Sale invoice not found.
      </div>
    );
  }

  const customer = sale.customer;
  const unit = (item) => item.batch?.product?.unit || 'PCS';

  return (
    <div className="min-h-screen bg-gray-200 py-6 print:bg-white print:py-0">
      <style>{`
        @media print {
          @page { size: A4; margin: 8mm; }
          .no-print { display: none !important; }
          body { background: white; }
        }
      `}</style>

      {/* Toolbar */}
      <div className="no-print max-w-[210mm] mx-auto mb-4 flex items-center justify-between px-2">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg text-xs font-semibold shadow-sm"
        >
          <Undo2 className="h-4 w-4" /> Back
        </button>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-[#0a0e1a] font-bold rounded-lg text-xs shadow-sm"
        >
          <Printer className="h-4 w-4" /> Print GST Invoice
        </button>
      </div>

      {/* ── Printable Invoice Sheet ── */}
      <div className="max-w-[210mm] mx-auto bg-white text-black text-[11px] leading-tight font-sans border border-black print:border-0 shadow-lg print:shadow-none">
        <h1 className="text-center font-bold text-sm py-1.5 border-b border-black">Tax Invoice</h1>

        {/* Seller + Invoice meta */}
        <div className="grid grid-cols-2">
          <div className="p-2 border-r border-b border-black">
            <p className="font-bold text-[13px]">{company?.name || 'Your Company Name'}</p>
            <p className="whitespace-pre-line">{company?.address}</p>
            {company?.dlNumber && <p>D L NO {company.dlNumber}</p>}
            <p>{company?.state}{company?.state ? ', India' : ''}</p>
            {company?.gstin && <p>GSTIN/UIN: {company.gstin}</p>}
            {company?.state && <p>State Name : {company.state}</p>}
            {(company?.phone || company?.email) && (
              <p>{company?.phone ? `Contact : ${company.phone}` : ''}{company?.phone && company?.email ? '  ' : ''}{company?.email ? `E-Mail : ${company.email}` : ''}</p>
            )}
          </div>
          <div className="grid grid-cols-2 text-[10.5px]">
            <div className="p-1.5 border-b border-r border-black">Invoice No.<br /><span className="font-bold">{sale.invoiceNumber}</span></div>
            <div className="p-1.5 border-b border-black">Dated<br /><span className="font-bold">{formatDDMMMYY(sale.saleDate)}</span></div>
            <div className="p-1.5 border-b border-r border-black">Reference No. &amp; Date<br />&nbsp;</div>
            <div className="p-1.5 border-b border-black">Other References<br />&nbsp;</div>
            <div className="p-1.5 border-b border-r border-black">Buyer's Order No.<br />&nbsp;</div>
            <div className="p-1.5 border-b border-black">Dated<br />&nbsp;</div>
            <div className="p-1.5 border-r border-black">Terms of Payment<br />&nbsp;</div>
            <div className="p-1.5">Place of Supply<br /><span className="font-bold">{sale.placeOfSupply || '-'}</span></div>
          </div>
        </div>

        {/* Buyer */}
        <div className="p-2 border-b border-black">
          <p className="font-bold">Buyer (Bill to)</p>
          <p className="font-bold text-[13px]">{customer?.name}</p>
          <p className="whitespace-pre-line">{customer?.address}</p>
          {customer?.dlNumber && <p>DL No. {customer.dlNumber}</p>}
          {customer?.phone && <p>Mobile No. {customer.phone}</p>}
          <p>{[customer?.city, customer?.state, customer?.pincode].filter(Boolean).join(', ')}{customer?.state ? ', India' : ''}</p>
          {customer?.gstin && <p>GSTIN/UIN : {customer.gstin}</p>}
          {customer?.state && <p>State Name : {customer.state}</p>}
        </div>

        {/* Items table */}
        <table className="w-full border-collapse text-[10.5px]">
          <thead>
            <tr className="border-b border-black">
              <th className="border-r border-black p-1 w-8">Sl No.</th>
              <th className="border-r border-black p-1 text-left">Description of Goods</th>
              <th className="border-r border-black p-1 w-16">HSN/SAC</th>
              <th className="border-r border-black p-1 w-12">GST Rate</th>
              <th className="border-r border-black p-1 w-16">MRP</th>
              <th className="border-r border-black p-1 w-14">Qty</th>
              <th className="border-r border-black p-1 w-16">Rate</th>
              <th className="border-r border-black p-1 w-10">per</th>
              <th className="p-1 w-20 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((item, idx) => (
              <tr key={item.id} className="border-b border-black/20 align-top">
                <td className="border-r border-black p-1 text-center">{idx + 1}</td>
                <td className="border-r border-black p-1">
                  <p className="font-semibold">{item.batch?.product?.name}</p>
                  <p className="text-[9.5px] text-gray-700">Batch : {item.batch?.batchNumber}</p>
                  <p className="text-[9.5px] text-gray-700">Expiry : {formatDDMMMYY(item.batch?.expiryDate)}</p>
                </td>
                <td className="border-r border-black p-1 text-center">{item.hsnCode || '-'}</td>
                <td className="border-r border-black p-1 text-center">{Number(item.gstRate)}%</td>
                <td className="border-r border-black p-1 text-right">{formatCurrency(item.batch?.mrp)}</td>
                <td className="border-r border-black p-1 text-right">{item.qty} {unit(item)}</td>
                <td className="border-r border-black p-1 text-right">{formatCurrency(item.rate)}</td>
                <td className="border-r border-black p-1 text-center">{unit(item)}</td>
                <td className="p-1 text-right">{formatCurrency(item.taxableValue)}</td>
              </tr>
            ))}

            <tr className="border-t border-black">
              <td colSpan={5} className="border-r border-black"></td>
              <td className="border-r border-black p-1 text-right font-semibold">{totals.totalQty} {unit(sale.items[0] || {})}</td>
              <td colSpan={2} className="border-r border-black"></td>
              <td className="p-1 text-right font-semibold">{formatCurrency(sale.subTotal)}</td>
            </tr>
            {totals.cgstTotal > 0 && (
              <tr>
                <td colSpan={8} className="text-right p-1 pr-2 italic">CGST</td>
                <td className="p-1 text-right">{formatCurrency(totals.cgstTotal)}</td>
              </tr>
            )}
            {totals.sgstTotal > 0 && (
              <tr>
                <td colSpan={8} className="text-right p-1 pr-2 italic">SGST</td>
                <td className="p-1 text-right">{formatCurrency(totals.sgstTotal)}</td>
              </tr>
            )}
            {totals.igstTotal > 0 && (
              <tr>
                <td colSpan={8} className="text-right p-1 pr-2 italic">IGST</td>
                <td className="p-1 text-right">{formatCurrency(totals.igstTotal)}</td>
              </tr>
            )}
            <tr className="border-t border-black font-bold">
              <td colSpan={5} className="border-r border-black p-1">Total</td>
              <td className="border-r border-black p-1 text-right">{totals.totalQty} {unit(sale.items[0] || {})}</td>
              <td colSpan={2} className="border-r border-black"></td>
              <td className="p-1 text-right">₹ {formatCurrency(sale.totalAmount)}</td>
            </tr>
          </tbody>
        </table>

        {/* Amount in words */}
        <div className="p-2 border-b border-black flex justify-between items-start">
          <div>
            <p className="text-[10px] italic">Amount Chargeable (in words)</p>
            <p className="font-bold">{amountInWords(sale.totalAmount)}</p>
          </div>
          <p className="text-[10px] italic whitespace-nowrap">E. &amp; O.E</p>
        </div>

        {/* HSN-wise GST summary */}
        <table className="w-full border-collapse text-[10.5px] border-b border-black">
          <thead>
            <tr className="border-b border-black">
              <th rowSpan={2} className="border-r border-black p-1 align-middle">HSN/SAC</th>
              <th rowSpan={2} className="border-r border-black p-1 align-middle">Taxable Value</th>
              {isIntraState ? (
                <>
                  <th colSpan={2} className="border-r border-black p-1">CGST</th>
                  <th colSpan={2} className="border-r border-black p-1">SGST/UTGST</th>
                </>
              ) : (
                <th colSpan={2} className="border-r border-black p-1">IGST</th>
              )}
              <th rowSpan={2} className="p-1 align-middle">Total Tax Amount</th>
            </tr>
            <tr className="border-b border-black">
              {isIntraState ? (
                <>
                  <th className="border-r border-black p-1 w-14">Rate</th>
                  <th className="border-r border-black p-1 w-16">Amount</th>
                  <th className="border-r border-black p-1 w-14">Rate</th>
                  <th className="border-r border-black p-1 w-16">Amount</th>
                </>
              ) : (
                <>
                  <th className="border-r border-black p-1 w-14">Rate</th>
                  <th className="border-r border-black p-1 w-16">Amount</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {hsnSummary.map((row) => (
              <tr key={`${row.hsnCode}-${row.gstRate}`} className="border-b border-black/20">
                <td className="border-r border-black p-1 text-center">{row.hsnCode}</td>
                <td className="border-r border-black p-1 text-right">{formatCurrency(row.taxableValue)}</td>
                {isIntraState ? (
                  <>
                    <td className="border-r border-black p-1 text-center">{(row.gstRate / 2).toFixed(2)}%</td>
                    <td className="border-r border-black p-1 text-right">{formatCurrency(row.cgstAmount)}</td>
                    <td className="border-r border-black p-1 text-center">{(row.gstRate / 2).toFixed(2)}%</td>
                    <td className="border-r border-black p-1 text-right">{formatCurrency(row.sgstAmount)}</td>
                  </>
                ) : (
                  <>
                    <td className="border-r border-black p-1 text-center">{row.gstRate.toFixed(2)}%</td>
                    <td className="border-r border-black p-1 text-right">{formatCurrency(row.igstAmount)}</td>
                  </>
                )}
                <td className="p-1 text-right">{formatCurrency(row.cgstAmount + row.sgstAmount + row.igstAmount)}</td>
              </tr>
            ))}
            <tr className="font-bold border-t border-black">
              <td className="border-r border-black p-1 text-center">Total</td>
              <td className="border-r border-black p-1 text-right">{formatCurrency(sale.subTotal)}</td>
              {isIntraState ? (
                <>
                  <td className="border-r border-black p-1"></td>
                  <td className="border-r border-black p-1 text-right">{formatCurrency(totals.cgstTotal)}</td>
                  <td className="border-r border-black p-1"></td>
                  <td className="border-r border-black p-1 text-right">{formatCurrency(totals.sgstTotal)}</td>
                </>
              ) : (
                <>
                  <td className="border-r border-black p-1"></td>
                  <td className="border-r border-black p-1 text-right">{formatCurrency(totals.igstTotal)}</td>
                </>
              )}
              <td className="p-1 text-right">{formatCurrency(sale.gstAmount)}</td>
            </tr>
          </tbody>
        </table>

        <div className="p-2 border-b border-black">
          <p className="text-[10px] italic">Tax Amount (in words) : <span className="font-bold not-italic">{amountInWords(sale.gstAmount)}</span></p>
        </div>

        {/* Declaration + Bank details */}
        <div className="grid grid-cols-2">
          <div className="p-2 border-r border-black">
            <p className="font-bold text-[10px]">Declaration</p>
            <p className="text-[9.5px]">We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.</p>
          </div>
          <div className="p-2">
            <p className="font-bold text-[10px]">Company's Bank Details</p>
            <p className="text-[10px]">A/c Holder's Name : {company?.name}</p>
            <p className="text-[10px]">Bank Name : {company?.bankName || '-'}</p>
            <p className="text-[10px]">A/c No. : {company?.accountNo || '-'}</p>
            <p className="text-[10px]">Branch &amp; IFS Code : {company?.ifscCode || '-'}</p>
          </div>
        </div>

        <div className="p-2 text-right text-[10px] border-b border-black">for {company?.name}</div>

        <div className="grid grid-cols-3 text-center text-[10px]">
          <div className="p-6 border-r border-black">Prepared by</div>
          <div className="p-6 border-r border-black">Verified by</div>
          <div className="p-6">Authorised Signatory</div>
        </div>

        <p className="text-center text-[9.5px] py-1 border-t border-black">This is a Computer Generated Invoice</p>
      </div>
    </div>
  );
}
