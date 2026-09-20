import mongoose from 'mongoose';

// Pet Sitter & Walker Schema definition using new mongoose.Schema
const petSitterSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    photo: { type: String, required: true },
    rating: { type: Number, default: 4.9 },
    reviewCount: { type: Number, default: 42 },
    location: { type: String, required: true },
    verified: { type: Boolean, default: true },
    experienceYears: { type: Number, default: 4 },
    services: [
      {
        name: String,
        rate: Number,
        unit: String
      }
    ],
    about: { type: String, default: '' },
    availability: { type: String, default: 'Available this week' }
  },
  { timestamps: true }
);

export const PetSitter = mongoose.models.PetSitter || mongoose.model('PetSitter', petSitterSchema);
export default PetSitter;
