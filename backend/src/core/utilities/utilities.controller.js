import * as utilitiesService from './utilities.service.js';
import { logAudit } from '../../shared/utils/audit-log.js';

// ============================================
// COMPANY PROFILE
// ============================================

export async function getCompanyProfile(req, res, next) {
  try {
    const company = await utilitiesService.getCompanyProfile(req.user.companyId);
    res.json({ success: true, data: company });
  } catch (err) { next(err); }
}

export async function updateCompanyProfile(req, res, next) {
  try {
    const company = await utilitiesService.updateCompanyProfile(req.user.companyId, req.body);
    await logAudit({
      companyId: req.user.companyId, userId: req.user.id, action: 'COMPANY_PROFILE_UPDATE',
      entityType: 'Company', entityId: company.id, req,
    });
    res.json({ success: true, message: 'Company profile updated successfully.', data: company });
  } catch (err) { next(err); }
}

// ============================================
// SYSTEM STATS
// ============================================

export async function getSystemStats(req, res, next) {
  try {
    const stats = await utilitiesService.getSystemStats(req.user.companyId);
    res.json({ success: true, data: stats });
  } catch (err) { next(err); }
}

// ============================================
// AUDIT LOG
// ============================================

export async function listAuditLogs(req, res, next) {
  try {
    const { action, entityType, userId, startDate, endDate, page, limit } = req.query;
    const result = await utilitiesService.listAuditLogs({
      companyId: req.user.companyId, action, entityType, userId, startDate, endDate, page, limit,
    });
    res.json({ success: true, count: result.data.length, ...result });
  } catch (err) { next(err); }
}
