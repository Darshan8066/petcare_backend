import mongoose from 'mongoose';

const isProd = () => process.env.NODE_ENV === 'production';

/**
 * Wraps an async route handler so rejected promises reach the error handler
 * instead of hanging the request. Replaces the repeated try/catch blocks that
 * previously leaked raw error messages to clients.
 */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/** 404 for any unmatched /api route. */
export const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint ${req.method} ${req.originalUrl} not found`
  });
};

/** Central error handler — translates known error shapes into clean responses. */
export const errorHandler = (err, _req, res, _next) => {
  // Mongoose schema validation
  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({
      success: false,
      message: details[0] || 'Validation failed.',
      errors: details
    });
  }

  // Malformed ObjectId in a route parameter
  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({
      success: false,
      message: `Invalid identifier supplied for "${err.path}".`
    });
  }

  // Unique index violation (duplicate email, duplicate coupon code, ...)
  if (err?.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return res.status(409).json({
      success: false,
      message: `That ${field} is already in use.`
    });
  }

  // Malformed JSON body
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ success: false, message: 'Request body is not valid JSON.' });
  }

  const status = err.status || err.statusCode || 500;

  if (status >= 500) {
    console.error('[Unhandled Error]', err);
  }

  res.status(status).json({
    success: false,
    // Internal error details are never echoed back to clients in production.
    message:
      status >= 500 && isProd()
        ? 'Something went wrong on our end. Please try again.'
        : err.message || 'Internal Server Error'
  });
};
