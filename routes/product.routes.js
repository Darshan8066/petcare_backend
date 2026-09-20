import { Router } from 'express';
import {
  getAllProducts,
  getProductById,
  getCategories,
  createProduct,
  updateProduct,
  deleteProduct,
  validateCoupon
} from '../controllers/product.controller.js';
import { requireAuth, requireAdmin, verifyAccountActive } from '../middleware/auth.js';

const router = Router();

// --- Public catalogue ---
// Static paths are declared before '/:id' so they are matched first.
router.get('/categories/list', getCategories);
router.get('/categories', getCategories);
router.post('/coupon/apply', validateCoupon);
router.post('/coupon/validate', validateCoupon);

router.get('/', getAllProducts);
router.get('/:id', getProductById);

// --- Administrator-only catalogue management ---
// These routes previously had no authentication, so any anonymous visitor
// could create, edit or delete store products.
const adminOnly = [requireAuth, requireAdmin, verifyAccountActive];

router.post('/', adminOnly, createProduct);
router.put('/:id', adminOnly, updateProduct);
router.patch('/:id', adminOnly, updateProduct);
router.delete('/:id', adminOnly, deleteProduct);

export default router;
