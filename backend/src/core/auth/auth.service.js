import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../shared/database/prisma.js';

// Generate Access Token (JWT)
function generateAccessToken(user) {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };
  const secret = process.env.JWT_SECRET || 'fallback_secret';
  const expiresIn = process.env.JWT_EXPIRES_IN || '1d';
  return jwt.sign(payload, secret, { expiresIn });
}

// Generate Refresh Token (JWT)
function generateRefreshToken(user) {
  const payload = {
    userId: user.id,
  };
  const secret = process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret';
  const expiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
  return jwt.sign(payload, secret, { expiresIn });
}

export async function registerCeo({ companyName, name, email, password }) {
  // 1. Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    const err = new Error('A user with this email already exists.');
    err.status = 400;
    throw err;
  }

  // 2. Hash password
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  // 3. Create CEO Admin User
  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: 'ADMIN',
      isActive: true,
    },
  });

  // 4. Create default Company Settings if none exists
  let companySettings = await prisma.companySettings.findFirst();
  if (!companySettings) {
    companySettings = await prisma.companySettings.create({
      data: {
        companyName: companyName || 'VS Arogya Meda',
        gstin: '27AAAAA1111A1Z1', // Default dummy GSTIN
        state: 'Maharashtra', // Default dummy State
      },
    });
  }

  // 5. Generate tokens
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    company: companySettings,
  };
}

export async function login({ email, password }) {
  // 1. Fetch user from database
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    const err = new Error('Invalid email or password.');
    err.status = 401;
    throw err;
  }

  // 2. Validate active status and credentials
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

  // 3. Generate tokens
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  const company = await prisma.companySettings.findFirst() || null;

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    company,
  };
}

export async function refresh({ refreshToken }) {
  try {
    const secret = process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret';
    const decoded = jwt.verify(refreshToken, secret);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user || !user.isActive) {
      const err = new Error('Invalid session.');
      err.status = 401;
      throw err;
    }

    const accessToken = generateAccessToken(user);
    return { accessToken };
  } catch (err) {
    const error = new Error('Invalid or expired refresh token.');
    error.status = 401;
    throw error;
  }
}

export async function logout() {
  // In a stateless JWT implementation, logout is handled by the client discarding the token.
  return { success: true };
}

export async function registerEmployee({ name, email, password, role }) {
  // Check if user exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    const err = new Error('A user with this email already exists.');
    err.status = 400;
    throw err;
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const employeeRole = (role === 'ADMIN' || role === 'ACCOUNTANT' || role === 'STAFF') ? role : 'STAFF';

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: employeeRole,
      isActive: true,
    },
  });

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

export async function listUsers() {
  return prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { name: 'asc' },
  });
}
