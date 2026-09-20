import mongoose from 'mongoose';

// Medicine & Prescription Schema definition using new mongoose.Schema
const medicineSchema = new mongoose.Schema(
  {
    petId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    dosage: { type: String, required: true },
    frequency: {
      type: String,
      enum: ['Once daily', 'Twice daily', 'Every 8 hours', 'Weekly', 'Monthly', 'As needed'],
      default: 'Once daily'
    },
    timeOfDay: { type: [String], default: ['08:00 AM'] },
    startDate: { type: String, required: true },
    endDate: { type: String, default: null },
    instructions: { type: String, default: 'Give with food' },
    status: {
      type: String,
      enum: ['active', 'completed', 'paused'],
      default: 'active'
    },
    notes: { type: String, default: '' },
    history: [
      {
        date: String,
        time: String,
        status: { type: String, enum: ['taken', 'missed', 'skipped'], default: 'taken' }
      }
    ]
  },
  { timestamps: true }
);

export const Medicine = mongoose.models.Medicine || mongoose.model('Medicine', medicineSchema);
export default Medicine;
