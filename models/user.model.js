import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 12;

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [80, 'Name cannot exceed 80 characters'],
      // Runs on every set — new User(), .create(), and findByIdAndUpdate()
      // alike — so the name is stored capitalized no matter which code path
      // writes it. "alex" -> "Alex", "john doe" -> "John Doe".
      set: (value) => {
        if (!value || typeof value !== 'string') return value;
        return value
          .trim()
          .split(/\s+/)
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
      }
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address']
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      // Never returned by a normal query — use .select('+password') when needed.
      select: false
    },
    role: {
      type: String,
      enum: ['user', 'vet', 'groomer', 'pet_sitter', 'admin'],
      default: 'user'
    },
    phone: { type: String, default: '' },
    // No default stock photo — the UI shows the user's initial in a colored
    // circle when this is empty (see Navbar.jsx), so a real photo is only
    // ever shown once the user actually uploads one.
    avatar: { type: String, default: '' },
    address: {
      street: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      zipCode: { type: String, default: '' },
      country: { type: String, default: '' }
    },
    emergencyContact: {
      name: { type: String, default: '' },
      phone: { type: String, default: '' },
      relationship: { type: String, default: '' }
    },
    subscriptionPlan: {
      type: String,
      enum: ['free', 'premium'],
      default: 'free'
    },
    subscriptionValidUntil: { type: String, default: null },
    emailVerified: { type: Boolean, default: true },
    // Incremented on logout / password change so previously issued refresh
    // tokens can be invalidated.
    tokenVersion: { type: Number, default: 0 }
  },
  { timestamps: true }
);

// Hash the password whenever it is set or changed. Centralising this here means
// no controller can ever accidentally persist a plaintext password.
userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  try {
    this.password = await bcrypt.hash(this.password, BCRYPT_ROUNDS);
    next();
  } catch (err) {
    next(err);
  }
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  if (!candidate || !this.password) return Promise.resolve(false);
  return bcrypt.compare(candidate, this.password);
};

// Strip sensitive fields from every JSON response.
userSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret.password;
    delete ret.tokenVersion;
    delete ret.__v;
    delete ret.id;
    return ret;
  }
});

export const User = mongoose.models.User || mongoose.model('User', userSchema);
export default User;
