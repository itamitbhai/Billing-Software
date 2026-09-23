-- CreateTable
CREATE TABLE "GstExportHistory" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "returnType" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "financialYear" TEXT NOT NULL,
    "returnPeriod" TEXT NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "gstin" TEXT NOT NULL,
    "toolVersion" TEXT NOT NULL,
    "schemaId" TEXT NOT NULL,
    "recordCount" INTEGER NOT NULL,
    "excludedCount" INTEGER NOT NULL DEFAULT 0,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "fileCount" INTEGER NOT NULL,
    "totalSizeBytes" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "summary" JSONB NOT NULL,
    "issues" JSONB NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GstExportHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GstExportFile" (
    "id" TEXT NOT NULL,
    "exportId" TEXT NOT NULL,
    "partNo" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "content" TEXT NOT NULL,

    CONSTRAINT "GstExportFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GstExportHistory_companyId_createdAt_idx" ON "GstExportHistory"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "GstExportHistory_companyId_returnType_returnPeriod_idx" ON "GstExportHistory"("companyId", "returnType", "returnPeriod");

-- CreateIndex
CREATE UNIQUE INDEX "GstExportFile_exportId_partNo_key" ON "GstExportFile"("exportId", "partNo");

-- AddForeignKey
ALTER TABLE "GstExportHistory" ADD CONSTRAINT "GstExportHistory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GstExportHistory" ADD CONSTRAINT "GstExportHistory_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GstExportFile" ADD CONSTRAINT "GstExportFile_exportId_fkey" FOREIGN KEY ("exportId") REFERENCES "GstExportHistory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

