import { Router } from 'express';
import {
  getBookings,
  getBookedSlots,
  createBooking,
  updateBooking,
  cancelBooking
} from '../controllers/booking.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Public: slot availability only exposes times, never customer details.
router.get('/booked-slots', getBookedSlots);

// Private appointment management
router.get('/', requireAuth, getBookings);
router.post('/', requireAuth, createBooking);
router.patch('/:id', requireAuth, updateBooking);
router.put('/:id', requireAuth, updateBooking);
router.put('/:id/cancel', requireAuth, cancelBooking);

export default router;
