import { getOrCreateFinancialYear } from './voucher-sequence.js';

/**
 * Seeds the default Tally-standard chart of accounts, GST tax ledgers, and
 * the current financial year for a newly-registered company.
 *
 * Called once from auth.service.registerCeo() inside the same transaction
 * that creates the Company + first ADMIN user.
 *
 * @param {object} tx        - Prisma transaction client
 * @param {string} companyId - The company's UUID
 */
export async function seedTallyDefaults(tx, companyId) {
  // ── 1. Default Financial Year (also seeds VoucherSequence rows) ────────
  await getOrCreateFinancialYear(tx, companyId, new Date());

  // ── 2. Default Ledger Groups (Tally Standard Chart of Accounts) ────────
  const rootGroups = [
    { name: 'Capital Account', nature: 'EQUITY' },
    { name: 'Reserves & Surplus', nature: 'EQUITY' },
    { name: 'Loans (Liability)', nature: 'LIABILITY' },
    { name: 'Current Liabilities', nature: 'LIABILITY' },
    { name: 'Fixed Assets', nature: 'ASSET' },
    { name: 'Current Assets', nature: 'ASSET' },
    { name: 'Income', nature: 'INCOME' },
    { name: 'Expenses', nature: 'EXPENSE' },
  ];

  const groupIdByName = {};
  for (const g of rootGroups) {
    const created = await tx.ledgerGroup.create({
      data: { companyId, name: g.name, nature: g.nature, isSystem: true },
    });
    groupIdByName[g.name] = created.id;
  }

  const childGroups = [
    { name: 'Secured Loans', nature: 'LIABILITY', parent: 'Loans (Liability)' },
    { name: 'Unsecured Loans', nature: 'LIABILITY', parent: 'Loans (Liability)' },
    { name: 'Duties & Taxes', nature: 'LIABILITY', parent: 'Current Liabilities' },
    { name: 'Provisions', nature: 'LIABILITY', parent: 'Current Liabilities' },
    { name: 'Sundry Creditors', nature: 'LIABILITY', parent: 'Current Liabilities' },
    { name: 'Cash-in-Hand', nature: 'ASSET', parent: 'Current Assets' },
    { name: 'Bank Accounts', nature: 'ASSET', parent: 'Current Assets' },
    { name: 'Stock-in-Hand', nature: 'ASSET', parent: 'Current Assets' },
    { name: 'Sundry Debtors', nature: 'ASSET', parent: 'Current Assets' },
    { name: 'Duties & Taxes (Input)', nature: 'ASSET', parent: 'Current Assets' },
    { name: 'Sales Accounts', nature: 'INCOME', parent: 'Income' },
    { name: 'Direct Income', nature: 'INCOME', parent: 'Income' },
    { name: 'Purchase Accounts', nature: 'EXPENSE', parent: 'Expenses' },
    { name: 'Direct Expenses', nature: 'EXPENSE', parent: 'Expenses' },
    { name: 'Indirect Expenses', nature: 'EXPENSE', parent: 'Expenses' },
  ];

  for (const cg of childGroups) {
    const created = await tx.ledgerGroup.create({
      data: {
        companyId,
        name: cg.name,
        nature: cg.nature,
        isSystem: true,
        parentId: groupIdByName[cg.parent],
      },
    });
    groupIdByName[cg.name] = created.id;
  }

  // ── 3. Default Ledgers ───────────────────────────────────────────────
  const defaultLedgers = [
    { name: 'Cash', groupName: 'Cash-in-Hand', isSystem: true },
    { name: 'Sales Ledger', groupName: 'Sales Accounts', isSystem: true },
    { name: 'Purchase Ledger', groupName: 'Purchase Accounts', isSystem: true },
    { name: 'Output CGST', groupName: 'Duties & Taxes', isSystem: true },
    { name: 'Output SGST', groupName: 'Duties & Taxes', isSystem: true },
    { name: 'Output IGST', groupName: 'Duties & Taxes', isSystem: true },
    { name: 'Input CGST', groupName: 'Duties & Taxes (Input)', isSystem: true },
    { name: 'Input SGST', groupName: 'Duties & Taxes (Input)', isSystem: true },
    { name: 'Input IGST', groupName: 'Duties & Taxes (Input)', isSystem: true },
  ];

  for (const l of defaultLedgers) {
    await tx.ledger.create({
      data: {
        companyId,
        name: l.name,
        groupId: groupIdByName[l.groupName],
        openingBalance: 0,
        openingBalanceType: 'DEBIT',
        isSystem: l.isSystem,
      },
    });
  }

  // ── 4. Default Cost Centre ───────────────────────────────────────────
  await tx.costCentre.create({
    data: { companyId, name: 'Main Location' },
  });
}
