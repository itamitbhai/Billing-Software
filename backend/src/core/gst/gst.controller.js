import * as gstService from './gst.service.js';
import { logAudit } from '../../shared/utils/audit-log.js';

function exportParams(body) {
  return {
    returnType: body.returnType,
    frequency: body.frequency || 'MONTHLY',
    financialYear: body.financialYear,
    month: body.month,
    from: body.from,
    to: body.to,
    iffFiledForQuarter: !!body.iffFiledForQuarter,
    acknowledgeExclusions: !!body.acknowledgeExclusions,
  };
}

export async function getMeta(req, res, next) {
  try {
    res.json({ success: true, data: gstService.getExportMeta() });
  } catch (err) { next(err); }
}

export async function prepareExport(req, res, next) {
  try {
    const data = await gstService.prepareExport(req.user.companyId, exportParams(req.body));
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function generateExport(req, res, next) {
  try {
    const data = await gstService.generateExport(req.user.companyId, req.user.id, exportParams(req.body));
    await logAudit({
      companyId: req.user.companyId, userId: req.user.id, action: 'GST_JSON_GENERATED', entityType: 'GstExportHistory', entityId: data.exportId,
      metadata: { returnType: data.returnType, fp: data.period.fp, files: data.files.length, records: data.records.valid, excluded: data.records.withErrors },
      req,
    });
    res.status(201).json({ success: true, data });
  } catch (err) {
    // 409/422 carry the full preview so the UI can show exactly what blocked generation.
    if (err.data && (err.status === 409 || err.status === 422)) {
      return res.status(err.status).json({ success: false, message: err.message, errors: err.errors, data: err.data });
    }
    next(err);
  }
}

export async function listHistory(req, res, next) {
  try {
    const data = await gstService.listExportHistory({ companyId: req.user.companyId, page: req.query.page, limit: req.query.limit });
    res.json({ success: true, ...data });
  } catch (err) { next(err); }
}

export async function getHistory(req, res, next) {
  try {
    const data = await gstService.getExportHistory(req.user.companyId, req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function downloadFile(req, res, next) {
  try {
    const file = await gstService.getExportFile(req.user.companyId, req.params.id, req.params.partNo);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    res.send(file.content);
  } catch (err) { next(err); }
}

export async function downloadErrors(req, res, next) {
  try {
    const row = await gstService.getExportHistory(req.user.companyId, req.params.id);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="GST_Export_Errors_${row.returnPeriod}.csv"`);
    res.send(gstService.issuesToCsv(row.issues || []));
  } catch (err) { next(err); }
}
