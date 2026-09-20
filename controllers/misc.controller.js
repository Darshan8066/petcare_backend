import { EmergencyClinic, CalendarEvent, Notification } from '../models/index.js';
import { asyncHandler } from '../middleware/errorHandler.js';

/** GET /api/emergency | /api/emergency-clinics */
export const getEmergencyClinics = asyncHandler(async (_req, res) => {
  const clinics = await EmergencyClinic.find().sort({ name: 1 });
  return res.json({ success: true, count: clinics.length, data: clinics });
});

/** GET /api/calendar */
export const getCalendarEvents = asyncHandler(async (req, res) => {
  // No more invented placeholder events when the list is empty — the UI now
  // shows a genuine empty state instead of reminders the user never created.
  const events = await CalendarEvent.find({ userId: req.user.userId }).sort({ date: 1, time: 1 });
  return res.json({ success: true, data: events });
});

/** POST /api/calendar */
export const createCalendarEvent = asyncHandler(async (req, res) => {
  const { title, type = 'custom', date, time, notes, petId } = req.body;

  if (!title?.trim() || !date) {
    return res.status(400).json({ success: false, message: 'Title and date are required.' });
  }

  const event = await CalendarEvent.create({
    userId: req.user.userId,
    petId: petId || null,
    title: title.trim(),
    type,
    date,
    time: time || '10:00 AM',
    completed: false,
    notes: notes || ''
  });

  return res.status(201).json({ success: true, data: event });
});

/** PATCH/PUT /api/calendar/:id */
export const updateCalendarEvent = asyncHandler(async (req, res) => {
  const allowed = ['title', 'type', 'date', 'time', 'completed', 'notes', 'petId'];
  const updates = {};
  for (const field of allowed) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ success: false, message: 'No updatable fields were provided.' });
  }

  // Scoped by userId so one account cannot edit another account's reminders.
  // The old version happily echoed back a fake success for unknown ids.
  const updated = await CalendarEvent.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.userId },
    updates,
    { new: true, runValidators: true }
  );

  if (!updated) {
    return res.status(404).json({ success: false, message: 'Reminder not found.' });
  }

  return res.json({ success: true, data: updated });
});

/** DELETE /api/calendar/:id */
export const deleteCalendarEvent = asyncHandler(async (req, res) => {
  const deleted = await CalendarEvent.findOneAndDelete({
    _id: req.params.id,
    userId: req.user.userId
  });

  if (!deleted) {
    return res.status(404).json({ success: false, message: 'Reminder not found.' });
  }

  return res.json({ success: true, message: 'Reminder deleted successfully.' });
});

/** GET /api/notifications */
export const getNotifications = asyncHandler(async (req, res) => {
  // Previously fell back to returning every notification in the database when
  // the user had none, leaking other customers' activity.
  const notifications = await Notification.find({ userId: req.user.userId })
    .sort({ createdAt: -1 })
    .limit(100);

  const unreadCount = await Notification.countDocuments({
    userId: req.user.userId,
    read: false
  });

  return res.json({ success: true, unreadCount, data: notifications });
});

/** PUT /api/notifications/read | POST /api/notifications/read-all */
export const markNotificationsRead = asyncHandler(async (req, res) => {
  // A single bulk update instead of one write per notification.
  const result = await Notification.updateMany(
    { userId: req.user.userId, read: false },
    { $set: { read: true } }
  );

  return res.json({
    success: true,
    message: 'All notifications marked as read.',
    data: { modified: result.modifiedCount }
  });
});
