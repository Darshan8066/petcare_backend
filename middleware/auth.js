import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;

/** Pulls a bearer token from the Authorization header, falling back to the cookie. */
const extractToken = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  if (req.cookies?.petcare_token) {
    return req.cookies.petcare_token;
  }
  return null;
};

const verify = (token) => {
  try {
    return jwt.verify(token, ACCESS_SECRET);
  } catch {
    return null;
  }
};

/**
 * Hard authentication gate.
 *
 * Previously this middleware fell back to a hard-coded demo account whenever a
 * token was missing or invalid, which made every "protected" route publicly
 * readable and writable. It now rejects the request.
 */
export const requireAuth = (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please sign in.'
    });
  }

  const decoded = verify(token);
  if (!decoded) {
    return res.status(401).json({
      success: false,
      code: 'TOKEN_INVALID',
      message: 'Your session has expired. Please sign in again.'
    });
  }

  req.user = {
    userId: decoded.userId,
    email: decoded.email,
    role: decoded.role
  };
  return next();
};

/**
 * Attaches req.user when a valid token is present, but lets anonymous
 * requests through. Used for endpoints that are public but personalise
 * their response when the caller is known.
 */
export const optionalAuth = (req, _res, next) => {
  const token = extractToken(req);
  if (token) {
    const decoded = verify(token);
    if (decoded) {
      req.user = {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role
      };
    }
  }
  return next();
};

/** Restricts a route to the given roles. Must run after requireAuth. */
export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'You do not have permission to perform this action.'
    });
  }
  return next();
};

export const requireAdmin = requireRole('admin');

/**
 * Confirms the account referenced by the token still exists and that the role
 * in the token matches the database. Use on sensitive admin routes so a stolen
 * or stale token cannot outlive a deleted or demoted account.
 */
export const verifyAccountActive = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId).select('role');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Account no longer exists.' });
    }
    if (user.role !== req.user.role) {
      return res.status(401).json({
        success: false,
        message: 'Your permissions have changed. Please sign in again.'
      });
    }
    return next();
  } catch (err) {
    return next(err);
  }
};

export default requireAuth;
