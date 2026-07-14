// ============================================
// stock-ledger.js
// Single place that mutates Batch.currentQty and appends the matching
// StockLedgerEntry audit row, atomically, inside the caller's transaction.
// ============================================

/**
 * Applies a stock movement to a batch and records it in the stock ledger.
 * Caller is responsible for validating stock availability beforehand (OUT movements).
 */
export async function recordStockMovement(tx, {
  companyId, productId, batchId, movementType, referenceType, referenceId, qty, rate, notes,
}) {
  const delta = movementType === 'IN' ? qty : -qty;

  const batch = await tx.batch.update({
    where: { id: batchId },
    data: { currentQty: { increment: delta } },
  });

  await tx.stockLedgerEntry.create({
    data: {
      companyId,
      productId,
      batchId,
      movementType,
      referenceType,
      referenceId: referenceId || null,
      qty,
      balanceQty: batch.currentQty,
      rate,
      notes: notes || null,
    },
  });

  return batch;
}
