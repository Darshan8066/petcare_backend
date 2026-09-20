import mongoose from 'mongoose';

// Vaccination Schema definition using new mongoose.Schema
const vaccinationSchema = new mongoose.Schema(
  {
    petId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    givenDate: { type: String, required: true },
    nextDueDate: { type: String, required: true },
    veterinarian: { type: String, default: 'Dr. Sarah Jenkins, DVM' },
    clinic: { type: String, default: 'Oakwood Veterinary Center' },
    batchNumber: { type: String, default: 'VAC-2024-88A' },
    status: {
      type: String,
      enum: ['up_to_date', 'due_soon', 'overdue'],
      default: 'up_to_date'
    },
    notes: { type: String, default: '' }
  },
  { timestamps: true }
);

export const Vaccination = mongoose.models.Vaccination || mongoose.model('Vaccination', vaccinationSchema);
export default Vaccination;
