import { prisma } from '../../shared/database/prisma.js';
import { paginate, paginatedResult } from '../../shared/utils/pagination.js';

// ============================================
// COMPANY PROFILE
// ============================================

export async function getCompanyProfile(companyId) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) {
    const err = new Error('Company not found.');
    err.status = 404;
    throw err;
  }
  return company;
}

export async function updateCompanyProfile(companyId, data) {
  await getCompanyProfile(companyId);
  return prisma.company.update({
    where: { id: companyId },
    data: {
      name: data.name ?? data.companyName,
      gstin: data.gstin,
      pan: data.pan,
      state: data.state,
      address: data.address,
      phone: data.phone,
      email: data.email,
      dlNumber: data.dlNumber,
      bankName: data.bankName,
      accountNo: data.accountNo,
      ifscCode: data.ifscCode,
      invoicePrefix: data.invoicePrefix,
    },
  });
}

// ============================================
// SYSTEM STATS
// ============================================

export async function getSystemStats(companyId) {
  const [
    userCount,
    partyCount,
    productCount,
    batchCount,
    salesCount,
    purchasesCount,
    voucherCount,
    salesSumObj,
    purchasesSumObj,
    activeFinancialYear,
    lastSale,
  ] = await Promise.all([
    prisma.user.count({ where: { companyId } }),
    prisma.party.count({ where: { companyId } }),
    prisma.product.count({ where: { companyId } }),
    prisma.batch.count({ where: { companyId } }),
    prisma.sale.count({ where: { companyId } }),
    prisma.purchase.count({ where: { companyId } }),
    prisma.voucher.count({ where: { companyId, isDeleted: false } }),
    prisma.sale.aggregate({ where: { companyId }, _sum: { totalAmount: true } }),
    prisma.purchase.aggregate({ where: { companyId }, _sum: { totalAmount: true } }),
    prisma.financialYear.findFirst({ where: { companyId, isActive: true }, select: { id: true, name: true } }),
    prisma.sale.findFirst({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      select: { invoiceNumber: true, totalAmount: true, saleDate: true, customer: { select: { name: true } } },
    }),
  ]);

  return {
    userCount,
    partyCount,
    productCount,
    stockItemCount: productCount,
    batchCount,
    salesCount,
    purchasesCount,
    voucherCount,
    totalSalesAmount: salesSumObj._sum.totalAmount || 0,
    totalPurchasesAmount: purchasesSumObj._sum.totalAmount || 0,
    activeFinancialYear,
    lastSale,
  };
}

// ============================================
// AUDIT LOG
// ============================================

export async function listAuditLogs({ companyId, action, entityType, userId, startDate, endDate, page, limit }) {
  const { take, skip, page: currentPage } = paginate({ page, limit });

  const where = {
    companyId,
    ...(action ? { action } : {}),
    ...(entityType ? { entityType } : {}),
    ...(userId ? { userId } : {}),
    ...(startDate || endDate ? {
      createdAt: {
        ...(startDate ? { gte: new Date(startDate) } : {}),
        ...(endDate ? { lte: new Date(endDate) } : {}),
      },
    } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return paginatedResult({ rows, total, page: currentPage, limit: take });
}
