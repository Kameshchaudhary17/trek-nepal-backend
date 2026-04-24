import { Notification } from '../models/Notification.model.js';
import { emitToUser } from '../config/socket.js';

/* Helper — callable from any controller. Writes the notification and
   fires a socket event so the recipient's UI can react immediately. */
export async function createNotification({ userId, type, title, body = '', link = '' }) {
  if (!userId) return null;
  const notif = await Notification.create({ user: userId, type, title, body, link });
  emitToUser(userId, 'notification:new', notif.toObject());
  return notif;
}

/* GET /api/notifications?limit=20&unread=true */
export async function listNotifications(req, res, next) {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const unreadOnly = req.query.unread === 'true';

    const filter = { user: req.user._id };
    if (unreadOnly) filter.readAt = null;

    const [notifications, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).limit(limit).lean(),
      Notification.countDocuments({ user: req.user._id, readAt: null }),
    ]);

    res.json({ notifications, unreadCount });
  } catch (err) {
    next(err);
  }
}

/* POST /api/notifications/:id/read */
export async function markNotificationRead(req, res, next) {
  try {
    const { id } = req.params;
    await Notification.updateOne(
      { _id: id, user: req.user._id, readAt: null },
      { $set: { readAt: new Date() } }
    );
    res.json({ message: 'marked' });
  } catch (err) {
    next(err);
  }
}

/* POST /api/notifications/read-all */
export async function markAllNotificationsRead(req, res, next) {
  try {
    const { modifiedCount } = await Notification.updateMany(
      { user: req.user._id, readAt: null },
      { $set: { readAt: new Date() } }
    );
    res.json({ marked: modifiedCount });
  } catch (err) {
    next(err);
  }
}
