import { Router } from 'express';
import { getAdminStats } from '../controllers/admin.controller.js';
import { requireAuth, requireAdmin, verifyAccountActive } from '../middleware/auth.js';

const router = Router();

// Platform analytics were previously readable by anyone who knew the URL.
router.get('/stats', requireAuth, requireAdmin, verifyAccountActive, getAdminStats);

export default router;
