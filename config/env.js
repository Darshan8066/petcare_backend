/**
 * Validates configuration at boot so the server fails immediately with a clear
 * message instead of misbehaving later. Missing JWT secrets used to fall back
 * to hard-coded strings that were committed to the repository, which meant
 * anyone could forge a valid token for any account.
 */

const REQUIRED = ['MONGO_URI', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
const MIN_SECRET_LENGTH = 32;

export const validateEnv = () => {
  const missing = REQUIRED.filter((key) => !process.env[key]?.trim());

  if (missing.length > 0) {
    console.error(`[Config] Missing required environment variable(s): ${missing.join(', ')}`);
    console.error('[Config] Copy .env.example to .env and fill in the values before starting.');
    process.exit(1);
  }

  const weak = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'].filter(
    (key) => process.env[key].trim().length < MIN_SECRET_LENGTH
  );

  if (weak.length > 0) {
    const message = `[Config] ${weak.join(' and ')} should be at least ${MIN_SECRET_LENGTH} characters. Generate one with: openssl rand -hex 32`;
    if (process.env.NODE_ENV === 'production') {
      console.error(message);
      process.exit(1);
    }
    console.warn(message);
  }

  if (process.env.JWT_ACCESS_SECRET === process.env.JWT_REFRESH_SECRET) {
    console.error('[Config] JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different values.');
    process.exit(1);
  }

  if (process.env.NODE_ENV === 'production' && !process.env.CORS_ORIGINS?.trim()) {
    console.warn(
      '[Config] CORS_ORIGINS is not set. Set it to your frontend URL, e.g. CORS_ORIGINS=https://your-app.vercel.app'
    );
  }
};

/** Parsed list of origins allowed to call the API with credentials. */
export const allowedOrigins = () =>
  (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);

export default validateEnv;
