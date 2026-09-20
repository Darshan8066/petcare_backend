import { Veterinarian, Groomer, PetSitter } from '../models/index.js';
import { asyncHandler } from '../middleware/errorHandler.js';

/** GET /api/vets | /api/pet-specialists | /api/pet-doctors */
export const getAllPetSpecialists = asyncHandler(async (_req, res) => {
  const specialists = await Veterinarian.find().sort({ rating: -1, name: 1 });
  return res.json({ success: true, count: specialists.length, data: specialists });
});

/** GET /api/vets/:id | /api/pet-specialists/:id */
export const getPetSpecialistById = asyncHandler(async (req, res) => {
  const specialist = await Veterinarian.findById(req.params.id);
  if (!specialist) {
    return res.status(404).json({ success: false, message: 'Pet specialist not found.' });
  }
  return res.json({ success: true, data: specialist });
});

/** GET /api/groomers */
export const getAllGroomers = asyncHandler(async (_req, res) => {
  const groomers = await Groomer.find().sort({ rating: -1, name: 1 });
  return res.json({ success: true, count: groomers.length, data: groomers });
});

/** GET /api/sitters */
export const getAllSitters = asyncHandler(async (_req, res) => {
  const sitters = await PetSitter.find().sort({ rating: -1, name: 1 });
  return res.json({ success: true, count: sitters.length, data: sitters });
});

// Backwards-compatible aliases used by the /vets routes.
export const getAllVets = getAllPetSpecialists;
export const getVetById = getPetSpecialistById;
