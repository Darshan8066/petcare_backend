import mongoose from 'mongoose';

// Medical Record Schema — clinical history entries attached to a pet
const medicalRecordSchema = new mongoose.Schema(
  {
    petId: { type: String, required: true, index: true },
    date: {
      type: String,
      required: true,
      default: () => new Date().toISOString().split('T')[0]
    },
    type: {
      type: String,
      enum: ['Checkup', 'Dental', 'Surgery', 'Vaccination', 'Emergency', 'Lab Work', 'Other'],
      default: 'Checkup'
    },
    title: { type: String, required: true, trim: true },
    veterinarian: { type: String, default: '' },
    clinic: { type: String, default: '' },
    diagnosis: { type: String, default: '' },
    treatment: { type: String, default: '' },
    notes: { type: String, default: '' }
  },
  { timestamps: true }
);

export const MedicalRecord =
  mongoose.models.MedicalRecord || mongoose.model('MedicalRecord', medicalRecordSchema);
export default MedicalRecord;
