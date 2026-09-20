import { Booking, CalendarEvent, Pet } from '../models/index.js';
import { asyncHandler } from '../middleware/errorHandler.js';

/** Normalises a slot string for comparison. */
export const normalizeSlot = (s) => (s ? String(s).toLowerCase().replace(/\s+/g, ' ').trim() : '');

/** Extracts the first "h:mm am/pm" token from a slot description. */
const extractTime = (str) => {
  const match = str.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);
  if (!match) return null;
  let hour = Number(match[1]) % 12;
  if (match[3].toLowerCase() === 'pm') hour += 12;
  return `${String(hour).padStart(2, '0')}:${match[2]}`;
};

/**
 * True when two slot descriptions refer to the same start time.
 * Handles "1:00 PM", "01:00 PM" and "01:00 PM - 02:00 PM" as one slot.
 */
export const isSlotConflict = (slotA, slotB) => {
  const a = normalizeSlot(slotA);
  const b = normalizeSlot(slotB);
  if (!a || !b) return false;
  if (a === b) return true;

  const timeA = extractTime(a);
  const timeB = extractTime(b);
  return Boolean(timeA && timeB && timeA === timeB);
};

/** Service types that produce a video consultation link. */
const VIDEO_TYPES = new Set(['pet_video', 'vet_video']);

/** Builds a unique meeting URL for video consultations. */
const buildMeetingUrl = () =>
  `https://meet.petcareplus.com/room-${Math.random().toString(36).substring(2, 10)}`;

/** Maps a booking type onto a calendar category. */
const calendarTypeFor = (bookingType) => {
  if (bookingType.includes('groom')) return 'grooming';
  if (bookingType.includes('video') || bookingType.includes('clinic')) return 'appointment';
  return 'appointment';
};

/** GET /api/bookings */
export const getBookings = asyncHandler(async (req, res) => {
  const filter = req.user.role === 'admin' ? {} : { userId: req.user.userId };
  const bookings = await Booking.find(filter).sort({ date: -1, createdAt: -1 });
  return res.json({ success: true, data: bookings });
});

/**
 * GET /api/bookings/booked-slots?date=YYYY-MM-DD&providerId=...
 * Public availability lookup — returns times only, never customer details.
 */
export const getBookedSlots = asyncHandler(async (req, res) => {
  const { date, providerId } = req.query;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.json({ success: true, date: date || null, bookedSlots: [], data: [], count: 0 });
  }

  const filter = { date, status: { $ne: 'cancelled' } };
  if (providerId && providerId !== 'any') {
    filter.providerId = { $in: [providerId, 'any'] };
  }

  const bookings = await Booking.find(filter).select('timeSlot');
  const bookedSlots = bookings.map((b) => b.timeSlot);

  return res.json({
    success: true,
    date,
    bookedSlots,
    data: bookedSlots,
    count: bookedSlots.length
  });
});

/** POST /api/bookings */
export const createBooking = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const {
    petId,
    petName = 'My Pet',
    type = 'pet_clinic',
    providerId = 'any',
    providerName = 'PetCare Specialist',
    providerClinicOrBusiness = 'PetCare+ Center',
    date,
    timeSlot,
    reason = 'Routine Checkup',
    serviceName = 'Pet Care Visit',
    fee = 50,
    notes = ''
  } = req.body;

  if (!date || !timeSlot) {
    return res.status(400).json({
      success: false,
      message: 'Appointment date and time slot are required.'
    });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ success: false, message: 'Date must be in YYYY-MM-DD format.' });
  }

  // 1. No bookings in the past.
  const todayStr = new Date().toISOString().split('T')[0];
  if (date < todayStr) {
    return res.status(400).json({
      success: false,
      message: "Cannot book appointments before today's date. Please select today or a future date."
    });
  }

  // 2. If a pet was supplied it must belong to the caller.
  let resolvedPetId = petId || null;
  let resolvedPetName = petName;
  if (petId) {
    const pet = await Pet.findById(petId);
    if (!pet || pet.ownerId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'The selected pet does not belong to your account.'
      });
    }
    resolvedPetId = pet._id.toString();
    resolvedPetName = pet.name;
  }

  const normalizedType = type === 'vet_video' ? 'pet_video' : type === 'vet_clinic' ? 'pet_clinic' : type;

  // 3. Reject double bookings of the same slot with the same provider.
  const sameDay = await Booking.find({
    date,
    status: { $ne: 'cancelled' },
    ...(providerId && providerId !== 'any' ? { providerId: { $in: [providerId, 'any'] } } : {})
  }).select('timeSlot providerId');

  const conflict = sameDay.find((b) => isSlotConflict(b.timeSlot, timeSlot));
  if (conflict) {
    return res.status(409).json({
      success: false,
      message: `The time slot "${timeSlot}" on ${date} is already booked. Please select another slot.`
    });
  }

  const calculatedFee = Number(fee) >= 0 ? Number(fee) : 45;
  const serviceFee = Math.round(calculatedFee * 0.08 * 100) / 100;
  const total = Math.round((calculatedFee + serviceFee) * 100) / 100;

  const isVideoBooking =
    VIDEO_TYPES.has(normalizedType) || String(serviceName).toLowerCase().includes('video');

  const booking = await Booking.create({
    userId,
    petId: resolvedPetId,
    petName: resolvedPetName,
    type: normalizedType,
    providerId,
    providerName,
    providerClinicOrBusiness,
    date,
    timeSlot,
    reason,
    serviceName,
    fee: calculatedFee,
    serviceFee,
    discount: 0,
    total,
    status: 'confirmed',
    paymentStatus: 'paid',
    notes,
    videoMeetingUrl: isVideoBooking ? buildMeetingUrl() : null
  });

  // Mirror the appointment onto the care calendar. A calendar failure must not
  // roll back a confirmed booking, so it is handled separately.
  try {
    await CalendarEvent.create({
      userId,
      petId: resolvedPetId,
      title: `${serviceName} (${resolvedPetName})`,
      type: calendarTypeFor(normalizedType),
      date,
      time: timeSlot,
      completed: false,
      notes: `Booked with ${providerName}`
    });
  } catch (err) {
    console.error('[Booking] Calendar event could not be created:', err.message);
  }

  return res.status(201).json({
    success: true,
    message: 'Booking confirmed successfully!',
    data: booking
  });
});

/** Loads a booking the caller is allowed to touch. */
const loadOwnedBooking = async (id, user) => {
  const booking = await Booking.findById(id);
  if (!booking) return { error: { status: 404, message: 'Booking not found.' } };
  if (user.role !== 'admin' && booking.userId !== user.userId) {
    return { error: { status: 403, message: 'You do not have access to this booking.' } };
  }
  return { booking };
};

/** PATCH/PUT /api/bookings/:id */
export const updateBooking = asyncHandler(async (req, res) => {
  const { error } = await loadOwnedBooking(req.params.id, req.user);
  if (error) return res.status(error.status).json({ success: false, message: error.message });

  // Customers may only change a small set of fields; admins may change status
  // and payment state as well.
  const customerFields = ['notes', 'reason', 'status'];
  const adminFields = [...customerFields, 'paymentStatus', 'date', 'timeSlot', 'providerName'];
  const allowed = req.user.role === 'admin' ? adminFields : customerFields;

  const updates = {};
  for (const field of allowed) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }

  // A customer may only cancel; they cannot mark their own booking completed.
  if (req.user.role !== 'admin' && updates.status && updates.status !== 'cancelled') {
    delete updates.status;
  }

  if (updates.status === 'cancelled') {
    updates.paymentStatus = 'refunded';
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ success: false, message: 'No updatable fields were provided.' });
  }

  const updated = await Booking.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true
  });

  return res.json({ success: true, message: 'Booking updated successfully.', data: updated });
});

/** PUT /api/bookings/:id/cancel */
export const cancelBooking = asyncHandler(async (req, res) => {
  const { booking, error } = await loadOwnedBooking(req.params.id, req.user);
  if (error) return res.status(error.status).json({ success: false, message: error.message });

  if (booking.status === 'cancelled') {
    return res.status(400).json({ success: false, message: 'This booking is already cancelled.' });
  }

  const updated = await Booking.findByIdAndUpdate(
    req.params.id,
    { status: 'cancelled', paymentStatus: 'refunded' },
    { new: true }
  );

  return res.json({
    success: true,
    message: 'Appointment cancelled and refunded.',
    data: updated
  });
});
