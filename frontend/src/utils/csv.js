/**
 * Converts an array of row objects into a CSV string given a column spec.
 * columns: [{ key: 'name', label: 'Name' }, ...] — key supports dot paths.
 */
export function toCsv(rows, columns) {
  const escape = (value) => {
    const str = value === null || value === undefined ? '' : String(value);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const getValue = (row, key) => key.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), row);

  const header = columns.map((c) => escape(c.label)).join(',');
  const lines = rows.map((row) => columns.map((c) => escape(getValue(row, c.key))).join(','));
  return [header, ...lines].join('\r\n');
}

/** Triggers a browser download of the given CSV string. */
export function downloadCsv(filename, csvString) {
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
