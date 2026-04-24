import { Message } from '../models/Message.model.js';
import { Booking } from '../models/Booking.model.js';
import { Guide } from '../models/Guide.model.js';
import { ApiError } from '../utils/apiError.js';
import { emitToBooking } from '../config/socket.js';
import { createNotification } from './notifications.controller.js';

/* Given a booking and the current user, return the other party's userId.
   Throws 403 if the current user isn't a participant. */
async function resolveCounterparty(booking, currentUserId) {
  if (booking.trekker.equals(currentUserId)) {
    const guide = await Guide.findById(booking.guide).select('user').lean();
    if (!guide) throw new ApiError(404, 'Guide profile missing');
    return guide.user;
  }
  const guide = await Guide.findOne({ user: currentUserId }).select('_id').lean();
  if (guide && booking.guide.equals(guide._id)) {
    return booking.trekker;
  }
  throw new ApiError(403, 'Not authorized to message on this booking');
}

/* GET /api/bookings/:bookingId/messages?after=<ISO>
   Returns messages in chronological order. If `after` is supplied, only
   newer messages are returned — used by the frontend poll. Does NOT mark
   messages as read; the client calls POST .../messages/read once the
   messages are actually rendered, so we don't silently drop unreads when
   a fetch fails mid-flight. */
export async function listMessages(req, res, next) {
  try {
    const { bookingId } = req.params;
    const booking = await Booking.findById(bookingId);
    if (!booking) throw new ApiError(404, 'Booking not found');

    await resolveCounterparty(booking, req.user._id); // auth check

    const q = { booking: booking._id };
    if (req.query.after) {
      const since = new Date(req.query.after);
      if (!Number.isNaN(since.getTime())) q.createdAt = { $gt: since };
    }

    const messages = await Message.find(q)
      .populate('from', 'fullName profilePhoto')
      .sort({ createdAt: 1 })
      .lean();

    res.json({ messages });
  } catch (err) {
    next(err);
  }
}

/* POST /api/bookings/:bookingId/messages/read
   Called once the client has rendered the messages. Marks every unread
   message addressed to the caller as read. */
export async function markMessagesRead(req, res, next) {
  try {
    const { bookingId } = req.params;
    const booking = await Booking.findById(bookingId);
    if (!booking) throw new ApiError(404, 'Booking not found');

    await resolveCounterparty(booking, req.user._id); // auth check

    const { modifiedCount } = await Message.updateMany(
      { booking: booking._id, to: req.user._id, readAt: null },
      { $set: { readAt: new Date() } }
    );
    res.json({ marked: modifiedCount });
  } catch (err) {
    next(err);
  }
}

/* POST /api/bookings/:bookingId/messages { text } */
export async function sendMessage(req, res, next) {
  try {
    const { bookingId } = req.params;
    const { text } = req.body;

    if (typeof text !== 'string' || !text.trim()) {
      throw new ApiError(400, 'text is required');
    }
    if (text.length > 4000) {
      throw new ApiError(400, 'text must be 4000 chars or fewer');
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) throw new ApiError(404, 'Booking not found');

    // Limit chat to active bookings — no spam after cancellation / rejection.
    if (!['pending', 'confirmed', 'completed'].includes(booking.status)) {
      throw new ApiError(400, `Messaging is closed for ${booking.status} bookings`);
    }

    const toUserId = await resolveCounterparty(booking, req.user._id);

    const message = await Message.create({
      booking: booking._id,
      from:    req.user._id,
      to:      toUserId,
      text:    text.trim(),
    });

    const populated = await Message.findById(message._id)
      .populate('from', 'fullName profilePhoto')
      .lean();

    // Real-time: push to anyone with this booking's chat open (both parties,
    // including other devices of the sender for cross-device sync).
    emitToBooking(booking._id, 'message:new', populated);

    // Durable notification for the recipient's bell — also delivers when the
    // recipient doesn't have the chat open.
    const preview = populated.text.slice(0, 120);
    createNotification({
      userId: toUserId,
      type:   'message.new',
      title:  `New message from ${populated.from?.fullName || 'your chat partner'}`,
      body:   preview,
      link:   `/bookings`,
    }).catch((e) => console.error('[notif] message failed:', e.message));

    res.status(201).json({ message: populated });
  } catch (err) {
    next(err);
  }
}

/* GET /api/messages/unread — badge count across all the user's bookings. */
export async function unreadCount(req, res, next) {
  try {
    const count = await Message.countDocuments({ to: req.user._id, readAt: null });
    res.json({ count });
  } catch (err) {
    next(err);
  }
}
