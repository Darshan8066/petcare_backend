import { Router } from 'express';
import {
  getEmergencyClinics,
  getCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  getNotifications,
  markNotificationsRead
} from '../controllers/misc.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Public: emergency clinic directory
router.get('/emergency', getEmergencyClinics);
router.get('/emergency-clinics', getEmergencyClinics);

// Private: care calendar
router.get('/calendar', requireAuth, getCalendarEvents);
router.post('/calendar', requireAuth, createCalendarEvent);
router.patch('/calendar/:id', requireAuth, updateCalendarEvent);
router.put('/calendar/:id', requireAuth, updateCalendarEvent);
router.delete('/calendar/:id', requireAuth, deleteCalendarEvent);

// Private: notifications
router.get('/notifications', requireAuth, getNotifications);
router.put('/notifications/read', requireAuth, markNotificationsRead);
router.post('/notifications/read-all', requireAuth, markNotificationsRead);
router.post('/notifications/read', requireAuth, markNotificationsRead);

export default router;
