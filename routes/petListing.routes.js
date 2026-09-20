import { Router } from 'express';
import {
  getAllListings,
  createListing,
  getListingById,
  updateListing,
  deleteListing,
  inquireOrReserveListing
} from '../controllers/petListing.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Public marketplace browsing
router.get('/', getAllListings);
router.get('/:id', getListingById);

// Managing a listing requires an account; the controller additionally checks
// that the caller is the seller.
router.post('/', requireAuth, createListing);
router.put('/:id', requireAuth, updateListing);
router.patch('/:id', requireAuth, updateListing);
router.delete('/:id', requireAuth, deleteListing);

// Enquiry & reservation
router.post('/:id/inquire', requireAuth, inquireOrReserveListing);

export default router;
