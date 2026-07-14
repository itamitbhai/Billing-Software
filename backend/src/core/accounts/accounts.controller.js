import * as accountsService from './accounts.service.js';

// ============================================
// LEDGER GROUPS
// ============================================

export async function listGroups(req, res, next) {
  try {
    const groups = await accountsService.listGroups(req.user.companyId);
    res.json({ success: true, count: groups.length, data: groups });
  } catch (err) { next(err); }
}

export async function getGroup(req, res, next) {
  try {
    const group = await accountsService.getGroup(req.user.companyId, req.params.id);
    res.json({ success: true, data: group });
  } catch (err) { next(err); }
}

export async function createGroup(req, res, next) {
  try {
    const { name, nature, parentId } = req.body;
    if (!name || !nature) {
      return res.status(400).json({ success: false, message: 'Fields "name" and "nature" are required.' });
    }
    const VALID_NATURES = ['ASSET', 'LIABILITY', 'INCOME', 'EXPENSE', 'EQUITY'];
    if (!VALID_NATURES.includes(nature)) {
      return res.status(400).json({ success: false, message: `Nature must be one of: ${VALID_NATURES.join(', ')}.` });
    }
    const group = await accountsService.createGroup(req.user.companyId, { name, nature, parentId });
    res.status(201).json({ success: true, message: 'Ledger group created.', data: group });
  } catch (err) { next(err); }
}

export async function updateGroup(req, res, next) {
  try {
    const { name, parentId } = req.body;
    const group = await accountsService.updateGroup(req.user.companyId, req.params.id, { name, parentId });
    res.json({ success: true, message: 'Ledger group updated.', data: group });
  } catch (err) { next(err); }
}

export async function deleteGroup(req, res, next) {
  try {
    const result = await accountsService.deleteGroup(req.user.companyId, req.params.id);
    res.json({ success: true, message: 'Ledger group deleted.', data: result });
  } catch (err) { next(err); }
}

// ============================================
// LEDGERS
// ============================================

export async function listLedgers(req, res, next) {
  try {
    const ledgers = await accountsService.listLedgers(req.user.companyId, { groupId: req.query.groupId });
    res.json({ success: true, count: ledgers.length, data: ledgers });
  } catch (err) { next(err); }
}

export async function getLedger(req, res, next) {
  try {
    const ledger = await accountsService.getLedger(req.user.companyId, req.params.id);
    res.json({ success: true, data: ledger });
  } catch (err) { next(err); }
}

export async function createLedger(req, res, next) {
  try {
    const { name, groupId, openingBalance, openingBalanceType } = req.body;
    if (!name || !groupId) {
      return res.status(400).json({ success: false, message: 'Fields "name" and "groupId" are required.' });
    }
    const ledger = await accountsService.createLedger(req.user.companyId, { name, groupId, openingBalance, openingBalanceType });
    res.status(201).json({ success: true, message: 'Ledger created.', data: ledger });
  } catch (err) { next(err); }
}

export async function updateLedger(req, res, next) {
  try {
    const { name, groupId, openingBalance, openingBalanceType } = req.body;
    const ledger = await accountsService.updateLedger(req.user.companyId, req.params.id, { name, groupId, openingBalance, openingBalanceType });
    res.json({ success: true, message: 'Ledger updated.', data: ledger });
  } catch (err) { next(err); }
}

export async function deleteLedger(req, res, next) {
  try {
    const result = await accountsService.deleteLedger(req.user.companyId, req.params.id);
    res.json({ success: true, message: 'Ledger deleted.', data: result });
  } catch (err) { next(err); }
}
