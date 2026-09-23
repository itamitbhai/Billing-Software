import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Download, FileDown, CircleCheck } from 'lucide-react';
import { tallyApi } from '../../api/tally.api';
import { formatDate } from '../../utils/format';
import { downloadBlob } from '../../utils/csv';
import { RETURN_LABELS, formatBytes } from './gstExport.utils';
import { Panel } from './GstExportComponents';

export default function GstExportHistoryPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({ queryKey: ['gst-export-history', page], queryFn: () => tallyApi.gst.history({ page, limit: 20 }) });
  const rows = data?.data || [];
  const totalPages = data?.totalPages || 1;

  const save = async (fn, fileName) => {
    try {
      downloadBlob(fileName, await fn());
    } catch {
      toast.error('Download failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/gst/export')} className="p-2 border border-gray-800 text-gray-400 hover:text-white rounded-lg cursor-pointer">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-white tracking-wide">GST Export History</h2>
            <p className="text-gray-400 text-xs mt-1">Every generated GST return JSON, stored exactly as generated.</p>
          </div>
        </div>
        <Link to="/gst/export" className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-amber-400 border border-amber-500/30 rounded-lg hover:bg-amber-500/10">
          <FileDown className="h-4 w-4" /> New Export
        </Link>
      </div>

      <Panel>
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-amber-500" /></div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-500 py-6 text-center">No GST JSON has been generated yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-gray-500 border-b border-gray-800">
                  <th className="py-2 pr-3">Return</th><th className="py-2 pr-3">Period</th><th className="py-2 pr-3">GSTIN</th>
                  <th className="py-2 pr-3 text-right">Records</th><th className="py-2 pr-3 text-right">Excluded</th><th className="py-2 pr-3 text-right">Size</th>
                  <th className="py-2 pr-3">Validation</th><th className="py-2 pr-3">Generated</th><th className="py-2">Files</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((h) => (
                  <tr key={h.id} className="border-b border-gray-900 align-top">
                    <td className="py-2.5 pr-3 font-semibold text-white">{RETURN_LABELS[h.returnType] || h.returnType}<span className="block text-[10px] font-normal text-gray-500">{h.frequency === 'QUARTERLY' ? 'Quarterly' : 'Monthly'}</span></td>
                    <td className="py-2.5 pr-3 text-gray-300">{h.periodLabel}<span className="block text-[10px] text-gray-500">FY {h.financialYear} · fp {h.returnPeriod}</span></td>
                    <td className="py-2.5 pr-3 font-mono text-gray-300">{h.gstin}</td>
                    <td className="py-2.5 pr-3 text-right font-mono text-white">{h.recordCount}</td>
                    <td className={`py-2.5 pr-3 text-right font-mono ${h.excludedCount ? 'text-rose-400' : 'text-gray-500'}`}>{h.excludedCount}</td>
                    <td className="py-2.5 pr-3 text-right font-mono text-gray-300">{formatBytes(h.totalSizeBytes)}</td>
                    <td className="py-2.5 pr-3">
                      <span className="inline-flex items-center gap-1 text-emerald-400"><CircleCheck className="h-3.5 w-3.5" /> Schema Valid</span>
                      <span className="block text-[10px] text-gray-500 font-mono">{h.schemaId} · v {h.toolVersion}</span>
                    </td>
                    <td className="py-2.5 pr-3 text-gray-300">{formatDate(h.createdAt)}<span className="block text-[10px] text-gray-500">{h.createdBy?.name || '—'}</span></td>
                    <td className="py-2.5">
                      <div className="flex flex-col gap-1">
                        {h.files.map((f) => (
                          <button key={f.partNo} onClick={() => save(() => tallyApi.gst.downloadFile(h.id, f.partNo), f.fileName)}
                            className="flex items-center gap-1.5 text-left text-amber-400 hover:underline cursor-pointer" title={`SHA-256 ${f.sha256}`}>
                            <Download className="h-3 w-3 shrink-0" /> {h.files.length > 1 ? `Part ${f.partNo}` : 'JSON'} ({formatBytes(f.sizeBytes)})
                          </button>
                        ))}
                        <button onClick={() => save(() => tallyApi.gst.downloadErrors(h.id), `GST_Export_Errors_${h.returnPeriod}.csv`)}
                          className="flex items-center gap-1.5 text-left text-gray-400 hover:text-white cursor-pointer">
                          <Download className="h-3 w-3 shrink-0" /> Error report
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex justify-end gap-2 mt-4">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1 text-xs border border-gray-800 rounded-lg text-gray-300 disabled:opacity-40">Previous</button>
            <span className="px-2 py-1 text-xs text-gray-500">Page {page} of {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1 text-xs border border-gray-800 rounded-lg text-gray-300 disabled:opacity-40">Next</button>
          </div>
        )}
      </Panel>
    </div>
  );
}
