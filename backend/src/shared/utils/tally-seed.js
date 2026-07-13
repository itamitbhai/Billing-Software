import crypto from 'crypto';

/**
 * Seeds the default Tally-standard ledger groups, INR currency, and the
 * current financial year into a freshly-provisioned tenant schema.
 *
 * Called once from auth.service.registerCeo() after schema initialisation.
 *
 * @param {object} tenantPrisma - PrismaClient bound to the tenant schema
 * @param {string} companyId    - The company's UUID
 */
export async function seedTallyDefaults(tenantPrisma, companyId) {
  const now = new Date();

  // ── 1. Default Currency (INR) ──────────────────────────────────────────
  await tenantPrisma.$executeRawUnsafe(
    `INSERT INTO "currencies" ("id","name","symbol","code","isDefault","companyId","createdAt","updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT DO NOTHING`,
    crypto.randomUUID(), 'Indian Rupee', '₹', 'INR', true, companyId, now, now
  );

  // ── 2. Default Financial Year ──────────────────────────────────────────
  const fyStart = new Date(now.getFullYear(), 3, 1);    // 1 April current year
  const fyEnd   = new Date(now.getFullYear() + 1, 2, 31); // 31 March next year
  if (now < fyStart) { fyStart.setFullYear(fyStart.getFullYear() - 1); fyEnd.setFullYear(fyEnd.getFullYear() - 1); }
  const fyName  = `${fyStart.getFullYear()}-${String(fyEnd.getFullYear()).slice(2)}`;

  await tenantPrisma.$executeRawUnsafe(
    `INSERT INTO "financial_years" ("id","name","startDate","endDate","isActive","companyId","createdAt","updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT DO NOTHING`,
    crypto.randomUUID(), fyName, fyStart, fyEnd, true, companyId, now, now
  );

  // ── 3. Default Ledger Groups (Tally Standard Chart of Accounts) ────────
  //
  // Structure mirrors Tally ERP's default group hierarchy.
  // isSystem = true → protected groups that cannot be deleted.
  //
  const groups = [
    // ── Equity ──────────────────────────────────
    { id: crypto.randomUUID(), name: 'Capital Account',        nature: 'EQUITY',    parentId: null, isSystem: true },
    { id: crypto.randomUUID(), name: 'Reserves & Surplus',     nature: 'EQUITY',    parentId: null, isSystem: true },
    // ── Liability ────────────────────────────────
    { id: crypto.randomUUID(), name: 'Loans (Liability)',       nature: 'LIABILITY', parentId: null, isSystem: true },
    { id: crypto.randomUUID(), name: 'Current Liabilities',     nature: 'LIABILITY', parentId: null, isSystem: true },
    // ── Asset ────────────────────────────────────
    { id: crypto.randomUUID(), name: 'Fixed Assets',            nature: 'ASSET',     parentId: null, isSystem: true },
    { id: crypto.randomUUID(), name: 'Current Assets',          nature: 'ASSET',     parentId: null, isSystem: true },
    // ── Income ───────────────────────────────────
    { id: crypto.randomUUID(), name: 'Income',                  nature: 'INCOME',    parentId: null, isSystem: true },
    // ── Expense ──────────────────────────────────
    { id: crypto.randomUUID(), name: 'Expenses',                nature: 'EXPENSE',   parentId: null, isSystem: true },
  ];

  // Insert root groups first
  for (const g of groups) {
    await tenantPrisma.$executeRawUnsafe(
      `INSERT INTO "ledger_groups" ("id","name","nature","parentId","isSystem","companyId","createdAt","updatedAt")
       VALUES ($1,$2,CAST($3 AS "LedgerNature"),$4,$5,$6,$7,$8)
       ON CONFLICT DO NOTHING`,
      g.id, g.name, g.nature, g.parentId, g.isSystem, companyId, now, now
    );
  }

  // Resolve parent IDs by name for child groups
  const groupMap = Object.fromEntries(groups.map(g => [g.name, g.id]));

  const childGroups = [
    // Under Loans (Liability)
    { id: crypto.randomUUID(), name: 'Secured Loans',          nature: 'LIABILITY', parent: 'Loans (Liability)' },
    { id: crypto.randomUUID(), name: 'Unsecured Loans',        nature: 'LIABILITY', parent: 'Loans (Liability)' },
    // Under Current Liabilities
    { id: crypto.randomUUID(), name: 'Duties & Taxes',         nature: 'LIABILITY', parent: 'Current Liabilities' },
    { id: crypto.randomUUID(), name: 'Provisions',             nature: 'LIABILITY', parent: 'Current Liabilities' },
    { id: crypto.randomUUID(), name: 'Sundry Creditors',       nature: 'LIABILITY', parent: 'Current Liabilities' },
    // Under Current Assets
    { id: crypto.randomUUID(), name: 'Cash-in-Hand',           nature: 'ASSET',     parent: 'Current Assets' },
    { id: crypto.randomUUID(), name: 'Bank Accounts',          nature: 'ASSET',     parent: 'Current Assets' },
    { id: crypto.randomUUID(), name: 'Stock-in-Hand',          nature: 'ASSET',     parent: 'Current Assets' },
    { id: crypto.randomUUID(), name: 'Sundry Debtors',         nature: 'ASSET',     parent: 'Current Assets' },
    { id: crypto.randomUUID(), name: 'Loans & Advances (Asset)', nature: 'ASSET',   parent: 'Current Assets' },
    { id: crypto.randomUUID(), name: 'Deposits (Asset)',       nature: 'ASSET',     parent: 'Current Assets' },
    // Under Income
    { id: crypto.randomUUID(), name: 'Sales Accounts',         nature: 'INCOME',    parent: 'Income' },
    { id: crypto.randomUUID(), name: 'Direct Income',          nature: 'INCOME',    parent: 'Income' },
    { id: crypto.randomUUID(), name: 'Indirect Income',        nature: 'INCOME',    parent: 'Income' },
    // Under Expenses
    { id: crypto.randomUUID(), name: 'Purchase Accounts',      nature: 'EXPENSE',   parent: 'Expenses' },
    { id: crypto.randomUUID(), name: 'Direct Expenses',        nature: 'EXPENSE',   parent: 'Expenses' },
    { id: crypto.randomUUID(), name: 'Indirect Expenses',      nature: 'EXPENSE',   parent: 'Expenses' },
  ];

  for (const cg of childGroups) {
    await tenantPrisma.$executeRawUnsafe(
      `INSERT INTO "ledger_groups" ("id","name","nature","parentId","isSystem","companyId","createdAt","updatedAt")
       VALUES ($1,$2,CAST($3 AS "LedgerNature"),$4,$5,$6,$7,$8)
       ON CONFLICT DO NOTHING`,
      cg.id, cg.name, cg.nature, groupMap[cg.parent], true, companyId, now, now
    );
  }

  // Build combined group map including child groups
  const allGroups = [...groups, ...childGroups.map(cg => ({ id: cg.id, name: cg.name }))];
  const allGroupMap = Object.fromEntries(allGroups.map(g => [g.name, g.id]));

  // ── 4. Default Ledgers ────────────────────────────────────────────────
  const defaultLedgers = [
    { name: 'Cash',            groupName: 'Cash-in-Hand',      isSystem: true },
    { name: 'Capital',         groupName: 'Capital Account',   isSystem: true },
    { name: 'Sales',           groupName: 'Sales Accounts',    isSystem: false },
    { name: 'Purchases',       groupName: 'Purchase Accounts', isSystem: false },
    { name: 'GST Payable',     groupName: 'Duties & Taxes',    isSystem: false },
    { name: 'Input GST (CGST)',groupName: 'Duties & Taxes',    isSystem: false },
    { name: 'Input GST (SGST)',groupName: 'Duties & Taxes',    isSystem: false },
    { name: 'Input GST (IGST)',groupName: 'Duties & Taxes',    isSystem: false },
  ];

  for (const l of defaultLedgers) {
    await tenantPrisma.$executeRawUnsafe(
      `INSERT INTO "ledgers" ("id","name","groupId","openingBalance","openingBalanceType","isSystem","companyId","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,CAST($5 AS "EntryType"),$6,$7,$8,$9)
       ON CONFLICT DO NOTHING`,
      crypto.randomUUID(), l.name, allGroupMap[l.groupName], 0, 'DEBIT', l.isSystem, companyId, now, now
    );
  }

  // ── 5. Default Stock Group ────────────────────────────────────────────
  await tenantPrisma.$executeRawUnsafe(
    `INSERT INTO "stock_groups" ("id","name","parentId","companyId","createdAt","updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT DO NOTHING`,
    crypto.randomUUID(), 'Primary', null, companyId, now, now
  );

  // ── 6. Default Unit ───────────────────────────────────────────────────
  await tenantPrisma.$executeRawUnsafe(
    `INSERT INTO "units" ("id","name","symbol","companyId","createdAt","updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT DO NOTHING`,
    crypto.randomUUID(), 'Numbers', 'Nos', companyId, now, now
  );

  // ── 7. Default GST Tax Rates ──────────────────────────────────────────
  const taxRates = [
    { name: 'GST 0%',  rate: 0,    cgst: 0,   sgst: 0,   igst: 0    },
    { name: 'GST 5%',  rate: 500,  cgst: 250, sgst: 250, igst: 500  },
    { name: 'GST 12%', rate: 1200, cgst: 600, sgst: 600, igst: 1200 },
    { name: 'GST 18%', rate: 1800, cgst: 900, sgst: 900, igst: 1800 },
    { name: 'GST 28%', rate: 2800, cgst: 1400, sgst: 1400, igst: 2800 },
  ];

  for (const tr of taxRates) {
    await tenantPrisma.$executeRawUnsafe(
      `INSERT INTO "tax_rates" ("id","name","rate","cgst","sgst","igst","companyId","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT DO NOTHING`,
      crypto.randomUUID(), tr.name, tr.rate, tr.cgst, tr.sgst, tr.igst, companyId, now, now
    );
  }

  // ── 8. Default Cost Centre ────────────────────────────────────────────
  await tenantPrisma.$executeRawUnsafe(
    `INSERT INTO "cost_centres" ("id","name","parentId","companyId","createdAt","updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT DO NOTHING`,
    crypto.randomUUID(), 'Main Location', null, companyId, now, now
  );
}
