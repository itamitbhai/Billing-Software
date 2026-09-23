import { Decimal } from '@prisma/client/runtime/library';

export const ZERO = new Decimal(0);
export const dec = (v) => (v instanceof Decimal ? v : new Decimal(v ?? 0));
/** Rupee amount as a JSON number rounded to 2 decimals (the return JSON carries plain numbers). */
export const money = (v) => Number(dec(v).toFixed(2));

// Unregistered inter-state invoices above this value are reported invoice-wise
// in B2CL (Table 5); at or below it they are consolidated into B2CS (Table 7).
// Rs 1,00,000 since 01-Aug-2024 (Notification 12/2024-CT), earlier Rs 2,50,000.
export const B2CL_THRESHOLD = new Decimal(100000);

// GSTN accepts up to Rs 1 difference between invoice value / tax and the
// values computed from its line items (rounding tolerance).
export const TOLERANCE = new Decimal(1);

// IFF value limit per month for B2B supplies (Rs 50 lakh).
export const IFF_MONTHLY_LIMIT = new Decimal(5000000);

// GSTN: document number up to 16 chars, alphanumeric plus "-" and "/".
export const DOC_NUMBER_PATTERN = /^[A-Za-z0-9/-]{1,16}$/;

export const SECTIONS = {
  B2B: 'B2B', B2CL: 'B2CL', B2CS: 'B2CS', EXP: 'EXP', NIL: 'NIL',
  CDNR: 'CDNR', CDNUR: 'CDNUR', HSN: 'HSN', DOC: 'DOC_ISSUE', COMPANY: 'COMPANY',
};

// Table 13 document types used by this software.
export const DOC_TYPES = {
  INVOICE: { doc_num: 1, doc_typ: 'Invoices for outward supply' },
  DEBIT_NOTE: { doc_num: 4, doc_typ: 'Debit Note' },
  CREDIT_NOTE: { doc_num: 5, doc_typ: 'Credit Note' },
};
