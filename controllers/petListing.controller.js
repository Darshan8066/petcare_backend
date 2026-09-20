import { PetListing, Notification } from '../models/index.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** GET /api/pet-listings */
export const getAllListings = asyncHandler(async (req, res) => {
  const { species, adoption, search } = req.query;

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 60));

  const filter = {};

  if (species && species !== 'All') {
    filter.species = new RegExp(`^${escapeRegex(species)}$`, 'i');
  }

  if (adoption === 'true') {
    filter.$or = [{ isForAdoption: true }, { price: 0 }];
  }

  if (search && String(search).trim()) {
    const term = new RegExp(escapeRegex(String(search).trim()), 'i');
    const searchClause = [
      { title: term },
      { breed: term },
      { location: term },
      { description: term }
    ];
    filter.$and = filter.$or ? [{ $or: filter.$or }, { $or: searchClause }] : [{ $or: searchClause }];
    delete filter.$or;
  }

  const [listings, total] = await Promise.all([
    PetListing.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    PetListing.countDocuments(filter)
  ]);

  return res.json({
    success: true,
    count: listings.length,
    total,
    page,
    totalPages: Math.ceil(total / limit) || 1,
    data: listings
  });
});

/** POST /api/pet-listings */
export const createListing = asyncHandler(async (req, res) => {
  const {
    title,
    species = 'Dog',
    breed,
    age = 'Young',
    gender = 'Male',
    price = 0,
    isForAdoption = false,
    location = '',
    description,
    photos = [],
    vaccinated = true,
    dewormed = true,
    healthCertificate = true,
    sellerName,
    sellerPhone,
    sellerEmail
  } = req.body;

  if (!title?.trim() || !breed?.trim() || !description?.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Title, breed, and description are required.'
    });
  }

  if (!location?.trim()) {
    return res.status(400).json({ success: false, message: 'Location is required.' });
  }

  const contactName = sellerName?.trim() || req.user.email.split('@')[0];
  const contactEmail = sellerEmail?.trim() || req.user.email;

  if (!sellerPhone?.trim()) {
    return res.status(400).json({ success: false, message: 'A contact phone number is required.' });
  }

  const defaultPhotos =
    Array.isArray(photos) && photos.length > 0
      ? photos
      : [
          species === 'Cat'
            ? 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=600&auto=format&fit=crop&q=80'
            : 'https://images.unsplash.com/photo-1552053831-71594a27632d?w=600&auto=format&fit=crop&q=80'
        ];

  const listing = await PetListing.create({
    title: title.trim(),
    species,
    breed: breed.trim(),
    age,
    gender,
    price: isForAdoption ? 0 : Math.max(0, Number(price) || 0),
    isForAdoption: Boolean(isForAdoption),
    location: location.trim(),
    description: description.trim(),
    photos: defaultPhotos,
    vaccinated: Boolean(vaccinated),
    dewormed: Boolean(dewormed),
    healthCertificate: Boolean(healthCertificate),
    // The seller is always the authenticated account.
    sellerId: req.user.userId,
    sellerName: contactName,
    sellerPhone: sellerPhone.trim(),
    sellerEmail: contactEmail,
    status: 'available'
  });

  return res.status(201).json({
    success: true,
    message: 'Pet listing created successfully!',
    data: listing
  });
});

/** GET /api/pet-listings/:id */
export const getListingById = asyncHandler(async (req, res) => {
  const listing = await PetListing.findById(req.params.id);
  if (!listing) {
    return res.status(404).json({ success: false, message: 'Pet listing not found.' });
  }
  return res.json({ success: true, data: listing });
});

/** Confirms the caller owns the listing (admins bypass). */
const loadOwnedListing = async (id, user) => {
  const listing = await PetListing.findById(id);
  if (!listing) return { error: { status: 404, message: 'Pet listing not found.' } };
  if (user.role !== 'admin' && listing.sellerId !== user.userId) {
    return { error: { status: 403, message: 'You can only manage your own listings.' } };
  }
  return { listing };
};

/**
 * PUT/PATCH /api/pet-listings/:id
 * These routes previously had no authentication at all, so anyone could edit
 * or delete any seller's listing.
 */
export const updateListing = asyncHandler(async (req, res) => {
  const { error } = await loadOwnedListing(req.params.id, req.user);
  if (error) return res.status(error.status).json({ success: false, message: error.message });

  const { sellerId, _id, createdAt, updatedAt, ...updates } = req.body;

  const updated = await PetListing.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true
  });

  return res.json({ success: true, data: updated });
});

/** DELETE /api/pet-listings/:id */
export const deleteListing = asyncHandler(async (req, res) => {
  const { error } = await loadOwnedListing(req.params.id, req.user);
  if (error) return res.status(error.status).json({ success: false, message: error.message });

  await PetListing.findByIdAndDelete(req.params.id);
  return res.json({ success: true, message: 'Listing deleted successfully.' });
});

/** POST /api/pet-listings/:id/inquire */
export const inquireOrReserveListing = asyncHandler(async (req, res) => {
  const listing = await PetListing.findById(req.params.id);
  if (!listing) {
    return res.status(404).json({ success: false, message: 'Pet listing not found.' });
  }

  const { buyerPhone, action = 'inquire' } = req.body;

  if (listing.sellerId === req.user.userId) {
    return res.status(400).json({
      success: false,
      message: 'You cannot place an enquiry on your own listing.'
    });
  }

  if (action === 'reserve') {
    if (listing.status !== 'available') {
      return res.status(409).json({
        success: false,
        message: 'This pet is no longer available.'
      });
    }
    listing.status = 'reserved';
    await listing.save();
  }

  const isReserve = action === 'reserve';

  // Notify the buyer (confirmation) and the seller (new enquiry).
  await Notification.create([
    {
      userId: req.user.userId,
      title: isReserve ? `Pet Reserved: ${listing.title}` : `Inquiry Sent: ${listing.title}`,
      message: isReserve
        ? `You placed a hold on ${listing.title}. ${listing.sellerName} will reach out via ${buyerPhone || 'your contact details'}.`
        : `Your inquiry for ${listing.title} was forwarded to ${listing.sellerName}.`,
      type: 'booking',
      relatedId: listing._id.toString()
    },
    {
      userId: listing.sellerId,
      title: isReserve ? `Your listing was reserved` : `New enquiry on your listing`,
      message: `${listing.title}: ${isReserve ? 'a buyer placed a hold.' : 'a buyer sent you a message.'}`,
      type: 'booking',
      relatedId: listing._id.toString()
    }
  ]);

  return res.json({
    success: true,
    message: isReserve
      ? 'Pet reservation hold requested successfully! The caregiver has been notified.'
      : 'Your message has been sent directly to the caregiver.'
  });
});
