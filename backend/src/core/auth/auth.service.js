import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../shared/database/prisma.js';
import { seedTallyDefaults } from '../../shared/utils/tally-seed.js';

const VALID_ROLES = ['ADMIN', 'ACCOUNTANT', 'STAFF'];

function generateAccessToken(user) {
  const payload = {
    userId: user.id,
    companyId: user.companyId,
    email: user.email,
    role: user.role,
  };
  const secret = process.env.JWT_SECRET || 'fallback_secret';
  const expiresIn = process.env.JWT_EXPIRES_IN || '1d';
  return jwt.sign(payload, secret, { expiresIn });
}

function generateRefreshToken(user) {
  const payload = {
    userId: user.id,
    companyId: user.companyId,
    jti: crypto.randomUUID(), // guarantees a distinct token even if issued within the same second
  };
  const secret = process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret';
  const expiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
  return jwt.sign(payload, secret, { expiresIn });
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function refreshExpiryDate() {
  const raw = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
  const match = /^(\d+)([smhd])$/.exec(raw);
  const amount = match ? parseInt(match[1], 10) : 7;
  const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match ? match[2] : 'd'];
  return new Date(Date.now() + amount * unitMs);
}

async function createSession(tx, user, refreshToken, meta = {}) {
  await tx.session.create({
    data: {
      userId: user.id,
      refreshTokenHash: hashToken(refreshToken),
      expiresAt: refreshExpiryDate(),
      userAgent: meta.userAgent || null,
      ipAddress: meta.ipAddress || null,
    },
  });
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    companyId: user.companyId,
  };
}

export async function registerCeo({ companyName, name, email, password, state }) {
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    const err = new Error('A user with this email already exists.');
    err.status = 400;
    throw err;
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  return prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: {
        name: companyName,
        state: state || 'Maharashtra',
      },
    });

    const user = await tx.user.create({
      data: {
        companyId: company.id,
        name,
        email,
        passwordHash,
        role: 'ADMIN',
        isActive: true,
        lastLoginAt: new Date(),
      },
    });

    await seedTallyDefaults(tx, company.id);

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    await createSession(tx, user, refreshToken);

    return {
      accessToken,
      refreshToken,
      user: publicUser(user),
      company,
    };
  });
}

export async function login({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const err = new Error('Invalid email or password.');
    err.status = 401;
    throw err;
  }

  if (!user.isActive) {
    const err = new Error('Your account is currently inactive.');
    err.status = 403;
    throw err;
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    const err = new Error('Invalid email or password.');
    err.status = 401;
    throw err;
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await createSession(tx, user, refreshToken);
  });

  const company = await prisma.company.findUnique({ where: { id: user.companyId } });

  return {
    accessToken,
    refreshToken,
    user: publicUser(user),
    company,
  };
}

export async function refresh({ refreshToken }) {
  const secret = process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret';
  let decoded;
  try {
    decoded = jwt.verify(refreshToken, secret);
  } catch (err) {
    const error = new Error('Invalid or expired refresh token.');
    error.status = 401;
    throw error;
  }

  const tokenHash = hashToken(refreshToken);
  const session = await prisma.session.findUnique({ where: { refreshTokenHash: tokenHash } });
  if (!session || session.isRevoked || session.expiresAt < new Date()) {
    const error = new Error('Session is no longer valid. Please login again.');
    error.status = 401;
    throw error;
  }

  const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
  if (!user || !user.isActive) {
    const error = new Error('Invalid session.');
    error.status = 401;
    throw error;
  }

  const newAccessToken = generateAccessToken(user);
  const newRefreshToken = generateRefreshToken(user);

  await prisma.$transaction(async (tx) => {
    await tx.session.update({ where: { id: session.id }, data: { isRevoked: true } });
    await createSession(tx, user, newRefreshToken);
  });

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}

export async function logout({ refreshToken }) {
  if (!refreshToken) return { success: true };

  const tokenHash = hashToken(refreshToken);
  await prisma.session.updateMany({
    where: { refreshTokenHash: tokenHash, isRevoked: false },
    data: { isRevoked: true },
  });

  return { success: true };
}

export async function registerEmployee({ companyId, name, email, password, role }) {
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    const err = new Error('A user with this email already exists.');
    err.status = 400;
    throw err;
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const employeeRole = VALID_ROLES.includes(role) ? role : 'STAFF';

  const user = await prisma.user.create({
    data: {
      companyId,
      name,
      email,
      passwordHash,
      role: employeeRole,
      isActive: true,
    },
  });

  return publicUser(user);
}

export async function listUsers({ companyId }) {
  return prisma.user.findMany({
    where: { companyId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
    },
    orderBy: { name: 'asc' },
  });
}
