import mongoose from 'mongoose';

// Pet Schema definition using new mongoose.Schema
const petSchema = new mongoose.Schema(
  {
    ownerId: {
      type: String,
      required: [true, 'Owner ID is required'],
      index: true
    },
    name: {
      type: String,
      required: [true, 'Pet name is required'],
      trim: true
    },
    species: {
      type: String,
      enum: ['Dog', 'Cat', 'Bird', 'Rabbit', 'Other'],
      default: 'Dog'
    },
    breed: {
      type: String,
      required: [true, 'Breed is required'],
      trim: true
    },
    gender: {
      type: String,
      enum: ['Male', 'Female'],
      default: 'Male'
    },
    dateOfBirth: {
      type: String,
      default: '2022-04-12'
    },
    weight: {
      type: Number,
      default: 12.5 // kg
    },
    color: {
      type: String,
      default: 'Golden Honey'
    },
    avatar: {
      type: String,
      default: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400&auto=format&fit=crop&q=80'
    },
    microchipped: {
      type: Boolean,
      default: true
    },
    microchipNumber: {
      type: String,
      default: '985141002348911'
    },
    allergies: {
      type: [String],
      default: ['Chicken', 'Beef Protein']
    },
    medicalConditions: {
      type: [String],
      default: ['Mild Seasonal Allergies']
    },
    notes: {
      type: String,
      default: 'Very friendly, loves fetch in the park, sensitive to chicken food.'
    },
    primaryVet: {
      name: { type: String, default: 'Dr. Sarah Jenkins, DVM' },
      clinic: { type: String, default: 'Oakwood Veterinary Medical Center' },
      phone: { type: String, default: '+1 (555) 328-9901' }
    },
    insurance: {
      provider: { type: String, default: 'Trupanion Pet Health' },
      policyNumber: { type: String, default: 'TRU-98214-B' }
    }
  },
  {
    timestamps: true
  }
);

export const Pet = mongoose.models.Pet || mongoose.model('Pet', petSchema);
export default Pet;
