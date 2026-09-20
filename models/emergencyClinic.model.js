import mongoose from 'mongoose';

// Emergency Clinic Schema definition using new mongoose.Schema
const emergencyClinicSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    address: { type: String, required: true },
    phone: { type: String, required: true },
    hours: { type: String, default: '24/7 Emergency & Critical Care' },
    isOpen24Hours: { type: Boolean, default: true },
    distance: { type: String, default: '1.8 miles' },
    emergencyFee: { type: Number, default: 85 },
    facilities: {
      type: [String],
      default: ['Oxygen Therapy', 'CT/Ultrasound Scan', 'Trauma Surgery', 'ICU']
    },
    lat: { type: Number, default: 44.0462 },
    lng: { type: Number, default: -123.022 }
  },
  { timestamps: true }
);

export const EmergencyClinic = mongoose.models.EmergencyClinic || mongoose.model('EmergencyClinic', emergencyClinicSchema);
export default EmergencyClinic;
