import { Router } from 'express';
import {
  getAllPetSpecialists,
  getPetSpecialistById,
  getAllVets,
  getVetById,
  getAllGroomers,
  getAllSitters
} from '../controllers/provider.controller.js';

const router = Router();

// Pet Specialists (also accessible via /pet-specialists and /vets)
router.get('/pet-specialists', getAllPetSpecialists);
router.get('/pet-specialists/:id', getPetSpecialistById);
router.get('/pet-doctors', getAllPetSpecialists);
router.get('/pet-doctors/:id', getPetSpecialistById);
router.get('/vets', getAllVets);
router.get('/vets/:id', getVetById);

// Groomers
router.get('/groomers', getAllGroomers);

// Sitters & Walkers
router.get('/sitters', getAllSitters);

export default router;
