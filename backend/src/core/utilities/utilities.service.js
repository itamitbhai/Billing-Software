import { prisma } from '../../shared/database/prisma.js';

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
    salesSumObj,
    purchasesSumObj,
  ] = await Promise.all([
    prisma.user.count({ where: { companyId } }),
    prisma.party.count({ where: { companyId } }),
    prisma.product.count({ where: { companyId } }),
    prisma.batch.count({ where: { companyId } }),
    prisma.sale.count({ where: { companyId } }),
    prisma.purchase.count({ where: { companyId } }),
    prisma.sale.aggregate({ where: { companyId }, _sum: { totalAmount: true } }),
    prisma.purchase.aggregate({ where: { companyId }, _sum: { totalAmount: true } }),
  ]);

  return {
    userCount,
    partyCount,
    productCount,
    batchCount,
    salesCount,
    purchasesCount,
    totalSalesAmount: salesSumObj._sum.totalAmount || 0,
    totalPurchasesAmount: purchasesSumObj._sum.totalAmount || 0,
  };
}
