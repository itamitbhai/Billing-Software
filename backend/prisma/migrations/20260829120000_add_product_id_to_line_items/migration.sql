-- Add productId to SaleItem/PurchaseItem (denormalized from batch.productId, same
-- pattern as Batch.companyId) so "last rate for Customer+Product" / "Supplier+Product"
-- lookups can filter/index directly on the line-item table instead of joining
-- through Batch for every historical row.

-- AlterTable: add nullable column first, backfill, then enforce NOT NULL.
ALTER TABLE "SaleItem" ADD COLUMN "productId" TEXT;
UPDATE "SaleItem" si SET "productId" = b."productId" FROM "Batch" b WHERE b.id = si."batchId";
ALTER TABLE "SaleItem" ALTER COLUMN "productId" SET NOT NULL;

ALTER TABLE "PurchaseItem" ADD COLUMN "productId" TEXT;
UPDATE "PurchaseItem" pi SET "productId" = b."productId" FROM "Batch" b WHERE b.id = pi."batchId";
ALTER TABLE "PurchaseItem" ALTER COLUMN "productId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "SaleItem_productId_idx" ON "SaleItem"("productId");
CREATE INDEX "PurchaseItem_productId_idx" ON "PurchaseItem"("productId");

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Replace (companyId, customerId) / (companyId, supplierId) indexes with date-inclusive
-- versions so "latest valid Sale/Purchase for this party" can be satisfied by the index
-- scan itself instead of a full sort after filtering.
DROP INDEX "Sale_companyId_customerId_idx";
CREATE INDEX "Sale_companyId_customerId_saleDate_idx" ON "Sale"("companyId", "customerId", "saleDate");

DROP INDEX "Purchase_companyId_supplierId_idx";
CREATE INDEX "Purchase_companyId_supplierId_purchaseDate_idx" ON "Purchase"("companyId", "supplierId", "purchaseDate");
