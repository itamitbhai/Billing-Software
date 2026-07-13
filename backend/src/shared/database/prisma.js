import { PrismaClient } from '@prisma/client';

// Global Prisma Client instance connected to the default schema
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error'] : ['error'],
});

export { prisma };
