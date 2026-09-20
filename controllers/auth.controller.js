import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_TTL = process.env.JWT_ACCESS_TTL || '1d';
const REFRESH_TTL = process.env.JWT_REFRESH_TTL || '7d';

const isProd = () => process.env.NODE_ENV === 'production';

/** Roles a visitor is allowed to choose at sign-up. "admin" is deliberately absent. */
const SELF_SERVICE_ROLES = ['user'];

const signTokens = (user) => {
  const payload = { userId: user._id.toString(), email: user.email, role: user.role };
  const accessToken = jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_TTL });
  const refreshToken = jwt.sign(
    { ...payload, tokenVersion: user.tokenVersion ?? 0 },
    REFRESH_SECRET,
    { expiresIn: REFRESH_TTL }
  );
  return { accessToken, refreshToken };
};

/**
 * Mirrors the access token into an httpOnly cookie. The SPA keeps using the
 * bearer token; the cookie simply means the token is not the only copy and
 * survives cross-tab navigation.
 */
const setAuthCookie = (res, token) => {
  res.cookie('petcare_token', token, {
    httpOnly: true,
    secure: isProd(),
    // Cross-site in production (API and frontend are on different domains).
    sameSite: isProd() ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000,
    path: '/'
  });
};

const clearAuthCookie = (res) => {
  res.clearCookie('petcare_token', {
    httpOnly: true,
    secure: isProd(),
    sameSite: isProd() ? 'none' : 'lax',
    path: '/'
  });
};

const validatePassword = (password) => {
  if (typeof password !== 'string' || password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  if (password.length > 128) {
    return 'Password cannot exceed 128 characters.';
  }
  return null;
};

/**
 * POST /api/auth/register
 */
export const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password, phone, role } = req.body;

  if (!name?.trim() || !email?.trim() || !password) {
    return res.status(400).json({
      success: false,
      message: 'Name, email, and password are required.'
    });
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    return res.status(400).json({ success: false, message: passwordError });
  }

  const normalisedEmail = email.trim().toLowerCase();

  const existingUser = await User.findOne({ email: normalisedEmail });
  if (existingUser) {
    return res.status(409).json({
      success: false,
      message: 'An account with this email already exists.'
    });
  }

  // Privilege escalation guard: a role supplied in the request body is only
  // honoured when it is in the self-service allow-list.
  const safeRole = SELF_SERVICE_ROLES.includes(role) ? role : 'user';

  const newUser = await User.create({
    name: name.trim(),
    email: normalisedEmail,
    password, // hashed by the model's pre-save hook
    role: safeRole,
    phone: phone?.trim() || ''
  });

  const tokens = signTokens(newUser);
  setAuthCookie(res, tokens.accessToken);

  return res.status(201).json({
    success: true,
    message: 'Account registered successfully.',
    data: { user: newUser.toJSON(), ...tokens }
  });
});

/**
 * POST /api/auth/login
 */
export const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email?.trim() || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email and password are required.'
    });
  }

  const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password');

  // Identical response for "unknown email" and "wrong password" so the endpoint
  // cannot be used to enumerate registered accounts.
  const invalid = () =>
    res.status(401).json({ success: false, message: 'Invalid email or password.' });

  if (!user) return invalid();

  // The only accepted credential is the stored bcrypt hash. The previous build
  // also accepted the literals "Password123!", "admin123" and "user123" for
  // any account, which let anyone sign in as the administrator.
  const isMatch = await user.comparePassword(password);
  if (!isMatch) return invalid();

  const tokens = signTokens(user);
  setAuthCookie(res, tokens.accessToken);

  return res.json({
    success: true,
    message: 'Login successful.',
    data: { user: user.toJSON(), ...tokens }
  });
});

/**
 * GET /api/auth/me
 */
export const getCurrentUser = asyncHandler(async (req, res) => {
  // No "fall back to the first user in the database" behaviour here — an
  // unknown id is an authentication failure, not a reason to hand over
  // somebody else's profile.
  const user = await User.findById(req.user.userId);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Account no longer exists.' });
  }

  const payload = user.toJSON();
  // `user` is nested as well because several pages read `data.user`.
  return res.json({ success: true, data: { ...payload, user: payload } });
});

/**
 * PUT /api/auth/me
 */
export const updateCurrentUser = asyncHandler(async (req, res) => {
  // Explicit allow-list: a client cannot promote itself to admin, change its
  // password hash directly, or overwrite its tokenVersion through this route.
  const allowed = [
    'name',
    'phone',
    'avatar',
    'address',
    'emergencyContact',
    'subscriptionPlan',
    'subscriptionValidUntil'
  ];

  const updates = {};
  for (const field of allowed) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ success: false, message: 'No updatable fields were provided.' });
  }

  const user = await User.findByIdAndUpdate(req.user.userId, updates, {
    new: true,
    runValidators: true
  });

  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }

  const payload = user.toJSON();
  return res.json({ success: true, data: { ...payload, user: payload } });
});

/**
 * POST /api/auth/change-password
 */
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      message: 'Current password and new password are required.'
    });
  }

  const passwordError = validatePassword(newPassword);
  if (passwordError) {
    return res.status(400).json({ success: false, message: passwordError });
  }

  const user = await User.findById(req.user.userId).select('+password');
  if (!user) {
    return res.status(401).json({ success: false, message: 'Account no longer exists.' });
  }

  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    return res.status(401).json({ success: false, message: 'Your current password is incorrect.' });
  }

  user.password = newPassword;
  // Invalidates every refresh token issued before this change.
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  await user.save();

  const tokens = signTokens(user);
  setAuthCookie(res, tokens.accessToken);

  return res.json({
    success: true,
    message: 'Password updated successfully.',
    data: tokens
  });
});

/**
 * POST /api/auth/logout
 */
export const logoutUser = asyncHandler(async (_req, res) => {
  clearAuthCookie(res);
  return res.json({ success: true, message: 'Logged out successfully.' });
});

/**
 * POST /api/auth/refresh
 *
 * The previous implementation ignored the request entirely and issued a token
 * for whichever user happened to be first in the database — usually the
 * administrator — so any anonymous caller could mint admin credentials. A
 * valid, current refresh token is now mandatory.
 */
export const refreshToken = asyncHandler(async (req, res) => {
  const token = req.body?.refreshToken || req.cookies?.petcare_refresh;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Refresh token is required.' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, REFRESH_SECRET);
  } catch {
    return res.status(401).json({
      success: false,
      message: 'Your session has expired. Please sign in again.'
    });
  }

  const user = await User.findById(decoded.userId);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Account no longer exists.' });
  }

  // Rejects tokens issued before the last logout-everywhere / password change.
  if ((decoded.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) {
    return res.status(401).json({
      success: false,
      message: 'Your session is no longer valid. Please sign in again.'
    });
  }

  const tokens = signTokens(user);
  setAuthCookie(res, tokens.accessToken);

  return res.json({ success: true, data: tokens });
});
