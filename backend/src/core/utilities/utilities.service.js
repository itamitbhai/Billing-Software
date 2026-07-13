import { prisma } from '../../shared/database/prisma.js';

// ============================================
// COMPANY PROFILE
// ============================================

export async function getCompanyProfile() {
  let company = await prisma.companySettings.findFirst();
  if (!company) {
    // Return a default mock object or create a default setting
    company = await prisma.companySettings.create({
      data: {
        companyName: 'VS Arogya Meda',
        gstin: '27AAAAA1111A1Z1',
        state: 'Maharashtra',
      },
    });
  }
  return company;
}

export async function updateCompanyProfile(data) {
  let company = await prisma.companySettings.findFirst();
  if (!company) {
    company = await prisma.companySettings.create({
      data: {
        companyName: data.companyName || 'VS Arogya Meda',
        gstin: data.gstin || '27AAAAA1111A1Z1',
        state: data.state || 'Maharashtra',
      },
    });
  }

  return prisma.companySettings.update({
    where: { id: company.id },
    data: {
      companyName: data.companyName,
      gstin: data.gstin,
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

export async function getSystemStats() {
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
    prisma.user.count(),
    prisma.party.count(),
    prisma.product.count(),
    prisma.batch.count(),
    prisma.sale.count(),
    prisma.purchase.count(),
    prisma.sale.aggregate({ _sum: { totalAmount: true } }),
    prisma.purchase.aggregate({ _sum: { totalAmount: true } }),
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
