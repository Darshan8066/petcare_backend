import { Router } from 'express';
import {
  registerUser,
  loginUser,
  getCurrentUser,
  updateCurrentUser,
  changePassword,
  logoutUser,
  refreshToken
} from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';

const router = Router();

// Public endpoints. Credential routes are rate limited to slow down
// brute-force and credential-stuffing attempts.
router.post('/register', authLimiter, registerUser);
router.post('/login', authLimiter, loginUser);
router.post('/refresh', authLimiter, refreshToken);
router.post('/logout', logoutUser);

// The /auth/demo-login endpoint was removed: it handed out a valid session for
// a built-in account to any anonymous caller.

// Protected profile endpoints
router.get('/me', requireAuth, getCurrentUser);
router.put('/me', requireAuth, updateCurrentUser);
router.post('/change-password', requireAuth, authLimiter, changePassword);

export default router;
