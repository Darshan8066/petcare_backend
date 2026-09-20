import mongoose from 'mongoose';

// Booking Schema definition using new mongoose.Schema
const bookingSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true
    },
    petId: {
      type: String,
      default: 'pet_default'
    },
    petName: {
      type: String,
      default: 'My Pet'
    },
    // Both the current (pet_*) and legacy (vet_*) vocabularies are accepted so
    // that existing documents keep validating after the migration.
    type: {
      type: String,
      enum: [
        'pet_clinic',
        'pet_video',
        'vet_clinic',
        'vet_video',
        'grooming',
        'pet_sitting',
        'dog_walking'
      ],
      required: true
    },
    providerId: {
      type: String,
      default: 'any'
    },
    providerName: {
      type: String,
      default: 'PetCare Verified Provider'
    },
    providerClinicOrBusiness: {
      type: String,
      default: 'PetCare Network'
    },
    date: {
      type: String,
      required: true
    },
    timeSlot: {
      type: String,
      required: true
    },
    reason: {
      type: String,
      default: 'Routine wellness checkup'
    },
    serviceName: {
      type: String,
      default: 'General Pet Care'
    },
    fee: {
      type: Number,
      default: 45
    },
    serviceFee: {
      type: Number,
      default: 4.5
    },
    discount: {
      type: Number,
      default: 0
    },
    total: {
      type: Number,
      default: 49.5
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'refunded'],
      default: 'confirmed'
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'paid'
    },
    paymentId: {
      type: String,
      default: null
    },
    notes: {
      type: String,
      default: ''
    },
    videoMeetingUrl: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true
  }
);

export const Booking = mongoose.models.Booking || mongoose.model('Booking', bookingSchema);
export default Booking;
