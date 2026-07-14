import * as reportsService from './reports.service.js';

export async function getBalanceSheet(req, res, next) {
  try {
    const data = await reportsService.getBalanceSheet({ companyId: req.user.companyId, asOfDate: req.query.asOfDate });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getProfitLoss(req, res, next) {
  try {
    const data = await reportsService.getProfitLoss({ companyId: req.user.companyId, startDate: req.query.startDate, endDate: req.query.endDate });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getStockSummary(req, res, next) {
  try {
    const data = await reportsService.getStockSummary({ companyId: req.user.companyId, asOfDate: req.query.asOfDate });
    res.json({ success: true, count: data.length, data });
  } catch (err) { next(err); }
}

export async function getDayBook(req, res, next) {
  try {
    const data = await reportsService.getDayBook({ companyId: req.user.companyId, date: req.query.date });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getTrialBalance(req, res, next) {
  try {
    const data = await reportsService.getTrialBalance({ companyId: req.user.companyId, asOfDate: req.query.asOfDate });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getOutstandingReceivables(req, res, next) {
  try {
    const data = await reportsService.getOutstandingReceivables({ companyId: req.user.companyId, asOfDate: req.query.asOfDate });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getOutstandingPayables(req, res, next) {
  try {
    const data = await reportsService.getOutstandingPayables({ companyId: req.user.companyId, asOfDate: req.query.asOfDate });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getCashFlow(req, res, next) {
  try {
    const data = await reportsService.getCashFlow({ companyId: req.user.companyId, startDate: req.query.startDate, endDate: req.query.endDate });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getLedgerStatement(req, res, next) {
  try {
    const data = await reportsService.getLedgerStatement({
      companyId: req.user.companyId, ledgerId: req.params.ledgerId,
      startDate: req.query.startDate, endDate: req.query.endDate,
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getGstSummary(req, res, next) {
  try {
    const data = await reportsService.getGstSummary({ companyId: req.user.companyId, startDate: req.query.startDate, endDate: req.query.endDate });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getGstr1(req, res, next) {
  try {
    const { month, year } = req.query;
    if (!month || !year) {
      return res.status(400).json({ success: false, message: '"month" and "year" query parameters are required.' });
    }
    const data = await reportsService.getGstr1({ companyId: req.user.companyId, month, year });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getGstr3b(req, res, next) {
  try {
    const { month, year } = req.query;
    if (!month || !year) {
      return res.status(400).json({ success: false, message: '"month" and "year" query parameters are required.' });
    }
    const data = await reportsService.getGstr3b({ companyId: req.user.companyId, month, year });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}
