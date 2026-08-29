/**
 * Service request (booking) controller: the customer's repair jobs.
 * Powers the customer home screen's "Active Repair" section.
 * @format
 */

import { getSupabase } from '../config/supabase.js';

// Statuses that still count as an "active" repair on the customer home.
const ACTIVE_STATUSES = ['pending', 'accepted', 'in_progress'];

const publicBooking = booking => ({
  id: booking.id,
  status: booking.status,
  description: booking.description,
  serviceName: booking.service?.name || null,
  providerName: booking.provider?.full_name || null,
  scheduledAt: booking.scheduled_at,
  createdAt: booking.created_at,
  updatedAt: booking.updated_at,
});

/**
 * GET /api/bookings/active
 * Responds with { booking } - the customer's most recent non-final service
 * request, or null when there is no active repair.
 */
export const getActiveBooking = async (req, res, next) => {
  try {
    const supabase = getSupabase();
    const { data: booking, error } = await supabase
      .from('service_requests')
      .select(
        '*, service:service_id (name), provider:provider_id (full_name)',
      )
      .eq('customer_id', req.user.sub)
      .in('status', ACTIVE_STATUSES)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      return res
        .status(500)
        .json({ message: 'Failed to load the active repair.' });
    }
    return res.json({ booking: booking ? publicBooking(booking) : null });
  } catch (error) {
    return next(error);
  }
};
