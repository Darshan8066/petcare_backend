import { User, Pet, Booking, Order, Product, PetListing } from '../models/index.js';
import { asyncHandler } from '../middleware/errorHandler.js';

/**
 * GET /api/admin/stats
 * Administrator-only platform overview. Figures are aggregated by MongoDB and
 * reflect real data — the previous version padded revenue with a hard-coded
 * $285 and substituted placeholder counts when a collection was empty.
 */
export const getAdminStats = asyncHandler(async (_req, res) => {
  const [
    totalUsers,
    totalPets,
    totalBookings,
    totalProducts,
    totalListings,
    bookingRevenue,
    orderRevenue,
    recentOrdersCount
  ] = await Promise.all([
    User.countDocuments(),
    Pet.countDocuments(),
    Booking.countDocuments(),
    Product.countDocuments(),
    PetListing.countDocuments(),
    Booking.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $group: { _id: null, sum: { $sum: '$total' } } }
    ]),
    Order.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $group: { _id: null, sum: { $sum: '$total' } } }
    ]),
    Order.countDocuments()
  ]);

  const bookingsTotal = bookingRevenue[0]?.sum || 0;
  const ordersTotal = orderRevenue[0]?.sum || 0;

  return res.json({
    success: true,
    data: {
      totalUsers,
      totalPets,
      totalBookings,
      totalProducts,
      totalListings,
      grossRevenue: Math.round((bookingsTotal + ordersTotal) * 100) / 100,
      bookingsRevenue: Math.round(bookingsTotal * 100) / 100,
      ordersRevenue: Math.round(ordersTotal * 100) / 100,
      recentBookingsCount: totalBookings,
      recentOrdersCount
    }
  });
});
