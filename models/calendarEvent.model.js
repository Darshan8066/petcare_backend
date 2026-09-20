import mongoose from 'mongoose';

// Calendar Event Schema definition using new mongoose.Schema
const calendarEventSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    petId: { type: String, default: null },
    title: { type: String, required: true },
    // Values sent by the Calendar UI (medication/appointment/vaccination/...)
    // plus the legacy ones used by auto-generated booking events.
    type: {
      type: String,
      enum: [
        'medication',
        'appointment',
        'vaccination',
        'grooming',
        'custom',
        'pet',
        'vet',
        'vaccine',
        'medicine',
        'sitting',
        'walking'
      ],
      default: 'custom'
    },
    date: { type: String, required: true },
    time: { type: String, default: '10:00 AM' },
    completed: { type: Boolean, default: false },
    notes: { type: String, default: '' }
  },
  { timestamps: true }
);

export const CalendarEvent = mongoose.models.CalendarEvent || mongoose.model('CalendarEvent', calendarEventSchema);
export default CalendarEvent;
