// Seeds the single bootstrap Admin account (company + ADMIN user) from the
// ADMIN_* variables in .env. Public self-registration is disabled — this is
// the only way a new company/admin ever gets created. Safe to re-run: if the
// email already exists, seeding is skipped.
import 'dotenv/config';
import { registerCeo } from '../src/core/auth/auth.service.js';
import { prisma } from '../src/shared/database/prisma.js';

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.log('ADMIN_EMAIL / ADMIN_PASSWORD not set in .env — skipping admin seed.');
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin account "${email}" already exists — skipping seed.`);
    return;
  }

  const companyName = process.env.ADMIN_COMPANY_NAME || 'My Company';
  const name = process.env.ADMIN_NAME || 'Administrator';
  const state = process.env.ADMIN_STATE || 'Maharashtra';

  await registerCeo({ companyName, name, email, password, state });
  console.log(`Seeded admin account "${email}" for company "${companyName}". Log in and add accountant/staff from Utilities.`);
}

main()
  .catch((err) => {
    console.error('Admin seed failed:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
