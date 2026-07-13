-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CEO_REGISTERED', 'EMPLOYEE_REGISTERED', 'USER_LOGIN', 'TOKEN_REFRESHED', 'USER_LOGOUT');

-- CreateEnum
CREATE TYPE "VoucherType" AS ENUM ('SALES', 'PURCHASE', 'RECEIPT', 'PAYMENT', 'CONTRA', 'JOURNAL', 'CREDIT_NOTE', 'DEBIT_NOTE');

-- CreateEnum
CREATE TYPE "PartyType" AS ENUM ('CUSTOMER', 'SUPPLIER', 'BOTH');

-- CreateEnum
CREATE TYPE "LedgerNature" AS ENUM ('ASSET', 'LIABILITY', 'INCOME', 'EXPENSE', 'EQUITY');

-- CreateEnum
CREATE TYPE "EntryType" AS ENUM ('DEBIT', 'CREDIT');

-- CreateTable
CREATE TABLE "ledger_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nature" "LedgerNature" NOT NULL,
    "parentId" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ledger_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledgers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "openingBalance" BIGINT NOT NULL DEFAULT 0,
    "openingBalanceType" "EntryType" NOT NULL DEFAULT 'DEBIT',
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ledgers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_routes" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "databaseUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'EMPLOYEE',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLogin" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "isValid" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "details" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT,
    "companyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_accounts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ledgerId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "ifsc" TEXT,
    "branch" TEXT,
    "openingBalance" BIGINT NOT NULL DEFAULT 0,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_reconciliations" (
    "id" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "voucherLineId" TEXT NOT NULL,
    "statementDate" TIMESTAMP(3),
    "statementAmount" BIGINT,
    "isReconciled" BOOLEAN NOT NULL DEFAULT false,
    "reconciledAt" TIMESTAMP(3),
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_reconciliations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parties" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PartyType" NOT NULL,
    "ledgerId" TEXT NOT NULL,
    "gstin" TEXT,
    "pan" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "creditLimit" BIGINT NOT NULL DEFAULT 0,
    "creditDays" INTEGER NOT NULL DEFAULT 0,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_rates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate" INTEGER NOT NULL,
    "cgst" INTEGER NOT NULL DEFAULT 0,
    "sgst" INTEGER NOT NULL DEFAULT 0,
    "igst" INTEGER NOT NULL DEFAULT 0,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_items" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stockGroupId" TEXT,
    "unitId" TEXT,
    "openingQuantity" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "openingRate" BIGINT NOT NULL DEFAULT 0,
    "openingValue" BIGINT NOT NULL DEFAULT 0,
    "hsn" TEXT,
    "taxRateId" TEXT,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_centres" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cost_centres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "currencies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_years" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_years_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vouchers" (
    "id" TEXT NOT NULL,
    "voucherNumber" TEXT NOT NULL,
    "type" "VoucherType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "narration" TEXT,
    "partyId" TEXT,
    "financialYearId" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "companyId" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voucher_lines" (
    "id" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "ledgerId" TEXT NOT NULL,
    "type" "EntryType" NOT NULL,
    "amount" BIGINT NOT NULL,
    "igstAmount" BIGINT NOT NULL DEFAULT 0,
    "cgstAmount" BIGINT NOT NULL DEFAULT 0,
    "sgstAmount" BIGINT NOT NULL DEFAULT 0,
    "description" TEXT,
    "costCentreId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voucher_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voucher_line_items" (
    "id" TEXT NOT NULL,
    "voucherLineId" TEXT NOT NULL,
    "stockItemId" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "rate" BIGINT NOT NULL,
    "amount" BIGINT NOT NULL,
    "discount" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voucher_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ledger_groups_companyId_idx" ON "ledger_groups"("companyId");

-- CreateIndex
CREATE INDEX "ledgers_companyId_idx" ON "ledgers"("companyId");

-- CreateIndex
CREATE INDEX "ledgers_groupId_idx" ON "ledgers"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_routes_email_key" ON "tenant_routes"("email");

-- CreateIndex
CREATE UNIQUE INDEX "companies_email_key" ON "companies"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_companyId_idx" ON "users"("companyId");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refreshTokenHash_key" ON "sessions"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_refreshTokenHash_idx" ON "sessions"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_companyId_idx" ON "audit_logs"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "bank_accounts_ledgerId_key" ON "bank_accounts"("ledgerId");

-- CreateIndex
CREATE INDEX "bank_accounts_companyId_idx" ON "bank_accounts"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "bank_reconciliations_voucherLineId_key" ON "bank_reconciliations"("voucherLineId");

-- CreateIndex
CREATE INDEX "bank_reconciliations_bankAccountId_idx" ON "bank_reconciliations"("bankAccountId");

-- CreateIndex
CREATE INDEX "bank_reconciliations_companyId_idx" ON "bank_reconciliations"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "parties_ledgerId_key" ON "parties"("ledgerId");

-- CreateIndex
CREATE INDEX "parties_companyId_idx" ON "parties"("companyId");

-- CreateIndex
CREATE INDEX "stock_groups_companyId_idx" ON "stock_groups"("companyId");

-- CreateIndex
CREATE INDEX "units_companyId_idx" ON "units"("companyId");

-- CreateIndex
CREATE INDEX "tax_rates_companyId_idx" ON "tax_rates"("companyId");

-- CreateIndex
CREATE INDEX "stock_items_companyId_idx" ON "stock_items"("companyId");

-- CreateIndex
CREATE INDEX "cost_centres_companyId_idx" ON "cost_centres"("companyId");

-- CreateIndex
CREATE INDEX "currencies_companyId_idx" ON "currencies"("companyId");

-- CreateIndex
CREATE INDEX "financial_years_companyId_idx" ON "financial_years"("companyId");

-- CreateIndex
CREATE INDEX "vouchers_companyId_idx" ON "vouchers"("companyId");

-- CreateIndex
CREATE INDEX "vouchers_type_idx" ON "vouchers"("type");

-- CreateIndex
CREATE INDEX "vouchers_date_idx" ON "vouchers"("date");

-- CreateIndex
CREATE INDEX "vouchers_partyId_idx" ON "vouchers"("partyId");

-- CreateIndex
CREATE INDEX "voucher_lines_voucherId_idx" ON "voucher_lines"("voucherId");

-- CreateIndex
CREATE INDEX "voucher_lines_ledgerId_idx" ON "voucher_lines"("ledgerId");

-- CreateIndex
CREATE INDEX "voucher_line_items_voucherLineId_idx" ON "voucher_line_items"("voucherLineId");

-- CreateIndex
CREATE INDEX "voucher_line_items_stockItemId_idx" ON "voucher_line_items"("stockItemId");

-- AddForeignKey
ALTER TABLE "ledger_groups" ADD CONSTRAINT "ledger_groups_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ledger_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledgers" ADD CONSTRAINT "ledgers_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ledger_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "ledgers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_reconciliations" ADD CONSTRAINT "bank_reconciliations_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_reconciliations" ADD CONSTRAINT "bank_reconciliations_voucherLineId_fkey" FOREIGN KEY ("voucherLineId") REFERENCES "voucher_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parties" ADD CONSTRAINT "parties_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "ledgers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_groups" ADD CONSTRAINT "stock_groups_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "stock_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_stockGroupId_fkey" FOREIGN KEY ("stockGroupId") REFERENCES "stock_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_taxRateId_fkey" FOREIGN KEY ("taxRateId") REFERENCES "tax_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_centres" ADD CONSTRAINT "cost_centres_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "cost_centres"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "financial_years"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_lines" ADD CONSTRAINT "voucher_lines_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "vouchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_lines" ADD CONSTRAINT "voucher_lines_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "ledgers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_lines" ADD CONSTRAINT "voucher_lines_costCentreId_fkey" FOREIGN KEY ("costCentreId") REFERENCES "cost_centres"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_line_items" ADD CONSTRAINT "voucher_line_items_voucherLineId_fkey" FOREIGN KEY ("voucherLineId") REFERENCES "voucher_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_line_items" ADD CONSTRAINT "voucher_line_items_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "stock_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
