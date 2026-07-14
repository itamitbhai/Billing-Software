import * as authService from './auth.service.js';

export async function registerCeo(req, res, next) {
  try {
    const { companyName, name, email, password, state } = req.body;

    if (!companyName || !name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'All fields (companyName, name, email, password) are required.',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
      });
    }

    const result = await authService.registerCeo({
      companyName,
      name,
      email,
      password,
      state,
    });

    res.status(201).json({
      success: true,
      message: 'CEO and Company registered successfully.',
      token: result.accessToken,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
      company: result.company,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      });
    }

    const result = await authService.login({
      email,
      password,
    });

    res.status(200).json({
      success: true,
      message: 'Login successful.',
      token: result.accessToken,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
      company: result.company,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required.',
      });
    }

    const result = await authService.refresh({
      refreshToken,
    });

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully.',
      token: result.accessToken,
      accessToken: result.accessToken,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function logout(req, res, next) {
  try {
    const { refreshToken } = req.body;
    await authService.logout({ refreshToken });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully.',
    });
  } catch (error) {
    next(error);
  }
}

export async function registerEmployee(req, res, next) {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'All fields (name, email, password) are required.',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
      });
    }

    const employee = await authService.registerEmployee({
      companyId: req.user.companyId,
      name,
      email,
      password,
      role,
    });

    res.status(201).json({
      success: true,
      message: 'Employee registered successfully.',
      data: { employee },
    });
  } catch (error) {
    next(error);
  }
}

export async function me(req, res, next) {
  try {
    res.status(200).json({
      success: true,
      data: {
        user: req.user,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function listUsers(req, res, next) {
  try {
    const users = await authService.listUsers({ companyId: req.user.companyId });
    res.json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (err) { next(err); }
}
