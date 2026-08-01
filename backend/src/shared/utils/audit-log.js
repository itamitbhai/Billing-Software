import { prisma } from '../database/prisma.js';

/**
 * Records an audit trail entry. A logging failure must never abort the
 * business operation it describes, so errors are swallowed (and surfaced
 * to the server console) rather than propagated to the caller.
 *
 * @param {object} params
 * @param {import('@prisma/client').Prisma.TransactionClient} [params.tx] - use when logging inside an existing $transaction
 * @param {string|null} [params.companyId]
 * @param {string|null} [params.userId]
 * @param {string} params.action - e.g. "PARTY_CREATE", "LOGIN_FAILED"
 * @param {string|null} [params.entityType] - Prisma model name, e.g. "Party"
 * @param {string|null} [params.entityId]
 * @param {object|null} [params.metadata] - small JSON-serializable context (no secrets)
 * @param {import('express').Request} [params.req] - used to extract the client IP
 */
export async function logAudit({
  tx,
  companyId = null,
  userId = null,
  action,
  entityType = null,
  entityId = null,
  metadata = null,
  req = null,
} = {}) {
  const client = tx || prisma;
  const ipAddress = req
    ? (req.headers?.['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || req.socket?.remoteAddress || null)
    : null;

  try {
    await client.auditLog.create({
      data: { companyId, userId, action, entityType, entityId, metadata: metadata ?? undefined, ipAddress },
    });
  } catch (err) {
    console.error(`[audit-log] failed to record "${action}":`, err.message);
  }
}
