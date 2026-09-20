import mongoose from 'mongoose';

/**
 * MongoDB connection handler.
 *
 * The connection is REQUIRED. If it fails the process exits instead of
 * silently falling back to an in-memory store (the previous behaviour, which
 * is what caused accounts to disappear between restarts in production).
 */

let connectionPromise = null;

const buildOptions = () => ({
  serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS) || 15000,
  socketTimeoutMS: Number(process.env.MONGO_SOCKET_TIMEOUT_MS) || 45000,
  maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE) || 10,
  minPoolSize: Number(process.env.MONGO_MIN_POOL_SIZE) || 0,
  retryWrites: true,
  autoIndex: process.env.NODE_ENV !== 'production'
});

const attachListeners = () => {
  const conn = mongoose.connection;

  conn.on('connected', () => {
    console.log(`[MongoDB] Connected to database "${conn.name}"`);
  });

  conn.on('error', (err) => {
    console.error('[MongoDB] Connection error:', err.message);
  });

  conn.on('disconnected', () => {
    console.warn('[MongoDB] Disconnected. The driver will attempt to reconnect.');
  });
};

export const connectDB = async () => {
  if (connectionPromise) return connectionPromise;

  const mongoUri = (process.env.MONGO_URI || process.env.MONGODB_URI || '').trim();

  if (!mongoUri) {
    console.error(
      '[MongoDB] MONGO_URI is not set. Add your MongoDB Atlas connection string to the environment before starting the server.'
    );
    process.exit(1);
  }

  // Fail fast on malformed URIs instead of surfacing a confusing driver error.
  if (!/^mongodb(\+srv)?:\/\//.test(mongoUri)) {
    console.error('[MongoDB] MONGO_URI must start with "mongodb://" or "mongodb+srv://".');
    process.exit(1);
  }

  mongoose.set('strictQuery', true);
  attachListeners();

  connectionPromise = mongoose
    .connect(mongoUri, buildOptions())
    .then((m) => m.connection)
    .catch((err) => {
      connectionPromise = null;
      console.error('[MongoDB] Unable to establish a connection:', err.message);
      console.error(
        '[MongoDB] Check that the connection string is correct and that this server\'s IP is allowed in Atlas > Network Access.'
      );
      process.exit(1);
    });

  return connectionPromise;
};

export const disconnectDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close(false);
    connectionPromise = null;
    console.log('[MongoDB] Connection closed.');
  }
};

export const isDBConnected = () => mongoose.connection.readyState === 1;

export default connectDB;
