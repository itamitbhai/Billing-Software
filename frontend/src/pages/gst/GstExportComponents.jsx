import React from 'react';
import { SECTION_LABELS } from './gstExport.utils';

export function Panel({ title, right, children, className = '' }) {
  return (
    <div className={`bg-[#111827]/40 rounded-xl border border-gray-800 ${className}`}>
      {title && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-800">
          <h4 className="text-[11px] font-bold text-white uppercase tracking-wider">{title}</h4>
          {right}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

export function IssueTable({ rows, empty = 'No issues.' }) {
  if (!rows.length) return <p className="text-xs text-gray-500">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wider text-gray-500 border-b border-gray-800">
            <th className="py-2 pr-3">Section</th><th className="py-2 pr-3">Document</th><th className="py-2 pr-3">Field</th>
            <th className="py-2 pr-3">Error</th><th className="py-2">Suggested correction</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-gray-900 align-top">
              <td className="py-2 pr-3 text-gray-300 whitespace-nowrap">{SECTION_LABELS[r.section] || r.section}</td>
              <td className="py-2 pr-3 font-mono text-white whitespace-nowrap">
                {r.documentNumber || r.document || '—'}
                {r.party && <span className="block font-sans text-[10px] text-gray-500">{r.party}</span>}
              </td>
              <td className="py-2 pr-3 text-amber-400 whitespace-nowrap">{r.field}</td>
              <td className={`py-2 pr-3 ${r.severity === 'warning' ? 'text-amber-200' : 'text-rose-300'}`}>{r.message}</td>
              <td className="py-2 text-gray-400">{r.suggestion}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
