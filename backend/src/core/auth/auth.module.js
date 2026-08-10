import { Router } from 'express';
import * as authController from './auth.controller.js';
import { requireAuth, requireRoles } from './auth.middleware.js';

const authRouter = Router();

// Public Routes
// '/register-ceo' is intentionally NOT routed — this deployment uses a single
// bootstrap admin seeded from .env (see prisma/seed.js) instead of public
// self-registration. The controller/service are kept intact for that seed
// script and in case self-registration is re-enabled later.
authRouter.post('/login', authController.login);
authRouter.post('/refresh', authController.refresh);
authRouter.post('/logout', authController.logout);

// Protected Routes
authRouter.get('/me', requireAuth, authController.me);
authRouter.post('/register-employee', requireAuth, requireRoles(['ADMIN']), authController.registerEmployee);
authRouter.get('/users', requireAuth, requireRoles(['ADMIN']), authController.listUsers);

export { authRouter };
