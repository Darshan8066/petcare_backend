import mongoose from 'mongoose';

// Order Schema definition using new mongoose.Schema
const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true
    },
    items: [
      {
        product: {
          title: String,
          brand: String,
          image: String,
          price: Number
        },
        quantity: { type: Number, default: 1 },
        price: { type: Number, required: true }
      }
    ],
    subtotal: { type: Number, required: true },
    shipping: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    total: { type: Number, required: true },
    couponCode: { type: String, default: null },
    shippingAddress: {
      fullName: { type: String, default: 'Jane Doe' },
      street: { type: String, default: '742 Evergreen Terrace' },
      city: { type: String, default: 'Springfield' },
      state: { type: String, default: 'OR' },
      zipCode: { type: String, default: '97477' },
      phone: { type: String, default: '+1 (555) 234-5678' }
    },
    paymentMethod: { type: String, default: 'Credit Card (Mock Demo)' },
    paymentStatus: {
      type: String,
      enum: ['paid', 'pending', 'failed'],
      default: 'paid'
    },
    orderStatus: {
      type: String,
      enum: ['Processing', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled'],
      default: 'Processing'
    },
    trackingNumber: {
      type: String,
      default: () => 'PET-' + Math.floor(100000 + Math.random() * 900000)
    },
    estimatedDelivery: {
      type: String,
      default: () => new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    }
  },
  {
    timestamps: true
  }
);

export const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);
export default Order;
