import crypto from 'crypto';
import express from 'express';
import cors from 'cors';
import path from 'path';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import swaggerUi from 'swagger-ui-express';
import { openapiSpec } from './config/swagger.js';
import authRoutes from './routes/auth.routes.js';
import guideRoutes from './routes/guides.routes.js';
import userRoutes from './routes/users.routes.js';
import conditionsRoutes from './routes/conditions.routes.js';
import treksRoutes from './routes/treks.routes.js';
import pricingRoutes from './routes/pricing.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import bookingRoutes from './routes/bookings.routes.js';
import reviewRoutes from './routes/reviews.routes.js';
import paymentRoutes from './routes/payments.routes.js';
import messageRoutes from './routes/messages.routes.js';
import aiRoutes from './routes/ai.routes.js';
import notificationRoutes from './routes/notifications.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5174,http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true); // server-to-server / curl / mobile apps
      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  })
);

// Request-ID + access logging. Assign before anything else so error logs carry it.
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('x-request-id', req.id);
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    // Skip health spam in logs
    if (req.path === '/health') return;
    console.log(`[${req.id}] ${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`);
  });
  next();
});

// Stripe webhook must see the raw body for signature verification.
// Mount the payments router BEFORE express.json() so /webhook keeps its raw buffer.
// Other payment routes inside this router still work because they don't consume
// the body until their own handler runs (and createPaymentIntent has no body).
app.use('/api/payments', paymentRoutes);

app.use(express.json());

// Health check — fails with 503 if Mongo isn't connected so load balancers stop
// routing to a broken replica. readyState: 1=connected, 2=connecting, 0=disconnected.
app.get('/health', (_req, res) => {
  const dbUp = mongoose.connection.readyState === 1;
  res.status(dbUp ? 200 : 503).json({
    ok: dbUp,
    db: dbUp ? 'connected' : 'down',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// OpenAPI docs — only exposed outside production to avoid leaking schema +
// endpoint surface to attackers. Flip ENABLE_API_DOCS=true to override.
const docsEnabled =
  process.env.NODE_ENV !== 'production' || process.env.ENABLE_API_DOCS === 'true';
if (docsEnabled) {
  app.get('/api/openapi.json', (_req, res) => res.json(openapiSpec));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec, {
    customSiteTitle: 'Trek Nepal API',
  }));
}

// Serve uploaded files (profile photos, trek photos)
app.use('/uploads', express.static(path.resolve(__dirname, '../public/uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/guides', guideRoutes);
app.use('/api/users', userRoutes);
app.use('/api/conditions', conditionsRoutes);
app.use('/api/treks', treksRoutes);
app.use('/api/pricing', pricingRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/bookings', bookingRoutes);
// Reviews attach to both /bookings/:id/review and /guides/:id/reviews — mount at /api
app.use('/api', reviewRoutes);
// Messages attach to /bookings/:id/messages + /messages/unread — mount at /api
app.use('/api', messageRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/notifications', notificationRoutes);

// Global error handler — hide internals in production.
app.use((err, req, res, _next) => {
  const isOperational = Number.isInteger(err.statusCode);
  const status = isOperational ? err.statusCode : 500;
  const isProd = process.env.NODE_ENV === 'production';

  // Unexpected 500s: log server-side with request id, never leak internals to client.
  if (!isOperational) {
    console.error(`[${req.id || '-'}] [unhandled]`, err);
  }

  const message = isOperational
    ? err.message
    : isProd ? 'Internal server error' : (err.message || 'Internal server error');

  const body = { message };
  if (!isProd && !isOperational && err.stack) body.stack = err.stack;

  res.status(status).json(body);
});

export default app;
