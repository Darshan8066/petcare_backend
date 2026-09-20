import { Product, Coupon } from '../models/index.js';
import { asyncHandler } from '../middleware/errorHandler.js';

/** Escapes user input before it is used inside a RegExp. */
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * GET /api/products
 * Filtering, search and pagination are performed by MongoDB rather than by
 * loading the whole catalogue into memory and filtering in JavaScript.
 */
export const getAllProducts = asyncHandler(async (req, res) => {
  const { category, targetPet, search, featured } = req.query;

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 60));

  const filter = {};

  if (category && category !== 'All') {
    filter.category = new RegExp(`^${escapeRegex(category)}$`, 'i');
  }

  if (targetPet && targetPet !== 'All') {
    // "All"-audience products stay visible when filtering by species.
    filter.targetPet = { $in: [new RegExp(`^${escapeRegex(targetPet)}$`, 'i'), 'All'] };
  }

  if (featured === 'true') {
    filter.$or = [{ isFeatured: true }, { isBestSeller: true }];
  }

  if (search && String(search).trim()) {
    const term = new RegExp(escapeRegex(String(search).trim()), 'i');
    const searchClause = [{ title: term }, { brand: term }, { description: term }];
    // Combine with an existing $or (from `featured`) without overwriting it.
    filter.$and = filter.$or ? [{ $or: filter.$or }, { $or: searchClause }] : [{ $or: searchClause }];
    delete filter.$or;
  }

  const [products, total] = await Promise.all([
    Product.find(filter)
      .sort({ isFeatured: -1, rating: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Product.countDocuments(filter)
  ]);

  return res.json({
    success: true,
    count: products.length,
    total,
    page,
    totalPages: Math.ceil(total / limit) || 1,
    data: products
  });
});

/** GET /api/categories */
export const getCategories = asyncHandler(async (_req, res) => {
  const categories = await Product.distinct('category');
  return res.json({ success: true, data: categories.filter(Boolean).sort() });
});

/** GET /api/products/:id */
export const getProductById = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found.' });
  }
  return res.json({ success: true, data: product });
});

/** POST /api/products — administrators only */
export const createProduct = asyncHandler(async (req, res) => {
  const {
    title,
    brand = 'PetCare Essentials',
    category = 'Pet Accessories',
    targetPet = 'All',
    price,
    originalPrice,
    rating,
    reviewCount,
    image,
    description,
    inStock = true,
    stockCount = 50,
    tags = []
  } = req.body;

  if (!title?.trim() || price === undefined || price === null) {
    return res.status(400).json({
      success: false,
      message: 'Product title and price are required.'
    });
  }

  const numericPrice = Number(price);
  if (Number.isNaN(numericPrice) || numericPrice < 0) {
    return res.status(400).json({ success: false, message: 'Price must be a positive number.' });
  }

  const product = await Product.create({
    title: title.trim(),
    brand,
    category,
    targetPet,
    price: numericPrice,
    originalPrice: originalPrice ? Number(originalPrice) : null,
    rating: Number(rating) || 4.9,
    reviewCount: Number(reviewCount) || 0,
    image:
      image ||
      'https://images.unsplash.com/photo-1576201836106-db1758fd1c97?w=500&auto=format&fit=crop&q=80',
    description: description || 'Premium pet care accessory tested for durability and comfort.',
    inStock: Boolean(inStock),
    stockCount: Number(stockCount) || 0,
    tags: Array.isArray(tags) ? tags : []
  });

  return res.status(201).json({ success: true, message: 'Product added successfully!', data: product });
});

/** PUT/PATCH /api/products/:id — administrators only */
export const updateProduct = asyncHandler(async (req, res) => {
  const { _id, createdAt, updatedAt, ...updates } = req.body;

  const updated = await Product.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true
  });

  if (!updated) {
    return res.status(404).json({ success: false, message: 'Product not found.' });
  }

  return res.json({ success: true, message: 'Product updated successfully.', data: updated });
});

/** DELETE /api/products/:id — administrators only */
export const deleteProduct = asyncHandler(async (req, res) => {
  const deleted = await Product.findByIdAndDelete(req.params.id);
  if (!deleted) {
    return res.status(404).json({ success: false, message: 'Product not found.' });
  }
  return res.json({ success: true, message: 'Product deleted successfully.' });
});

/**
 * Looks up a coupon and works out the discount for a given subtotal.
 * Shared by the coupon endpoint and by checkout so both apply identical rules.
 */
export const resolveCoupon = async (code, subtotal) => {
  if (!code) return { error: 'Coupon code required.', status: 400 };

  const coupon = await Coupon.findOne({ code: String(code).trim().toUpperCase() });
  if (!coupon || !coupon.isUsable()) {
    return { error: 'Invalid or expired promo code.', status: 404 };
  }

  const amount = Number(subtotal) || 0;
  if (amount < coupon.minSpend) {
    return {
      error: `Coupon requires a minimum order of $${coupon.minSpend}.`,
      status: 400
    };
  }

  const rawDiscount = (amount * coupon.discountPercent) / 100;
  const discountAmount = Math.round(Math.min(rawDiscount, coupon.maxDiscount) * 100) / 100;

  return { coupon, discountAmount };
};

/** POST /api/coupon/apply | /api/coupon/validate */
export const validateCoupon = asyncHandler(async (req, res) => {
  const { code, cartTotal, subtotal } = req.body;
  const amount = cartTotal !== undefined ? cartTotal : subtotal;

  const result = await resolveCoupon(code, amount);
  if (result.error) {
    return res.status(result.status).json({ success: false, message: result.error });
  }

  return res.json({
    success: true,
    message: `${result.coupon.discountPercent}% discount applied!`,
    data: {
      code: result.coupon.code,
      discountPercent: result.coupon.discountPercent,
      discountAmount: result.discountAmount
    }
  });
});
