// Validates a generated GSTR-1 JSON against the bundled JSON Schema and turns
// Ajv errors into rows the user can act on (section / document / field).

import { readFileSync } from 'node:fs';
import Ajv from 'ajv';
import { gstinError } from '../reference/gstin.js';

export const SCHEMA_VERSION = 'GST3.2.4';
export const SCHEMA_ID = `gstr1-offline-${SCHEMA_VERSION}`;

const schema = JSON.parse(readFileSync(new URL(`./schema/${SCHEMA_ID}.schema.json`, import.meta.url), 'utf8'));
const ajv = new Ajv({ allErrors: true, strict: false, multipleOfPrecision: 6 });
const validateFn = ajv.compile(schema);

const SECTION_LABELS = { b2b: 'B2B', b2cl: 'B2CL', b2cs: 'B2CS', exp: 'EXP', cdnr: 'CDNR', cdnur: 'CDNUR', nil: 'NIL', hsn: 'HSN', doc_issue: 'DOC_ISSUE' };

const FIELD_LABELS = {
  ctin: 'GSTIN', gstin: 'GSTIN', inum: 'Invoice Number', idt: 'Invoice Date', val: 'Invoice Value', pos: 'POS',
  rchrg: 'Reverse Charge', inv_typ: 'Invoice Type', txval: 'Taxable Value', rt: 'GST Rate', iamt: 'IGST', camt: 'CGST',
  samt: 'SGST', csamt: 'Cess', nt_num: 'Note Number', nt_dt: 'Note Date', ntty: 'Note Type', hsn_sc: 'HSN', uqc: 'UQC',
  qty: 'Quantity', fp: 'Return Period', version: 'Schema Version', sply_ty: 'Supply Type', sbpcode: 'Port Code',
  sbnum: 'Shipping Bill No', sbdt: 'Shipping Bill Date', from: 'From', to: 'To',
};

const SUGGESTIONS = {
  pattern: 'Value format does not match the GST specification; correct the source record.',
  enum: 'Value is not one of the values GST accepts; correct the source record.',
  required: 'A mandatory GST field is missing; fill it in the source record.',
  type: 'Wrong data type — this indicates a mapping problem; please report it.',
  additionalProperties: 'Field not part of the GST format — this indicates a mapping problem; please report it.',
  multipleOf: 'Amounts must have at most 2 decimals.',
  minimum: 'Negative amount not allowed here; use a credit note instead.',
  exclusiveMinimum: 'Amount must be greater than zero.',
};

/** Resolves an Ajv instancePath back to the document it belongs to. */
function locate(payload, instancePath) {
  const parts = instancePath.split('/').filter(Boolean);
  const section = SECTION_LABELS[parts[0]] || 'HEADER';
  let node = payload;
  let document = null;
  for (const p of parts) {
    node = node?.[p];
    if (node && typeof node === 'object' && !Array.isArray(node)) {
      document = node.inum || node.nt_num || (node.hsn_sc ? `HSN ${node.hsn_sc}` : null) || document;
      if (!document && node.ctin) document = node.ctin;
      if (!document && node.pos && node.rt !== undefined) document = `${node.sply_ty || ''} POS ${node.pos} @ ${node.rt}%`;
    }
  }
  const last = [...parts].reverse().find((p) => !/^\d+$/.test(p));
  return { section, document, fieldKey: last || null };
}

/**
 * @returns {{ valid: boolean, schemaId: string, errors: Array<{section,document,field,path,message,suggestion}> }}
 */
export function validateGstr1Json(payload) {
  const valid = validateFn(payload);
  const errors = [];
  const seen = new Set();

  for (const e of valid ? [] : validateFn.errors) {
    // Errors raised inside individual oneOf branches are noise — the oneOf
    // failure itself is reported. `if` merely wraps the `then` error.
    if (e.schemaPath.includes('/oneOf/') || e.keyword === 'if') continue;
    const path = e.keyword === 'required' ? `${e.instancePath}/${e.params.missingProperty}` : e.keyword === 'additionalProperties' ? `${e.instancePath}/${e.params.additionalProperty}` : e.instancePath;
    const { section, document, fieldKey } = locate(payload, path);
    const key = `${path}|${e.keyword}`;
    if (seen.has(key)) continue;
    seen.add(key);
    errors.push({
      section,
      document,
      field: FIELD_LABELS[fieldKey] || fieldKey,
      path: path || '/',
      message: e.keyword === 'oneOf' ? 'Tax heads do not match the supply type (IGST for inter-state, CGST+SGST for intra-state).' : `${e.message}${e.params?.allowedValues ? ` (${e.params.allowedValues.join(', ')})` : ''}`,
      suggestion: SUGGESTIONS[e.keyword] || 'Correct the source record and prepare again.',
    });
  }

  // The GSTIN check digit is beyond JSON Schema; verify it here so a
  // structurally-valid but mistyped GSTIN never passes.
  const checkGstin = (value, path) => {
    if (errors.some((e) => e.path === path)) return; // already reported by the schema pattern
    const err = value && gstinError(value);
    if (err) {
      const { section, document } = locate(payload, path);
      errors.push({ section, document: document || value, field: 'GSTIN', path, message: err, suggestion: 'Correct the GSTIN in the party / company master.' });
    }
  };
  checkGstin(payload.gstin, '/gstin');
  (payload.b2b || []).forEach((g, i) => checkGstin(g.ctin, `/b2b/${i}/ctin`));
  (payload.cdnr || []).forEach((g, i) => checkGstin(g.ctin, `/cdnr/${i}/ctin`));

  return { valid: errors.length === 0, schemaId: SCHEMA_ID, errors };
}
