import mongoose from 'mongoose';

// Pet Listing Schema for Buying, Selling & Adopting Pets
const petListingSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    species: {
      type: String,
      required: true
    },
    breed: {
      type: String,
      required: true
    },
    age: {
      type: String,
      required: true
    },
    gender: {
      type: String,
      enum: ['Male', 'Female'],
      default: 'Male'
    },
    price: {
      type: Number,
      default: 0
    },
    isForAdoption: {
      type: Boolean,
      default: false
    },
    location: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    photos: {
      type: [String],
      default: []
    },
    vaccinated: {
      type: Boolean,
      default: true
    },
    dewormed: {
      type: Boolean,
      default: true
    },
    healthCertificate: {
      type: Boolean,
      default: true
    },
    sellerId: {
      type: String,
      required: true
    },
    sellerName: {
      type: String,
      required: true
    },
    sellerPhone: {
      type: String,
      required: true
    },
    sellerEmail: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['available', 'reserved', 'sold'],
      default: 'available'
    }
  },
  {
    timestamps: true
  }
);

export const PetListing = mongoose.models.PetListing || mongoose.model('PetListing', petListingSchema);
export default PetListing;
