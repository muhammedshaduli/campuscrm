const jwt = require('jsonwebtoken');
const { ApiError } = require('../utils/response');
const prisma = require('../config/db');

/**
 * Protect routes by verifying JWT tokens.
 */
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new ApiError(401, 'You are not logged in! Please log in to get access.'));
  }

  try {
    // 1) Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 2) Check if user still exists
    const currentUser = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!currentUser) {
      return next(new ApiError(401, 'The user belonging to this token no longer exists.'));
    }

    if (!currentUser.isActive) {
      return next(new ApiError(401, 'Your account is currently inactive. Please contact your admin.'));
    }

    // Grant access to protected route
    req.user = currentUser;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new ApiError(401, 'Your token has expired! Please log in again.'));
    }
    return next(new ApiError(401, 'Invalid token! Please log in again.'));
  }
};

/**
 * Restrict routes to specific roles.
 */
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, 'You do not have permission to perform this action.'));
    }
    next();
  };
};

module.exports = {
  protect,
  restrictTo,
};
