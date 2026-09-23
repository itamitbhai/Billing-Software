// Splits a GSTR-1 JSON that exceeds the portal upload limit into several
// complete, independently valid JSON files. Splitting happens only at
// document boundaries (one invoice / note), never inside a record:
//   • Part 1 carries the header plus every summary table (b2cs, nil, hsn,
//     doc_issue) — these are uploaded once, as a whole.
//   • Invoice-level tables (b2b, b2cl, exp, cdnr, cdnur) are packed greedily
//     across parts; a GSTIN/POS group split across parts is repeated with
//     its own subset of documents, which the portal merges on upload.

// Returns Offline Tool: generated GSTR-1/IFF JSON files are limited to 5 MB.
export const GST_UPLOAD_LIMIT_BYTES = 5 * 1024 * 1024;

const HEADER_KEYS = ['gstin', 'fp', 'version', 'hash'];
const SUMMARY_KEYS = ['b2cs', 'nil', 'hsn', 'doc_issue'];
// [section, group key, child array key] — order matches the offline tool's output.
const DOC_SECTIONS = [
  ['b2b', 'ctin', 'inv'],
  ['b2cl', 'pos', 'inv'],
  ['exp', 'exp_typ', 'inv'],
  ['cdnr', 'ctin', 'nt'],
  ['cdnur', null, null],
];
const SECTION_ORDER = ['b2b', 'b2cl', 'b2cs', 'exp', 'cdnr', 'cdnur', 'nil', 'hsn', 'doc_issue'];

export const byteSize = (obj) => Buffer.byteLength(JSON.stringify(obj), 'utf8');

/** Canonical key order so every part looks like an offline-tool file. */
function ordered(part) {
  const out = {};
  for (const k of [...HEADER_KEYS, ...SECTION_ORDER]) if (part[k] !== undefined) out[k] = part[k];
  return out;
}

/** Flattens invoice-level tables into one unit per document. */
function documentUnits(payload) {
  const units = [];
  for (const [section, groupKey, childKey] of DOC_SECTIONS) {
    for (const entry of payload[section] || []) {
      if (!groupKey) {
        units.push({ section, group: null, record: entry });
        continue;
      }
      const { [childKey]: children, ...groupFields } = entry;
      for (const record of children) units.push({ section, groupKey, childKey, groupFields, group: entry[groupKey], record });
    }
  }
  return units;
}

function addUnit(part, u) {
  if (!part[u.section]) part[u.section] = [];
  const list = part[u.section];
  if (!u.groupKey) { list.push(u.record); return; }
  let group = list.find((g) => g[u.groupKey] === u.group);
  if (!group) { group = { ...u.groupFields, [u.childKey]: [] }; list.push(group); }
  group[u.childKey].push(u.record);
}

/**
 * @returns {{ parts: object[], split: boolean }} every part ≤ limitBytes
 * @throws when the summary tables alone, or a single document, exceed the limit
 */
export function splitPayload(payload, limitBytes = GST_UPLOAD_LIMIT_BYTES) {
  if (byteSize(payload) <= limitBytes) return { parts: [ordered(payload)], split: false };

  const header = Object.fromEntries(HEADER_KEYS.map((k) => [k, payload[k]]));
  const first = { ...header };
  for (const k of SUMMARY_KEYS) if (payload[k] !== undefined) first[k] = payload[k];
  if (byteSize(first) > limitBytes) {
    const err = new Error('The summary tables (B2CS, Nil, HSN, Documents) alone exceed the upload limit; they cannot be split across files.');
    err.status = 422;
    throw err;
  }

  const parts = [first];
  let current = first;
  // Running size is tracked incrementally; the per-unit upper bound (record
  // + comma + a possible new group/section wrapper) keeps it conservative.
  let currentSize = byteSize(current);
  for (const u of documentUnits(payload)) {
    const recordSize = byteSize(u.record) + 1;
    const wrapperSize = u.groupKey ? byteSize({ ...u.groupFields, [u.childKey]: [] }) + 1 : 0;
    const sectionSize = u.section.length + 6;
    const worst = recordSize + wrapperSize + sectionSize;

    if (currentSize + worst > limitBytes) {
      if (byteSize(header) + worst > limitBytes) {
        const err = new Error(`Document ${u.record.inum || u.record.nt_num} alone exceeds the upload limit.`);
        err.status = 422;
        throw err;
      }
      current = { ...header };
      parts.push(current);
      currentSize = byteSize(current);
    }
    addUnit(current, u);
    currentSize += worst;
  }

  const result = parts.map(ordered);
  for (const p of result) {
    if (byteSize(p) > limitBytes) throw new Error('Internal error: a split part exceeds the upload limit.');
  }
  return { parts: result, split: result.length > 1 };
}
