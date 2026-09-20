import { Pet, Vaccination, Medicine, MedicalRecord } from '../models/index.js';
import { asyncHandler } from '../middleware/errorHandler.js';

/** Derives vaccination status from the next due date. */
export const calculateVaccineStatus = (dueDateStr) => {
  const due = new Date(dueDateStr);
  if (Number.isNaN(due.getTime())) return 'up_to_date';
  const diffDays = Math.ceil((due.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'overdue';
  if (diffDays <= 30) return 'due_soon';
  return 'up_to_date';
};

/**
 * Loads a pet and confirms the caller owns it (admins bypass the check).
 * Every pet sub-resource goes through this, so one user can no longer read or
 * modify another user's records by guessing an id.
 */
const loadOwnedPet = async (petId, user) => {
  const pet = await Pet.findById(petId);
  if (!pet) return { error: { status: 404, message: 'Pet not found.' } };
  if (user.role !== 'admin' && pet.ownerId !== user.userId) {
    return { error: { status: 403, message: 'You do not have access to this pet.' } };
  }
  return { pet };
};

const deny = (res, error) => res.status(error.status).json({ success: false, message: error.message });

/** GET /api/pets */
export const getAllPets = asyncHandler(async (req, res) => {
  const pets = await Pet.find({ ownerId: req.user.userId }).sort({ createdAt: -1 });
  return res.json({ success: true, data: pets });
});

/** POST /api/pets */
export const createPet = asyncHandler(async (req, res) => {
  const {
    name,
    species = 'Dog',
    breed = 'Mixed',
    gender = 'Male',
    dateOfBirth,
    weight,
    color = '',
    avatar,
    microchipped = false,
    microchipNumber = '',
    allergies = [],
    medicalConditions = [],
    notes = '',
    primaryVet = {},
    insurance = {}
  } = req.body;

  if (!name?.trim()) {
    return res.status(400).json({ success: false, message: 'Pet name is required.' });
  }

  const defaultAvatar =
    species === 'Cat'
      ? 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400&auto=format&fit=crop&q=80'
      : 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400&auto=format&fit=crop&q=80';

  const pet = await Pet.create({
    // Ownership always comes from the verified token, never from the body.
    ownerId: req.user.userId,
    name: name.trim(),
    species,
    breed: breed?.trim() || 'Mixed',
    gender,
    dateOfBirth: dateOfBirth || '2023-01-01',
    weight: Number(weight) > 0 ? Number(weight) : 5,
    color,
    avatar: avatar || defaultAvatar,
    microchipped: Boolean(microchipped),
    microchipNumber,
    allergies: Array.isArray(allergies) ? allergies : [],
    medicalConditions: Array.isArray(medicalConditions) ? medicalConditions : [],
    notes,
    primaryVet,
    insurance
  });

  return res.status(201).json({ success: true, data: pet });
});

/** GET /api/pets/:id — profile plus full health passport */
export const getPetById = asyncHandler(async (req, res) => {
  const { pet, error } = await loadOwnedPet(req.params.id, req.user);
  if (error) return deny(res, error);

  const [rawVaccinations, medicines, medicalRecords] = await Promise.all([
    Vaccination.find({ petId: pet._id.toString() }).sort({ nextDueDate: 1 }),
    Medicine.find({ petId: pet._id.toString() }).sort({ createdAt: -1 }),
    MedicalRecord.find({ petId: pet._id.toString() }).sort({ date: -1 })
  ]);

  const vaccinations = rawVaccinations.map((v) => ({
    ...v.toObject(),
    status: calculateVaccineStatus(v.nextDueDate)
  }));

  return res.json({
    success: true,
    // Previously a placeholder medical record was invented whenever a pet had
    // none. An empty list is now returned so the UI reflects reality.
    data: { ...pet.toObject(), vaccinations, medicines, medicalRecords }
  });
});

/** PUT /api/pets/:id */
export const updatePet = asyncHandler(async (req, res) => {
  const { error } = await loadOwnedPet(req.params.id, req.user);
  if (error) return deny(res, error);

  // ownerId is excluded so a pet cannot be reassigned to another account.
  const { ownerId, _id, createdAt, updatedAt, ...updates } = req.body;

  const updated = await Pet.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true
  });

  return res.json({ success: true, data: updated });
});

/** DELETE /api/pets/:id — removes the pet and its entire health passport */
export const deletePet = asyncHandler(async (req, res) => {
  const { error } = await loadOwnedPet(req.params.id, req.user);
  if (error) return deny(res, error);

  const petId = req.params.id;
  await Promise.all([
    Pet.findByIdAndDelete(petId),
    Vaccination.deleteMany({ petId }),
    Medicine.deleteMany({ petId }),
    MedicalRecord.deleteMany({ petId })
  ]);

  return res.json({
    success: true,
    message: 'Pet and associated health passport deleted successfully.'
  });
});

/** GET /api/pets/:id/vaccinations */
export const getPetVaccinations = asyncHandler(async (req, res) => {
  const { error } = await loadOwnedPet(req.params.id, req.user);
  if (error) return deny(res, error);

  const records = await Vaccination.find({ petId: req.params.id }).sort({ nextDueDate: 1 });
  const data = records.map((v) => ({
    ...v.toObject(),
    status: calculateVaccineStatus(v.nextDueDate)
  }));

  return res.json({ success: true, data });
});

/** POST /api/pets/:id/vaccinations */
export const addPetVaccination = asyncHandler(async (req, res) => {
  const { error } = await loadOwnedPet(req.params.id, req.user);
  if (error) return deny(res, error);

  const { name, givenDate, nextDueDate, veterinarian, clinic, batchNumber, notes } = req.body;

  if (!name?.trim() || !nextDueDate) {
    return res.status(400).json({
      success: false,
      message: 'Vaccine name and next due date are required.'
    });
  }

  const record = await Vaccination.create({
    petId: req.params.id,
    name: name.trim(),
    givenDate: givenDate || new Date().toISOString().split('T')[0],
    nextDueDate,
    veterinarian: veterinarian || '',
    clinic: clinic || '',
    batchNumber: batchNumber || '',
    status: calculateVaccineStatus(nextDueDate),
    notes: notes || ''
  });

  return res.status(201).json({ success: true, data: record });
});

/** DELETE /api/pets/:id/vaccinations/:vacId */
export const deletePetVaccination = asyncHandler(async (req, res) => {
  const { error } = await loadOwnedPet(req.params.id, req.user);
  if (error) return deny(res, error);

  // Scoped by petId so a record belonging to another pet cannot be deleted.
  const deleted = await Vaccination.findOneAndDelete({
    _id: req.params.vacId,
    petId: req.params.id
  });

  if (!deleted) {
    return res.status(404).json({ success: false, message: 'Vaccination record not found.' });
  }

  return res.json({ success: true, message: 'Vaccination record deleted successfully.' });
});

/** GET /api/pets/:id/medicines */
export const getPetMedicines = asyncHandler(async (req, res) => {
  const { error } = await loadOwnedPet(req.params.id, req.user);
  if (error) return deny(res, error);

  const medicines = await Medicine.find({ petId: req.params.id }).sort({ createdAt: -1 });
  return res.json({ success: true, data: medicines });
});

/** POST /api/pets/:id/medicines */
export const addPetMedicine = asyncHandler(async (req, res) => {
  const { error } = await loadOwnedPet(req.params.id, req.user);
  if (error) return deny(res, error);

  const { name, dosage, frequency, timeOfDay, startDate, endDate, instructions, notes } = req.body;

  if (!name?.trim() || !dosage?.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Medicine name and dosage are required.'
    });
  }

  const medicine = await Medicine.create({
    petId: req.params.id,
    name: name.trim(),
    dosage: dosage.trim(),
    frequency: frequency || 'Once daily',
    timeOfDay: Array.isArray(timeOfDay) && timeOfDay.length ? timeOfDay : ['08:00 AM'],
    startDate: startDate || new Date().toISOString().split('T')[0],
    endDate: endDate || null,
    instructions: instructions || 'Give with food',
    status: 'active',
    notes: notes || '',
    history: []
  });

  return res.status(201).json({ success: true, data: medicine });
});

/** DELETE /api/pets/:id/medicines/:medId */
export const deletePetMedicine = asyncHandler(async (req, res) => {
  const { error } = await loadOwnedPet(req.params.id, req.user);
  if (error) return deny(res, error);

  const deleted = await Medicine.findOneAndDelete({
    _id: req.params.medId,
    petId: req.params.id
  });

  if (!deleted) {
    return res.status(404).json({ success: false, message: 'Medication schedule not found.' });
  }

  return res.json({ success: true, message: 'Medication schedule deleted successfully.' });
});

/** GET /api/pets/:id/medical-records */
export const getPetMedicalRecords = asyncHandler(async (req, res) => {
  const { error } = await loadOwnedPet(req.params.id, req.user);
  if (error) return deny(res, error);

  const records = await MedicalRecord.find({ petId: req.params.id }).sort({ date: -1 });
  return res.json({ success: true, data: records });
});

/** POST /api/pets/:id/medical-records */
export const addPetMedicalRecord = asyncHandler(async (req, res) => {
  const { error } = await loadOwnedPet(req.params.id, req.user);
  if (error) return deny(res, error);

  const { date, type, title, veterinarian, clinic, diagnosis, treatment, notes } = req.body;

  if (!title?.trim()) {
    return res.status(400).json({ success: false, message: 'Record title is required.' });
  }

  const record = await MedicalRecord.create({
    petId: req.params.id,
    date: date || new Date().toISOString().split('T')[0],
    type: type || 'Checkup',
    title: title.trim(),
    veterinarian: veterinarian || '',
    clinic: clinic || '',
    diagnosis: diagnosis || '',
    treatment: treatment || '',
    notes: notes || ''
  });

  return res.status(201).json({ success: true, data: record });
});

/** DELETE /api/pets/:id/medical-records/:recId */
export const deletePetMedicalRecord = asyncHandler(async (req, res) => {
  const { error } = await loadOwnedPet(req.params.id, req.user);
  if (error) return deny(res, error);

  const deleted = await MedicalRecord.findOneAndDelete({
    _id: req.params.recId,
    petId: req.params.id
  });

  if (!deleted) {
    return res.status(404).json({ success: false, message: 'Medical record not found.' });
  }

  return res.json({ success: true, message: 'Medical record deleted successfully.' });
});
