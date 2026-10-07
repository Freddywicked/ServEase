import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import bellIcon from '../assets/icon_ringbell.png';
import { openChat } from './MessagingWidget';
// import { api } from '../api/client'; // BACKEND: use whichever request helper ../api/client exports

/* =====================================================================================
   NOTIFICATIONS — bell button + "Notifications" popup (customer and provider headers)
   -------------------------------------------------------------------------------------
   Used by CustomerSidebar (viewer="customer") and ServiceProviderSidebar (viewer="provider").
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
     quotation_received             customer   /customer/requests?tab=approved
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
    quotation_received: () => '/customer/requests?tab=approved',
    schedule_proposed: () => '/customer/requests?tab=approved',
    request_accepted: () => '/customer/requests?tab=ongoing',
    provider_on_the_way: () => '/customer/requests?tab=ongoing',
    additional_payment_requested: () => '/customer/requests?tab=ongoing',
    request_completed: () => '/customer/requests?tab=done',
    request_declined: () => '/customer/requests?tab=declined',
    payment_confirmed: () => '/customer/history?tab=transactions',
    rate_provider: (n) => (n.requestId ? `/customer/requests/${n.requestId}/review` : '/customer/history'),
  },
  provider: {
    new_request: (n) => (n.requestId ? `/serviceprovider/requests/${n.requestId}` : '/serviceprovider/requests'),
    quotation_approved: () => '/serviceprovider/requests',
    quotation_declined: () => '/serviceprovider/requests',
    schedule_accepted: () => '/serviceprovider/jobs',
    schedule_rejected: () => '/serviceprovider/jobs',
    payment_received: () => '/serviceprovider/earnings',
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
  new_message: (n) => {
    if (!n.senderId) return false;
    openChat({ id: n.senderId, name: n.senderName });
    return true;
  },
};

const getRoute = (notification, viewer) =>
  notification.link ||
  ROUTES_BY_VIEWER[viewer]?.[notification.type]?.(notification) ||
  SHARED_ROUTES[notification.type]?.(notification) ||
  null;

/* ------------------------------ HARD-CODED DATA ------------------------------ */

const minutesAgo = (m) => new Date(Date.now() - m * 60000).toISOString();

const MOCK_NOTIFICATIONS = {
  customer: [
    {
      id: 'n-1',
      type: 'quotation_received',
      message: 'Alden Ricks sent a quotation.',
      requestId: 'SR-0001',
      read: false,
      createdAt: minutesAgo(120),
    },
    {
      id: 'n-2',
      type: 'request_completed',
      message: 'Your request #SR-0000 has been completed.',
      requestId: 'SR-0000',
      read: false,
      createdAt: minutesAgo(125),
    },
    {
      id: 'n-3',
      type: 'new_message',
      message: 'Jose Rodolfo sent you a message.',
      senderId: 'prov-jose-rodolfo',
      senderName: 'Jose Rodolfo',
      read: false,
      createdAt: minutesAgo(180),
    },
    {
      id: 'n-4',
      type: 'payment_confirmed',
      message: 'Your payment of ₱170.00 was received.',
      requestId: 'SR-0007',
      read: true,
      createdAt: minutesAgo(1500),
    },
  ],
  provider: [
    {
      id: 'n-1',
      type: 'new_request',
      message: 'Nick Duran sent a new service request.',
      requestId: 'SR-0000',
      read: false,
      createdAt: minutesAgo(120),
    },
    {
      id: 'n-2',
      type: 'new_message',
      message: 'Nick Duran sent you a message.',
      senderId: 'cust-nick-duran',
      senderName: 'Nick Duran',
      read: false,
      createdAt: minutesAgo(125),
    },
    {
      id: 'n-3',
      type: 'payment_received',
      message: 'You received a payment of ₱680.00.',
      requestId: 'SR-0007',
      read: true,
      createdAt: minutesAgo(1500),
    },
    {
      id: 'n-4',
      type: 'new_review',
      message: 'A customer rated you 5 stars.',
      requestId: 'SR-0007',
      read: true,
      createdAt: minutesAgo(1600),
    },
  ],
};

/* ------------------------------ DATA LAYER (swap for the backend) ------------------------------ */

const notificationsService = {
  async list(viewer) {
    // TODO (BACKEND): const { data } = await api.get(`/${viewer}/notifications`); return data;
    return MOCK_NOTIFICATIONS[viewer] ?? [];
  },

  async markRead(id) {
    // TODO (BACKEND): await api.post(`/notifications/${id}/read`);
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

export default function Notifications({ viewer = 'customer' }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const containerRef = useRef(null);

  const loadNotifications = () =>
    notificationsService
      .list(viewer)
      .then(setNotifications)
      .catch((err) => console.error('Failed to load notifications', err));

  // Load once, and again every time the popup is opened.
  useEffect(() => {
    loadNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer]);

  useEffect(() => {
    if (!open) return undefined;
    loadNotifications();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleOpenNotification = (notification) => {
    setOpen(false);
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

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        aria-haspopup="true"
        aria-expanded={open}
        className="flex cursor-pointer items-center justify-center border-none bg-transparent p-0"
      >
        <img src={bellIcon} alt="" className="h-[27px] w-[27px]" />
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