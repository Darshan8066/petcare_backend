import mongoose from 'mongoose';

// Notification Schema definition using new mongoose.Schema
const notificationSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: ['vaccination', 'medicine', 'booking', 'order', 'alert', 'promo'],
      default: 'alert'
    },
    read: { type: Boolean, default: false },
    relatedId: { type: String, default: null }
  },
  { timestamps: true }
);

export const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
export default Notification;
