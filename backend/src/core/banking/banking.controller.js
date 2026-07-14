import * as bankingService from './banking.service.js';

export async function listBankAccounts(req, res, next) {
  try {
    const accounts = await bankingService.listBankAccounts({ companyId: req.user.companyId });
    res.json({ success: true, count: accounts.length, data: accounts });
  } catch (err) { next(err); }
}

export async function getBankAccount(req, res, next) {
  try {
    const account = await bankingService.getBankAccount({ id: req.params.id, companyId: req.user.companyId });
    res.json({ success: true, data: account });
  } catch (err) { next(err); }
}

export async function createBankAccount(req, res, next) {
  try {
    const { name, ledgerId, bankName, accountNumber } = req.body;
    if (!name || !ledgerId || !bankName || !accountNumber) {
      return res.status(400).json({ success: false, message: '"name", "ledgerId", "bankName", and "accountNumber" are required.' });
    }
    const account = await bankingService.createBankAccount({ companyId: req.user.companyId, ...req.body });
    res.status(201).json({ success: true, message: 'Bank account created.', data: account });
  } catch (err) { next(err); }
}

export async function updateBankAccount(req, res, next) {
  try {
    const account = await bankingService.updateBankAccount({ id: req.params.id, companyId: req.user.companyId, ...req.body });
    res.json({ success: true, message: 'Bank account updated.', data: account });
  } catch (err) { next(err); }
}

export async function getBankStatement(req, res, next) {
  try {
    const statement = await bankingService.getBankStatement({
      bankAccountId: req.params.id,
      companyId: req.user.companyId,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
    });
    res.json({ success: true, data: statement });
  } catch (err) { next(err); }
}

export async function getPendingReconciliation(req, res, next) {
  try {
    const lines = await bankingService.getPendingReconciliation({
      bankAccountId: req.params.id,
      companyId: req.user.companyId,
    });
    res.json({ success: true, count: lines.length, data: lines });
  } catch (err) { next(err); }
}

export async function reconcileEntry(req, res, next) {
  try {
    const { voucherLineId, statementDate, statementAmount } = req.body;
    if (!voucherLineId) return res.status(400).json({ success: false, message: '"voucherLineId" is required.' });
    const result = await bankingService.reconcileEntry({
      bankAccountId: req.params.id,
      companyId: req.user.companyId,
      voucherLineId, statementDate, statementAmount,
    });
    res.json({ success: true, message: 'Entry reconciled.', data: result });
  } catch (err) { next(err); }
}

export async function getChequeRegister(req, res, next) {
  try {
    const cheques = await bankingService.getChequeRegister({
      companyId: req.user.companyId,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
    });
    res.json({ success: true, count: cheques.length, data: cheques });
  } catch (err) { next(err); }
}
