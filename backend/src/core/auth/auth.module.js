import { Router } from 'express';
import * as authController from './auth.controller.js';
import { requireAuth, requireRoles } from './auth.middleware.js';

const authRouter = Router();

// Public Routes
authRouter.post('/register-ceo', authController.registerCeo);
authRouter.post('/login', authController.login);
authRouter.post('/refresh', authController.refresh);
authRouter.post('/logout', authController.logout);

// Protected Routes
authRouter.get('/me', requireAuth, authController.me);
authRouter.post('/register-employee', requireAuth, requireRoles(['ADMIN']), authController.registerEmployee);
authRouter.get('/users', requireAuth, requireRoles(['ADMIN']), authController.listUsers);

export { authRouter };
