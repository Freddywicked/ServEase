/**
 * Notification controller: per-user notifications shown on the customer
 * home screen (status updates, messages, etc.).
 * @format
 */

import { getSupabase } from '../config/supabase.js';

const publicNotification = notification => ({
  id: notification.id,
  message: notification.message,
  readAt: notification.read_at,
  createdAt: notification.created_at,
});

/**
 * GET /api/notifications
 * Responds with { notifications } - newest first, capped at 50.
 */
export const listNotifications = async (req, res, next) => {
  try {
    const supabase = getSupabase();
    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', req.user.sub)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) {
      return res
        .status(500)
        .json({ message: 'Failed to load notifications.' });
    }
    return res.json({
      notifications: notifications.map(publicNotification),
    });
  } catch (error) {
    return next(error);
  }
};

/** PATCH /api/notifications/:id/read */
export const markNotificationRead = async (req, res, next) => {
  try {
    const supabase = getSupabase();
    const { data: notification, error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('user_id', req.user.sub)
      .select()
      .maybeSingle();
    if (error || !notification) {
      return res.status(404).json({ message: 'Notification not found.' });
    }
    return res.json({ notification: publicNotification(notification) });
  } catch (error) {
    return next(error);
  }
};
