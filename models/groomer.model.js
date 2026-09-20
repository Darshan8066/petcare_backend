import mongoose from 'mongoose';

// Groomer Schema definition using new mongoose.Schema
const groomerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    businessName: { type: String, required: true },
    photo: { type: String, required: true },
    rating: { type: Number, default: 4.8 },
    reviewCount: { type: Number, default: 55 },
    location: { type: String, required: true },
    services: [
      {
        id: String,
        name: String,
        duration: String,
        price: Number,
        description: String
      }
    ],
    providesHomeGrooming: { type: Boolean, default: true },
    providesSalonGrooming: { type: Boolean, default: true },
    about: { type: String, default: '' }
  },
  { timestamps: true }
);

export const Groomer = mongoose.models.Groomer || mongoose.model('Groomer', groomerSchema);
export default Groomer;
