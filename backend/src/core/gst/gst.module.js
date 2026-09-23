import { Router } from 'express';
import * as gstController from './gst.controller.js';
import { requireAuth, requireRoles } from '../auth/auth.middleware.js';

const gstRouter = Router();
gstRouter.use(requireAuth);

// GST return JSON export (offline upload). Preparing/validating is read-only;
// generating stores the files and is limited to ADMIN/ACCOUNTANT.
// Nothing here files a return — the user uploads the JSON on the GST portal.
const WRITE = requireRoles(['ADMIN', 'ACCOUNTANT']);

gstRouter.get('/export/meta',                           gstController.getMeta);
gstRouter.post('/export/prepare',                       gstController.prepareExport);    // classify + validate + schema check, nothing stored
gstRouter.post('/export/generate',              WRITE,  gstController.generateExport);   // same, then stores the JSON file(s) + history
gstRouter.get('/export/history',                        gstController.listHistory);
gstRouter.get('/export/history/:id',                    gstController.getHistory);
gstRouter.get('/export/history/:id/files/:partNo',      gstController.downloadFile);
gstRouter.get('/export/history/:id/errors.csv',         gstController.downloadErrors);

export { gstRouter };
