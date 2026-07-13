import * as utilitiesService from './utilities.service.js';

// ============================================
// COMPANY PROFILE
// ============================================

export async function getCompanyProfile(req, res, next) {
  try {
    const company = await utilitiesService.getCompanyProfile();
    res.json({ success: true, data: company });
  } catch (err) { next(err); }
}

export async function updateCompanyProfile(req, res, next) {
  try {
    const company = await utilitiesService.updateCompanyProfile(req.body);
    res.json({ success: true, message: 'Company profile updated successfully.', data: company });
  } catch (err) { next(err); }
}

// ============================================
// SYSTEM STATS
// ============================================

export async function getSystemStats(req, res, next) {
  try {
    const stats = await utilitiesService.getSystemStats();
    res.json({ success: true, data: stats });
  } catch (err) { next(err); }
}
