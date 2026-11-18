import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import bellIcon from '../assets/icon_ringbell.png';
import { openChat } from './MessagingWidget';
import { getNotifications, markNotificationRead } from '../api/client';

/* =====================================================================================
   NOTIFICATIONS — bell button + unread badge + "Notifications" popup (customer, provider, admin headers)
   -------------------------------------------------------------------------------------
   Used by CustomerSidebar (viewer="customer"), ServiceProviderSidebar (viewer="provider") and
   AdminSidebar (viewer="admin").
   The red number on the bell is the count of UNREAD notifications for that viewer only (99+ above 99).
   Each viewer asks the backend for its own role's notifications (GET /api/notifications?audience=...), so a
   customer notification never counts on the provider or admin bell. It refreshes every 30 s, when the
   tab regains focus, and when the popup opens. Clicking the bell marks everything in the popup as read,
   so the number disappears; clicking a single notification also opens its destination.
   The bell is hidden by the sidebars while the user is on their own dashboard; the dashboard
   shows the same notifications inside its "Notifications" box through `useNotifications`
   (exported below), so loading and click-routing stay in this one file.
   Notifications are about EVERYTHING in the app (requests, quotations, messages, payments,
   reviews, provider applications, ...). Clicking one closes the popup, marks it read and
   opens the screen where that item lives. Track Requests is only one of those places.

   HOW THE DESTINATION IS CHOSEN (first match wins)
     1. notification.link       -> if the backend sends a path, it is used as is
     2. ACTIONS[type]           -> things that are not a page (e.g. a new message opens the chat popup)
     3. ROUTES_BY_VIEWER[viewer][type] -> the table below, per customer / provider
     4. SHARED_ROUTES[type]     -> types that look the same for everyone
     5. none of them            -> the popup just closes and the notification is marked read
   When the backend creates a new notification type, add ONE line to the table below.

   DESTINATIONS (edit freely)
     type                           viewer     opens
     -----------------------------  ---------  ------------------------------------------------
     quotation_received             customer   /customer/requests?tab=sent
     schedule_proposed              customer   /customer/requests?tab=approved
     request_accepted               customer   /customer/requests?tab=ongoing
     provider_on_the_way            customer   /customer/requests?tab=ongoing
     additional_payment_requested   customer   /customer/requests?tab=ongoing
     request_completed              customer   /customer/requests?tab=done   (final payment lives there)
     request_declined               customer   /customer/requests?tab=declined
     payment_confirmed              customer   /customer/history?tab=transactions
     rate_provider                  customer   /customer/requests/:requestId/review
     new_request                    provider   /serviceprovider/requests/:requestId
     quotation_approved / _declined provider   /serviceprovider/requests
     schedule_accepted / _rejected  provider   /serviceprovider/jobs
     payment_received               provider   /serviceprovider/earnings
     new_review                     provider   /serviceprovider/dashboard (rating is shown there)
     new_message                    both       opens the chat popup with the sender (needs senderId, senderName)
     application_approved           both       /serviceprovider/dashboard
     application_rejected           both       /serviceprovider/service-category (reapply)

   BACKEND INTEGRATION (READY)
   Everything goes through `notificationsService` below (hard-coded now). Proposed endpoints
   (rename to match ServEaseBackend; these match the TODOs that were in the sidebars):

     GET  /api/customer/notifications   |   GET /api/provider/notifications
          -> [{ id, type, message, requestId?, senderId?, senderName?, link?, read, createdAt }]
             newest first. `message` is the sentence shown in the popup, `createdAt` an ISO date
             used for "2h ago".
     POST /api/notifications/:id/read

   The backend creates a notification whenever something happens (provider sends a quotation,
   request completed, payment received, someone messages you, admin rejects an application, ...).
   The popup reloads every time it opens; you can also poll / use sockets and call
   setNotifications(...).
   ===================================================================================== */

const ROUTES_BY_VIEWER = {
  customer: {
    quotation_received: () => '/customer/requests?tab=sent',
    schedule_proposal: () => '/customer/requests?tab=approved',
    schedule_proposed: () => '/customer/requests?tab=approved',
    request_accepted: () => '/customer/requests?tab=ongoing',
    provider_on_the_way: () => '/customer/requests?tab=ongoing',
    progress_update: () => '/customer/requests?tab=ongoing',
    payment_request: () => '/customer/requests?tab=ongoing',
    additional_payment_requested: () => '/customer/requests?tab=ongoing',
    job_completed: () => '/customer/requests?tab=done',
    request_completed: () => '/customer/requests?tab=done',
    request_declined: () => '/customer/requests?tab=declined',
    payment_confirmed: () => '/customer/history?tab=transactions',
    rate_provider: (n) => (n.requestId ? `/customer/requests/${n.requestId}/review` : '/customer/history'),
  },
  admin: {
    provider_application: () => '/admin/users',
    provider_application_submitted: () => '/admin/users',
    new_provider_application: () => '/admin/users',
    new_user: () => '/admin/users',
  },
  provider: {
    new_request: (n) => (n.requestId ? `/serviceprovider/requests/${n.requestId}` : '/serviceprovider/requests'),
    quotation_accepted: () => '/serviceprovider/requests',
    quotation_approved: () => '/serviceprovider/requests',
    quotation_declined: () => '/serviceprovider/requests',
    schedule_accepted: () => '/serviceprovider/jobs',
    schedule_rejected: () => '/serviceprovider/jobs',
    payment_approved: () => '/serviceprovider/jobs',
    payment_rejected: () => '/serviceprovider/jobs',
    payment_received: () => '/serviceprovider/earnings',
    rating_received: () => '/serviceprovider/dashboard',
    new_review: () => '/serviceprovider/dashboard',
  },
};

// Same destination for everyone.
const SHARED_ROUTES = {
  application_approved: () => '/serviceprovider/dashboard',
  application_rejected: () => '/serviceprovider/service-category',
};

// Destinations that are not a page: return true when the notification was handled.
const ACTIONS = {
  // The conversation id IS the request reference (see MessagingWidget.jsx).
  new_message: (n) => {
    if (!n.requestId) return false;
    openChat({ id: n.requestId, requestId: n.requestId });
    return true;
  },
};

const getRoute = (notification, viewer) =>
  notification.link ||
  ROUTES_BY_VIEWER[viewer]?.[notification.type]?.(notification) ||
  SHARED_ROUTES[notification.type]?.(notification) ||
  null;

/* ------------------------------ DATA LAYER (swap for the backend) ------------------------------ */

// Live data: GET /api/notifications?audience=<viewer> returns the logged-in user's notifications that are
// addressed to that role (newest first). `readAt` (ISO or null) becomes the local `read` flag.
// Safety net: if the backend tags a notification with a role (`role` / `recipientRole`) that is not this
// viewer's, it is dropped here too, so it can never light up the wrong bell.
const notificationsService = {
  async list(viewer) {
    const data = await getNotifications(viewer);
    return (data?.notifications ?? [])
      .filter((n) => {
        const role = n.role ?? n.recipientRole;
        return !role || role === viewer;
      })
      .map((n) => ({ ...n, read: Boolean(n.readAt) }));
  },

  async markRead(id) {
    await markNotificationRead(id);
    return id;
  },
};

// "2h ago"
const timeAgo = (iso) => {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

/* ------------------------------ component ------------------------------ */

// Shared by the bell popup and the dashboard "Notifications" box.
// Returns the list, a reload function, and openNotification(n) which marks the item read
// and opens its destination (a page, or the chat popup).
export function useNotifications(viewer = 'customer') {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);

  const reload = useCallback(
    () =>
      notificationsService
        .list(viewer)
        .then(setNotifications)
        .catch((err) => console.error('Failed to load notifications', err)),
    [viewer]
  );

  useEffect(() => {
    reload();
  }, [reload]);

  // Poll so new notifications (e.g. a customer just sent a request) show up on
  // the bell without waiting for the user to open the popup. Paused while the
  // tab is hidden to save requests; refetches the moment the tab regains focus.
  useEffect(() => {
    const POLL_MS = 30000;
    const tick = () => {
      if (document.visibilityState === 'visible') reload();
    };
    const interval = setInterval(tick, POLL_MS);
    window.addEventListener('focus', reload);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', reload);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [reload]);

  const openNotification = (notification) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
    );
    notificationsService
      .markRead(notification.id)
      .catch((err) => console.error('Failed to mark notification as read', err));

    // 1) things that are not a page (e.g. open the chat popup)
    if (!notification.link && ACTIONS[notification.type]?.(notification)) return;

    // 2) a page
    const route = getRoute(notification, viewer);
    if (route) navigate(route);
    else console.warn(`No destination for notification type "${notification.type}" (see Notifications.jsx)`);
  };

  // Marks a list of notifications read: the badge drops right away, then the backend is told.
  const markRead = useCallback((items) => {
    const ids = new Set(items.map((n) => n.id));
    setNotifications((prev) => prev.map((n) => (ids.has(n.id) ? { ...n, read: true } : n)));
    items.forEach((n) =>
      notificationsService
        .markRead(n.id)
        .catch((err) => console.error('Failed to mark notification as read', err))
    );
  }, []);

  // Number shown on the bell: unread notifications of this viewer only.
  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, unreadCount, reload, openNotification, markRead };
}

export { timeAgo };

export default function Notifications({ viewer = 'customer' }) {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, reload, openNotification, markRead } = useNotifications(viewer);
  const badgeLabel = unreadCount > 99 ? '99+' : String(unreadCount);
  const containerRef = useRef(null);

  // Reload every time the popup is opened; close on outside click / Escape.
  useEffect(() => {
    if (!open) return undefined;
    reload();
    const onMouseDown = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, reload]);

  // Opening the bell means the customer has seen what is in the popup: everything that is unread
  // (including anything that arrives while it stays open) is marked read, so the red number goes away.
  useEffect(() => {
    if (!open) return;
    const unread = notifications.filter((n) => !n.read);
    if (unread.length > 0) markRead(unread);
  }, [open, notifications, markRead]);

  const handleOpenNotification = (notification) => {
    setOpen(false);
    openNotification(notification);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={unreadCount > 0 ? `Notifications, ${badgeLabel} unread` : 'Notifications'}
        aria-haspopup="true"
        aria-expanded={open}
        className="relative flex cursor-pointer items-center justify-center border-none bg-transparent p-0"
      >
        <img src={bellIcon} alt="" className="h-[27px] w-[27px]" />
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-[7px] -top-[6px] box-border flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-[#D92D20] px-[3px] font-[Inter] text-[10px] font-bold leading-none text-white"
          >
            {badgeLabel}
          </span>
        )}
      </button>

      {open && (
        <section
          aria-label="Notifications"
          className="absolute right-[-30px] top-[calc(100%+24px)] z-50 box-border max-h-[420px] w-[370px] max-w-[calc(100vw-24px)] overflow-y-auto rounded-b-[15px] border border-t-0 border-black/20 bg-white pb-5 pl-[28px] pr-[34px] pt-[22px] shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
        >
          <h2 className="m-0 border-b border-[#7C7979] pb-[6px] font-[Roboto] text-[20px] font-bold uppercase leading-[23px] text-[#4B5EA8]">
            Notifications
          </h2>

          {notifications.length === 0 ? (
            <p className="m-0 py-6 text-center font-[Roboto] text-[14px] font-medium text-[#817C7C]">
              No Notifications
            </p>
          ) : (
            <ul className="m-0 list-none p-0">
              {notifications.map((n) => (
                <li key={n.id} className="border-b border-[#7C7979]">
                  <button
                    type="button"
                    onClick={() => handleOpenNotification(n)}
                    className="block w-full cursor-pointer border-none bg-transparent px-0 py-[10px] text-left hover:bg-[#F6FAFF]"
                  >
                    <span className="block font-[Roboto] text-[13px] font-bold leading-[16px] text-[#484040]">
                      {n.message}
                    </span>
                    <span className="block font-[Roboto] text-[10px] leading-[14px] text-[#484040]">
                      {timeAgo(n.createdAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}