const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const prisma = require('../../config/db');
const { sendResponse, ApiError } = require('../../utils/response');
const { asyncHandler } = require('../../middlewares/error');

/**
 * Generate Access & Refresh Tokens for a user.
 */
const generateTokens = (user) => {
  const accessTokenExpiresIn = process.env.JWT_EXPIRES_IN || '15m';
  const refreshTokenExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

  const accessToken = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: accessTokenExpiresIn }
  );

  const refreshToken = jwt.sign(
    { id: user.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: refreshTokenExpiresIn }
  );

  return { accessToken, refreshToken };
};

/**
 * @desc    Login user & get access/refresh tokens
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;
  const normalizedEmail = email?.trim();

  if (!normalizedEmail || !password) {
    return next(new ApiError(400, 'Please provide email and password'));
  }

  const user = await prisma.user.findFirst({
    where: {
      email: {
        equals: normalizedEmail,
        mode: 'insensitive',
      },
    },
  });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return next(new ApiError(401, 'Incorrect email or password'));
  }

  if (!user.isActive) {
    return next(new ApiError(401, 'Your account is inactive'));
  }

  const authenticatedUser = await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const { accessToken, refreshToken } = generateTokens(authenticatedUser);

  // Store refresh token in DB
  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: authenticatedUser.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  });

  sendResponse(res, 200, 'Logged in successfully', {
    user: {
      id: authenticatedUser.id,
      fullName: authenticatedUser.fullName,
      email: authenticatedUser.email,
      role: authenticatedUser.role,
      phone: authenticatedUser.phone,
      userCode: authenticatedUser.userCode,
      departmentId: authenticatedUser.departmentId,
    },
    accessToken,
    refreshToken,
  });
});

/**
 * @desc    Refresh access token using refresh token
 * @route   POST /api/auth/refresh
 * @access  Public
 */
const refresh = asyncHandler(async (req, res, next) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return next(new ApiError(400, 'Refresh token is required'));
  }

  const storedToken = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
    include: { user: true },
  });

  if (!storedToken || storedToken.expiresAt < new Date()) {
    return next(new ApiError(401, 'Invalid or expired refresh token'));
  }

  const { accessToken, refreshToken: newRefreshToken } = generateTokens(storedToken.user);

  // Rotate refresh token
  await prisma.refreshToken.delete({ where: { id: storedToken.id } });
  await prisma.refreshToken.create({
    data: {
      token: newRefreshToken,
      userId: storedToken.user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  sendResponse(res, 200, 'Token refreshed successfully', {
    accessToken,
    refreshToken: newRefreshToken,
  });
});

/**
 * @desc    Logout user & revoke refresh token
 * @route   POST /api/auth/logout
 * @access  Private
 */
const logout = asyncHandler(async (req, res, next) => {
  const { refreshToken } = req.body;

  if (refreshToken) {
    await prisma.refreshToken.deleteMany({
      where: { token: refreshToken },
    });
  }

  sendResponse(res, 200, 'Logged out successfully');
});

/**
 * @desc    Get current user profile
 * @route   GET /api/auth/me
 * @access  Private
 */
const getMe = asyncHandler(async (req, res) => {
  sendResponse(res, 200, 'Profile fetched successfully', { user: req.user });
});

module.exports = {
  login,
  refresh,
  logout,
  getMe,
};
