import { Router } from 'express';
import { handleAIChat, handleVideoConsultation } from '../controllers/ai.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';

const router = Router();

// The AI endpoints call a paid third-party model, so they require an account
// and carry their own rate limit.
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.AI_RATE_LIMIT) || 15,
  message: 'You are sending messages too quickly. Please wait a moment.'
});

router.use(requireAuth, aiLimiter);

// Veterinary chat & symptom triage
router.post('/chat', handleAIChat);
router.post('/diagnose', handleAIChat);
router.post('/ask', handleAIChat);

// Live video consultation assistant
router.post('/video-consultation', handleVideoConsultation);
router.post('/video-call', handleVideoConsultation);

export default router;
