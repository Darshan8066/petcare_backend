import mongoose from 'mongoose';

// Veterinarian Schema definition using new mongoose.Schema
const veterinarianSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    photo: { type: String, required: true },
    title: { type: String, default: 'Veterinary Surgeon (DVM)' },
    specialty: { type: String, required: true },
    qualification: { type: String, default: 'BVSc & AH, MVSc' },
    experienceYears: { type: Number, default: 5 },
    clinicName: { type: String, required: true },
    clinicAddress: { type: String, required: true },
    consultationFee: { type: Number, default: 50 },
    videoConsultationFee: { type: Number, default: 35 },
    rating: { type: Number, default: 4.9 },
    reviewCount: { type: Number, default: 80 },
    about: { type: String, default: '' },
    availableDays: { type: [String], default: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] },
    availableSlots: { type: [String], default: ['09:00 AM', '11:00 AM', '02:00 PM', '04:30 PM'] },
    phone: { type: String, default: '+1 (555) 328-9901' },
    isAvailableToday: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export const Veterinarian = mongoose.models.Veterinarian || mongoose.model('Veterinarian', veterinarianSchema);
export default Veterinarian;
