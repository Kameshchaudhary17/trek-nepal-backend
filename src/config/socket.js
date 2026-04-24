import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { TokenBlacklist } from '../models/TokenBlacklist.model.js';

let io = null;

/* Attaches Socket.io to the already-running HTTP server.
   Handshake authenticates via the same JWT used for REST calls. */
export function initSocket(httpServer) {
  const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5174,http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  io = new Server(httpServer, {
    cors: {
      origin(origin, cb) {
        if (!origin) return cb(null, true);
        if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
        cb(new Error(`Origin ${origin} not allowed`));
      },
      credentials: true,
    },
  });

  // JWT auth on handshake. Token passed in auth payload, same as REST.
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('unauthorized'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      if (await TokenBlacklist.exists({ tokenHash })) {
        return next(new Error('token revoked'));
      }

      socket.userId = decoded.id.toString();
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    // Every user auto-joins their personal room for notifications.
    socket.join(`user:${socket.userId}`);

    // Opt-in per-booking rooms for chat. Client joins when the chat modal opens.
    socket.on('booking:join', (bookingId) => {
      if (typeof bookingId === 'string' && bookingId.length < 64) {
        socket.join(`booking:${bookingId}`);
      }
    });

    socket.on('booking:leave', (bookingId) => {
      if (typeof bookingId === 'string') {
        socket.leave(`booking:${bookingId}`);
      }
    });
  });

  return io;
}

/* Safe emit helpers — no-op if socket.io wasn't initialised yet. */
export function emitToUser(userId, event, data) {
  if (!io || !userId) return;
  io.to(`user:${userId.toString()}`).emit(event, data);
}

export function emitToBooking(bookingId, event, data) {
  if (!io || !bookingId) return;
  io.to(`booking:${bookingId.toString()}`).emit(event, data);
}

export function getIo() {
  return io;
}
