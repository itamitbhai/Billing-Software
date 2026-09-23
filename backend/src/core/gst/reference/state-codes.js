// GST state / UT codes (first two digits of a GSTIN, and the `pos` value in
// return JSON). 96 = Foreign Country (exports), 97 = Other Territory.
// The billing module stores Company.state / Party.state / Sale.placeOfSupply
// as free-text state *names*, so every lookup goes through resolveStateCode().

export const GST_STATES = [
  { code: '01', name: 'Jammu and Kashmir', aliases: ['jammu & kashmir', 'j&k', 'jk'] },
  { code: '02', name: 'Himachal Pradesh', aliases: ['hp'] },
  { code: '03', name: 'Punjab', aliases: [] },
  { code: '04', name: 'Chandigarh', aliases: [] },
  { code: '05', name: 'Uttarakhand', aliases: ['uttaranchal'] },
  { code: '06', name: 'Haryana', aliases: [] },
  { code: '07', name: 'Delhi', aliases: ['new delhi', 'nct of delhi'] },
  { code: '08', name: 'Rajasthan', aliases: [] },
  { code: '09', name: 'Uttar Pradesh', aliases: ['up'] },
  { code: '10', name: 'Bihar', aliases: [] },
  { code: '11', name: 'Sikkim', aliases: [] },
  { code: '12', name: 'Arunachal Pradesh', aliases: [] },
  { code: '13', name: 'Nagaland', aliases: [] },
  { code: '14', name: 'Manipur', aliases: [] },
  { code: '15', name: 'Mizoram', aliases: [] },
  { code: '16', name: 'Tripura', aliases: [] },
  { code: '17', name: 'Meghalaya', aliases: [] },
  { code: '18', name: 'Assam', aliases: [] },
  { code: '19', name: 'West Bengal', aliases: ['wb'] },
  { code: '20', name: 'Jharkhand', aliases: [] },
  { code: '21', name: 'Odisha', aliases: ['orissa'] },
  { code: '22', name: 'Chhattisgarh', aliases: ['chattisgarh'] },
  { code: '23', name: 'Madhya Pradesh', aliases: ['mp'] },
  { code: '24', name: 'Gujarat', aliases: [] },
  { code: '26', name: 'Dadra and Nagar Haveli and Daman and Diu', aliases: ['dadra & nagar haveli and daman & diu', 'daman and diu', 'daman & diu', 'dadra and nagar haveli', 'dadra & nagar haveli'] },
  { code: '27', name: 'Maharashtra', aliases: [] },
  { code: '29', name: 'Karnataka', aliases: [] },
  { code: '30', name: 'Goa', aliases: [] },
  { code: '31', name: 'Lakshadweep', aliases: [] },
  { code: '32', name: 'Kerala', aliases: [] },
  { code: '33', name: 'Tamil Nadu', aliases: ['tamilnadu', 'tn'] },
  { code: '34', name: 'Puducherry', aliases: ['pondicherry'] },
  { code: '35', name: 'Andaman and Nicobar Islands', aliases: ['andaman & nicobar islands', 'andaman and nicobar'] },
  { code: '36', name: 'Telangana', aliases: [] },
  { code: '37', name: 'Andhra Pradesh', aliases: ['ap'] },
  { code: '38', name: 'Ladakh', aliases: [] },
  { code: '96', name: 'Foreign Country', aliases: ['other country', 'overseas', 'outside india', 'export'] },
  { code: '97', name: 'Other Territory', aliases: [] },
];

export const VALID_POS_CODES = GST_STATES.map((s) => s.code);

const normalize = (s) => s.toLowerCase().replace(/\s+/g, ' ').replace(/[.]/g, '').trim();

const LOOKUP = new Map();
for (const s of GST_STATES) {
  LOOKUP.set(normalize(s.name), s.code);
  for (const a of s.aliases) LOOKUP.set(normalize(a), s.code);
}

/**
 * Resolves a free-text state value to its 2-digit GST code. Accepts a plain
 * name ("Maharashtra"), a code ("27") or the common "27-Maharashtra" form.
 * Returns null when the value cannot be resolved unambiguously.
 */
export function resolveStateCode(value) {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const codeMatch = raw.match(/^(\d{1,2})(?:\s*[-–:]\s*.*)?$/);
  if (codeMatch) {
    const code = codeMatch[1].padStart(2, '0');
    return VALID_POS_CODES.includes(code) ? code : null;
  }
  return LOOKUP.get(normalize(raw)) || null;
}

export function stateNameForCode(code) {
  return GST_STATES.find((s) => s.code === code)?.name || null;
}
