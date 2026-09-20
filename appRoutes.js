import { Router } from 'express';
import authRoutes from './routes/auth.routes.js';
import petRoutes from './routes/pet.routes.js';
import bookingRoutes from './routes/booking.routes.js';
import providerRoutes from './routes/provider.routes.js';
import productRoutes from './routes/product.routes.js';
import orderRoutes from './routes/order.routes.js';
import petListingRoutes from './routes/petListing.routes.js';
import aiRoutes from './routes/ai.routes.js';
import miscRoutes from './routes/misc.routes.js';
import adminRoutes from './routes/admin.routes.js';
import { getCategories, validateCoupon } from './controllers/product.controller.js';

const appRoutes = Router();

// 1. Authentication (/api/auth)
appRoutes.use('/auth', authRoutes);

// 2. Pet profiles, health passport, vaccines & medicines (/api/pets)
appRoutes.use('/pets', petRoutes);

// 3. Appointments & service bookings (/api/bookings)
appRoutes.use('/bookings', bookingRoutes);

// 4. Store catalogue (/api/products) and its shortcuts
appRoutes.use('/products', productRoutes);
appRoutes.get('/categories', getCategories);
appRoutes.get('/categories/list', getCategories);
appRoutes.post('/coupon/apply', validateCoupon);
appRoutes.post('/coupon/validate', validateCoupon);

// 5. E-commerce orders & checkout (/api/orders)
appRoutes.use('/orders', orderRoutes);

// 6. Buy, sell & adoption marketplace
appRoutes.use('/pet-listings', petListingRoutes);
appRoutes.use('/pets/market/listings', petListingRoutes);

// 7. AI veterinary assistant & telehealth (/api/ai)
appRoutes.use('/ai', aiRoutes);

// 8. Admin analytics (/api/admin)
appRoutes.use('/admin', adminRoutes);

// 9. Care providers — mounted at the API root so /api/vets, /api/groomers and
//    /api/sitters keep working alongside /api/providers/*.
appRoutes.use('/providers', providerRoutes);
appRoutes.use('/', providerRoutes);

// 10. Calendar, emergency clinics & notifications, also mounted at the root.
//     Both root mounts are declared last so they can never shadow a more
//     specific prefix above.
appRoutes.use('/', miscRoutes);

export default appRoutes;
