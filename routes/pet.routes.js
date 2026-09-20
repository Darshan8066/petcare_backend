import { Router } from 'express';
import {
  getAllPets,
  createPet,
  getPetById,
  updatePet,
  deletePet,
  getPetVaccinations,
  addPetVaccination,
  deletePetVaccination,
  getPetMedicines,
  addPetMedicine,
  deletePetMedicine,
  getPetMedicalRecords,
  addPetMedicalRecord,
  deletePetMedicalRecord
} from '../controllers/pet.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Everything under /api/pets is private to the authenticated owner.
router.use(requireAuth);

// Pet profiles
router.get('/', getAllPets);
router.post('/', createPet);
router.get('/:id', getPetById);
router.put('/:id', updatePet);
router.patch('/:id', updatePet);
router.delete('/:id', deletePet);

// Vaccinations
router.get('/:id/vaccinations', getPetVaccinations);
router.post('/:id/vaccinations', addPetVaccination);
router.delete('/:id/vaccinations/:vacId', deletePetVaccination);

// Medicine schedules & reminders
router.get('/:id/medicines', getPetMedicines);
router.post('/:id/medicines', addPetMedicine);
router.delete('/:id/medicines/:medId', deletePetMedicine);

// Medical records
router.get('/:id/medical-records', getPetMedicalRecords);
router.post('/:id/medical-records', addPetMedicalRecord);
router.delete('/:id/medical-records/:recId', deletePetMedicalRecord);

export default router;
