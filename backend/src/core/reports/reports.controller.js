import * as reportsService from './reports.service.js';

export async function getBalanceSheet(req, res, next) {
  try {
    const data = await reportsService.getBalanceSheet({ tenantPrisma: req.tenantPrisma, companyId: req.user.companyId, asOfDate: req.query.asOfDate });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getProfitLoss(req, res, next) {
  try {
    const data = await reportsService.getProfitLoss({ tenantPrisma: req.tenantPrisma, companyId: req.user.companyId, startDate: req.query.startDate, endDate: req.query.endDate });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getStockSummary(req, res, next) {
  try {
    const data = await reportsService.getStockSummary({ tenantPrisma: req.tenantPrisma, companyId: req.user.companyId, asOfDate: req.query.asOfDate });
    res.json({ success: true, count: data.length, data });
  } catch (err) { next(err); }
}

export async function getDayBook(req, res, next) {
  try {
    const data = await reportsService.getDayBook({ tenantPrisma: req.tenantPrisma, companyId: req.user.companyId, date: req.query.date });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getTrialBalance(req, res, next) {
  try {
    const data = await reportsService.getTrialBalance({ tenantPrisma: req.tenantPrisma, companyId: req.user.companyId, asOfDate: req.query.asOfDate });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getOutstandingReceivables(req, res, next) {
  try {
    const data = await reportsService.getOutstandingReceivables({ tenantPrisma: req.tenantPrisma, companyId: req.user.companyId, asOfDate: req.query.asOfDate });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getOutstandingPayables(req, res, next) {
  try {
    const data = await reportsService.getOutstandingPayables({ tenantPrisma: req.tenantPrisma, companyId: req.user.companyId, asOfDate: req.query.asOfDate });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getCashFlow(req, res, next) {
  try {
    const data = await reportsService.getCashFlow({ tenantPrisma: req.tenantPrisma, companyId: req.user.companyId, startDate: req.query.startDate, endDate: req.query.endDate });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getLedgerStatement(req, res, next) {
  try {
    const data = await reportsService.getLedgerStatement({
      tenantPrisma: req.tenantPrisma, ledgerId: req.params.ledgerId,
      companyId: req.user.companyId, startDate: req.query.startDate, endDate: req.query.endDate,
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}
