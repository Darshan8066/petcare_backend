import { Router } from 'express';
import {
  getUserOrders,
  createOrder,
  getOrderById,
  updateOrder
} from '../controllers/order.controller.js';
import { validateCoupon } from '../controllers/product.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Coupon validation (kept here as well because the cart calls
// /api/orders/coupon/validate). Declared before /:id so it is not
// swallowed by the parameterised route.
router.post('/coupon/validate', validateCoupon);
router.post('/coupon/apply', validateCoupon);

// Orders are always scoped to the signed-in account.
router.use(requireAuth);

router.get('/', getUserOrders);
router.post('/', createOrder);
router.post('/checkout', createOrder);
router.get('/:id', getOrderById);
router.patch('/:id', updateOrder);
router.put('/:id', updateOrder);

export default router;
