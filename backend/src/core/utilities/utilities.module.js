import { Router } from 'express';
import * as utilitiesController from './utilities.controller.js';
import { requireAuth, requireRoles } from '../auth/auth.middleware.js';

const utilitiesRouter = Router();
utilitiesRouter.use(requireAuth);

const ADMIN = requireRoles(['ADMIN']);

// ── Company Profile ───────────────────────────────────────────────────────────
utilitiesRouter.get('/company',            utilitiesController.getCompanyProfile);
utilitiesRouter.put('/company',       ADMIN, utilitiesController.updateCompanyProfile);

// ── Dashboard Stats ───────────────────────────────────────────────────────────
utilitiesRouter.get('/stats', utilitiesController.getSystemStats);

// ── Audit Log (security trail — Admin only) ─────────────────────────────────
utilitiesRouter.get('/audit-logs', ADMIN, utilitiesController.listAuditLogs);

export { utilitiesRouter };
