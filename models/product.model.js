import mongoose from 'mongoose';

// Product Schema definition using new mongoose.Schema
const productSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    brand: {
      type: String,
      required: true,
      trim: true
    },
    category: {
      type: String,
      required: true
    },
    targetPet: {
      type: String,
      enum: ['Dog', 'Cat', 'All'],
      default: 'All'
    },
    price: {
      type: Number,
      required: true
    },
    originalPrice: {
      type: Number,
      default: null
    },
    rating: {
      type: Number,
      default: 4.8
    },
    reviewCount: {
      type: Number,
      default: 120
    },
    image: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    ingredients: {
      type: String,
      default: ''
    },
    inStock: {
      type: Boolean,
      default: true
    },
    stockCount: {
      type: Number,
      default: 50
    },
    isBestSeller: {
      type: Boolean,
      default: false
    },
    isFeatured: {
      type: Boolean,
      default: false
    },
    tags: {
      type: [String],
      default: []
    }
  },
  {
    timestamps: true
  }
);

export const Product = mongoose.models.Product || mongoose.model('Product', productSchema);
export default Product;
