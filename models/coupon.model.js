import mongoose from 'mongoose';

// Discount Coupon Schema — replaces the previous hard-coded in-memory Map
const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true
    },
    discountPercent: { type: Number, required: true, min: 1, max: 100 },
    maxDiscount: { type: Number, default: 50 },
    minSpend: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    expiresAt: { type: Date, default: null }
  },
  { timestamps: true }
);

// A coupon is usable when it is active and either has no expiry or has not expired yet.
couponSchema.methods.isUsable = function isUsable() {
  if (!this.active) return false;
  if (this.expiresAt && this.expiresAt.getTime() < Date.now()) return false;
  return true;
};

export const Coupon = mongoose.models.Coupon || mongoose.model('Coupon', couponSchema);
export default Coupon;
