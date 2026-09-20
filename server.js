import 'dotenv/config';

import path from 'node:path';
import { pathToFileURL } from 'node:url';

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import { validateEnv, allowedOrigins } from './config/env.js';
import { connectDB, disconnectDB, isDBConnected } from './config/db.js';
import { seedDatabase } from './config/seed.js';
import appRoutes from './appRoutes.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimit.js';

// Environment is checked before anything else so misconfiguration fails fast.
validateEnv();

const isProd = process.env.NODE_ENV === 'production';

/**
 * CORS: in development any localhost origin is accepted. In production only
 * the origins listed in CORS_ORIGINS may send credentialed requests. The old
 * configuration used `origin: true`, which reflects whatever Origin header
 * arrives and, combined with credentials, lets any website call the API with
 * the visitor's cookies.
 */
const corsOptions = {
  origin(origin, callback) {
    // Same-origin requests, curl and server-to-server calls send no Origin.
    if (!origin) return callback(null, true);

    const normalised = origin.replace(/\/$/, '');
    const allowList = allowedOrigins();

    if (!isProd && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalised)) {
      return callback(null, true);
    }

    if (allowList.includes(normalised)) return callback(null, true);

    return callback(new Error(`Origin ${origin} is not permitted by CORS policy.`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400
};

export const createApp = async () => {
  await connectDB();
  await seedDatabase();

  // Printed on every boot (not just in production) so a typo'd or missing
  // origin shows up here instead of only surfacing as a CORS rejection on
  // the first real request from the browser.
  const origins = allowedOrigins();
  console.log(
    origins.length > 0
      ? `[CORS] Allowed origin(s): ${origins.join(', ')}`
      : '[CORS] No CORS_ORIGINS configured — only same-origin requests and (in development) localhost will be accepted.'
  );

  const app = express();

  // Required so req.ip and secure cookies work behind Render/Vercel/Heroku.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // Baseline security headers (no extra dependency needed).
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    if (isProd) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });

  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));

  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Request logging: quiet in production, detailed in development.
  if (!isProd) {
    app.use((req, _res, next) => {
      if (req.path.startsWith('/api')) {
        console.log(`[API ${req.method}] ${req.path}`);
      }
      next();
    });
  }

  // Health check — also reports database connectivity so a platform health
  // probe fails when Mongo is unreachable.
  app.get('/api/health', (_req, res) => {
    const dbUp = isDBConnected();
    res.status(dbUp ? 200 : 503).json({
      status: dbUp ? 'ok' : 'degraded',
      service: 'PetCare Backend API',
      database: dbUp ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
      version: '2.1.0'
    });
  });

  app.use('/api', apiLimiter, appRoutes);

  // 404 for unmatched API routes, then the central error handler.
  app.use('/api/*', notFound);
  app.use(errorHandler);

  return app;
};

const PORT = Number(process.env.PORT) || 5000;

const start = async () => {
  try {
    const app = await createApp();

    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log('=========================================');
      console.log('🐾 PetCare Backend API');
      console.log(`🚀 Listening on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('=========================================');
    });

    // Graceful shutdown: stop accepting connections, then close the DB pool so
    // in-flight requests finish and the platform does not report a hard crash.
    const shutdown = (signal) => async () => {
      console.log(`\n[Server] ${signal} received — shutting down gracefully.`);
      server.close(async () => {
        await disconnectDB();
        process.exit(0);
      });
      // Force exit if connections do not drain in time.
      setTimeout(() => process.exit(1), 10000).unref();
    };

    process.on('SIGTERM', shutdown('SIGTERM'));
    process.on('SIGINT', shutdown('SIGINT'));

    process.on('unhandledRejection', (reason) => {
      console.error('[Server] Unhandled promise rejection:', reason);
    });

    process.on('uncaughtException', (err) => {
      console.error('[Server] Uncaught exception:', err);
      process.exit(1);
    });
  } catch (err) {
    console.error('[Server] Failed to start:', err);
    process.exit(1);
  }
};

// Only listen when this file is the entry point. Importing it (for tests or
// for a serverless wrapper) must not start a second server.
// pathToFileURL handles platform differences correctly (Windows needs
// "file:///D:/..." with forward slashes and an extra slash after the drive
// letter — a plain string concatenation like `file://${path}` only works on
// POSIX systems and silently fails to match on Windows).
const isEntryPoint =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isEntryPoint || process.env.RUN_STANDALONE_BACKEND === 'true') {
  start();
}

export default createApp;
