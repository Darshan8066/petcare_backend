import { Order, Product } from '../models/index.js';
import { resolveCoupon } from './product.controller.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const TAX_RATE = 0.07;
const FREE_SHIPPING_THRESHOLD = 49;
const FLAT_SHIPPING = 5.99;

const round = (n) => Math.round(n * 100) / 100;

/** GET /api/orders */
export const getUserOrders = asyncHandler(async (req, res) => {
  // Previously, a customer with no orders was shown every order in the system.
  // The result is now always scoped to the signed-in account.
  const filter = req.user.role === 'admin' ? {} : { userId: req.user.userId };
  const orders = await Order.find(filter).sort({ createdAt: -1 });
  return res.json({ success: true, data: orders });
});

/**
 * POST /api/orders | /api/orders/checkout
 *
 * Prices are read from the database using the submitted product ids. The
 * client's own price figures are ignored, so a tampered cart cannot change
 * what is charged. The previous version read `item.product.price`, which the
 * checkout form never sends, so every order was stored with a total of $0.
 */
export const createOrder = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { items = [], shippingAddress, paymentMethod = 'Credit Card', couponCode } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'Your cart is empty.' });
  }

  if (items.length > 50) {
    return res.status(400).json({ success: false, message: 'Too many items in one order.' });
  }

  // Accepts both { productId, quantity } and the legacy { product: {_id}, quantity }.
  const normalised = items.map((item) => ({
    productId: item.productId || item.product?._id || item._id,
    quantity: Math.max(1, Math.min(99, Number(item.quantity) || 1))
  }));

  if (normalised.some((i) => !i.productId)) {
    return res.status(400).json({
      success: false,
      message: 'Every cart item must reference a product.'
    });
  }

  const products = await Product.find({ _id: { $in: normalised.map((i) => i.productId) } });
  const productMap = new Map(products.map((p) => [p._id.toString(), p]));

  const orderItems = [];
  let subtotal = 0;

  for (const entry of normalised) {
    const product = productMap.get(String(entry.productId));

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'One or more products in your cart are no longer available.'
      });
    }

    if (!product.inStock || product.stockCount < entry.quantity) {
      return res.status(409).json({
        success: false,
        message: `"${product.title}" does not have enough stock available.`
      });
    }

    const lineTotal = product.price * entry.quantity;
    subtotal += lineTotal;

    orderItems.push({
      product: {
        title: product.title,
        brand: product.brand,
        image: product.image,
        price: product.price
      },
      quantity: entry.quantity,
      price: round(lineTotal)
    });
  }

  subtotal = round(subtotal);

  // Coupon rules are evaluated server-side against the recomputed subtotal.
  let discount = 0;
  let appliedCode = null;
  if (couponCode) {
    const result = await resolveCoupon(couponCode, subtotal);
    if (!result.error) {
      discount = result.discountAmount;
      appliedCode = result.coupon.code;
    }
  }

  const shipping = subtotal > FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING;
  const tax = round((subtotal - discount) * TAX_RATE);
  const total = round(subtotal - discount + shipping + tax);

  const order = await Order.create({
    userId,
    items: orderItems,
    subtotal,
    shipping,
    tax,
    discount,
    total,
    couponCode: appliedCode,
    shippingAddress: shippingAddress || undefined,
    paymentMethod,
    paymentStatus: 'paid',
    orderStatus: 'Processing'
  });

  // Decrement stock for each purchased line.
  await Promise.all(
    normalised.map((entry) =>
      Product.updateOne({ _id: entry.productId }, { $inc: { stockCount: -entry.quantity } })
    )
  );

  return res.status(201).json({
    success: true,
    message: 'Order placed successfully!',
    data: order
  });
});

/** GET /api/orders/:id */
export const getOrderById = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found.' });
  }
  if (req.user.role !== 'admin' && order.userId !== req.user.userId) {
    return res.status(403).json({ success: false, message: 'You do not have access to this order.' });
  }
  return res.json({ success: true, data: order });
});

/**
 * PATCH/PUT /api/orders/:id
 * Customers may cancel an order that has not shipped; only administrators can
 * move an order through the fulfilment statuses.
 */
export const updateOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found.' });
  }

  const isOwner = order.userId === req.user.userId;
  const isAdmin = req.user.role === 'admin';

  if (!isAdmin && !isOwner) {
    return res.status(403).json({ success: false, message: 'You do not have access to this order.' });
  }

  const updates = {};

  if (isAdmin) {
    for (const field of ['orderStatus', 'paymentStatus', 'trackingNumber', 'estimatedDelivery']) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
  } else if (req.body.orderStatus === 'Cancelled') {
    if (['Shipped', 'Out for Delivery', 'Delivered'].includes(order.orderStatus)) {
      return res.status(400).json({
        success: false,
        message: 'This order has already shipped and can no longer be cancelled.'
      });
    }
    updates.orderStatus = 'Cancelled';
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ success: false, message: 'No updatable fields were provided.' });
  }

  const updated = await Order.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true
  });

  return res.json({ success: true, message: 'Order updated successfully.', data: updated });
});
