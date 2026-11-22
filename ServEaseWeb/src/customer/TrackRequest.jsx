import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import CustomerSidebar from '../components/CustomerSidebar';
import { openChat } from '../components/MessagingWidget';
import {
  answerPaymentRequest,
  answerScheduleProposal,
  getPaymentDue,
  getTrackingCards,
  negotiatePaymentRequest,
} from '../api/client';

/* =====================================================================================
   MY REQUESTS / TRACK REQUESTS (customer) — live data
   -------------------------------------------------------------------------------------
   One call (GET /api/service-requests/tracking) returns the cards grouped by tab:
   { sent, approved, ongoing, declined, done }. mapCard() below turns each backend
   card (cardType: diagnosis | quotation | schedule | payment | timeline | completed |
   declined) into the shape the card components render.

   Figma layout (Track / SR - SENT / SR - APPROVED):
     - Search bar + two dropdowns: "Categories" and "Status". The two filters are independent:
       a card is listed only when it passes the Status, the Category AND the search box.
     - Status: All | Pending | Active | Completed | Closed
         Pending   -> backend group "sent" (requests still waiting for the provider)
         Active    -> sub-tab "Quotations": every quotation waiting for the customer's answer
                      (they arrive in backend group "sent", mapCard()/regroup moves them here)
                      plus the provider's answer-needed cards (backend group "approved");
                      sub-tab "On-going": backend group "ongoing"
         Completed -> backend group "done" (final payment settled)
         Closed    -> backend group "declined"
     - Categories: All | IT-Related Devices | Phone Devices | Automotive | Home.
       Filtering uses the category the backend sends on each card
       (card.serviceCategory / card.category / card.categoryName) — see pickCategory().

   Actions:
     schedule proposal     -> POST /api/service-requests/:id/schedule-proposals/:pid/accept|reject
     additional payment    -> POST /api/service-requests/:id/payment-requests/:pid/approve|reject
     negotiate             -> Negotiate modal -> POST .../payment-requests/:pid/negotiate
                              (counter-offer is posted to the chat + the provider is notified;
                              the payment request stays pending)
     quotation review      -> MyRequestDetails.jsx (/customer/requests/:requestId)
     final payment         -> Payment.jsx (/customer/requests/:requestId/payment)
     view repair details   -> ViewRepairDetails.jsx (/customer/requests/:requestId/repair-details):
                              every update the service provider pushes from Active Jobs (stage,
                              notes, images / videos). The cards refresh every 15 seconds.
   ===================================================================================== */

// How often the cards refresh by themselves, so provider updates (status, notes, photos)
// show up without a page reload.
const POLL_INTERVAL_MS = 15000;

// Backend groups (keys of the getTrackingCards() response).
const GROUP_ORDER = ['sent', 'approved', 'ongoing', 'done', 'declined'];

// Status dropdown (Figma): which backend groups each status shows.
const STATUS_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
  { key: 'closed', label: 'Closed' },
];
const STATUS_GROUPS = {
  all: GROUP_ORDER,
  pending: ['sent'],
  active: ['approved', 'ongoing'],
  completed: ['done'],
  closed: ['declined'],
};

// Sub-tabs shown under the "Active" status (Figma SR - APPROVED).
const ACTIVE_SUBTABS = [
  { key: 'approved', label: 'Quotations' },
  { key: 'ongoing', label: 'On-going' },
];

// Notifications deep-link here with ?tab=sent|approved|ongoing|declined|done.
const TAB_TO_VIEW = {
  sent: { status: 'pending' },
  approved: { status: 'active', sub: 'approved' },
  ongoing: { status: 'active', sub: 'ongoing' },
  done: { status: 'completed' },
  declined: { status: 'closed' },
};

// Categories dropdown (Figma).
const CATEGORY_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'it', label: 'IT-Related Devices' },
  { key: 'phone', label: 'Phone Devices' },
  { key: 'automotive', label: 'Automotive' },
  { key: 'home', label: 'Home' },
];

// The category text the backend sends -> one of the dropdown keys above.
const categoryKeyOf = (text) => {
  const t = String(text || '').toLowerCase();
  if (!t) return '';
  if (/phone|mobile|smartphone/.test(t)) return 'phone';
  if (/auto|vehicle|\bcar\b|motor/.test(t)) return 'automotive';
  if (/home|plumb|carpent|electric|appliance|handyman/.test(t)) return 'home';
  if (/\bit\b|it-related|computer|laptop|device/.test(t)) return 'it';
  return '';
};

const pickCategory = (card) =>
  card.serviceCategory ?? card.category ?? card.categoryName ?? card.category_name ?? '';

const PLACEHOLDER_TIME = 'MM/DD/YY 00:00 AM';

// ISO timestamp -> "06/27/26 10:00 AM" (falls back to the placeholder when empty).
const formatDateTime = (iso) => {
  if (!iso) return PLACEHOLDER_TIME;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return PLACEHOLDER_TIME;
  const date = d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${date} ${time}`;
};

// Step time shown under a tracking step (Figma: "Jun 24 9:12 AM").
const formatStepTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${date} ${time}`;
};

// The backend timeline is a list of { label, timestamp, description, subtext?, done } and already
// matches the request's service location type, so the labels are shown as sent:
//   Shop-based: Assessing / Repairing / Quality Checking / Completed
//   Home-based: Preparing / Service Provider is on the way / Arrived at the Customer's location / Completed
// Indicator flow (see Figma):
//  - a step stays grey ('pending') until the service provider updates it, then it is blue
//    with a check ('done');
//  - the last step, "Completed", is a darker grey ('completed') until the customer has paid
//    the remaining balance. While unpaid, Home-based shows the time the provider finished and
//    Shop-based reads "Payment Pending"; after payment it turns blue like the other steps.
const mapTimeline = (steps, isPaid, locationType) =>
  steps.map((s, i) => {
    const isLast = i === steps.length - 1;
    const stamp = s.timestamp ? formatStepTime(s.timestamp) : '';
    if (isLast) {
      if (s.done && isPaid) return { label: s.label, time: stamp, state: 'done' };
      return {
        label: s.label,
        time: s.done ? (locationType === 'home' ? stamp : 'Payment Pending') : '',
        state: 'completed',
      };
    }
    return {
      label: s.label,
      time: s.done ? s.subtext || stamp : '',
      state: s.done ? 'done' : 'pending',
    };
  });

// Turns one backend tracking card (see getTrackingCards in api/client.js) into the
// shape the card components below render. `tab` is the group the card came from.
const mapCard = (tab) => (card) => {
  const base = {
    cardId: card.id, // unique per card (a request can have several cards)
    id: card.requestNumber || card.requestId,
    status: tab,
    providerId: card.providerId,
    providerName: card.providerName,
    category: pickCategory(card),
    locationType: card.serviceLocationType === 'home' ? 'home' : 'shop',
  };
  switch (card.cardType) {
    case 'quotation':
      return {
        ...base,
        // Every quotation belongs in Active > Quotations (not Pending), even though the
        // backend files it under "sent" while the request is still open.
        status: 'approved',
        kind: 'quotation',
        badge: card.statusLabel || 'Approve Quote?',
        quotation: {
          reason: card.notes || '',
          items: [
            // Labor, Parts (0.00 when the provider set no price) and the platform Service Fee.
            { label: 'Labor Cost', amount: card.laborCost },
            { label: 'Parts Cost', amount: card.partsCost ?? 0 },
            { label: 'Service Fee', amount: card.serviceFee ?? 0 },
          ],
          total: card.total,
        },
      };
    case 'schedule':
      return {
        ...base,
        kind: 'schedule',
        badge: card.statusLabel || 'New Schedule',
        schedule: {
          proposalId: card.proposalId,
          dateTime: formatDateTime(card.scheduledAt),
          reason: card.reason || '',
        },
      };
    case 'payment':
      return {
        ...base,
        kind: 'additional_payment',
        badge: card.statusLabel || 'In progress',
        additionalPayment: {
          paymentRequestId: card.paymentRequestId,
          amount: card.paymentAmount,
          note: card.paymentReason || '',
        },
      };
    case 'timeline':
      return {
        ...base,
        kind: 'progress',
        badge: card.statusLabel || 'In progress',
        finalPayment: card.total,
        isPaid: false,
        awaitingPayment: false,
        timeline: mapTimeline(card.timeline || [], false, base.locationType),
      };
    case 'completed': {
      // Provider marked the job completed. It is only finished (Completed status) once the
      // customer paid the remaining balance; until then it stays Active > On-going with
      // "Proceed to Payment".
      const isPaid = Boolean(card.isPaid ?? card.paid ?? card.paymentStatus === 'paid');
      return {
        ...base,
        status: isPaid ? 'done' : 'ongoing',
        kind: 'progress',
        badge: isPaid ? 'Completed' : 'In progress',
        finalPayment: card.finalAmount,
        isPaid,
        // A paid job never offers "Proceed to Payment" again.
        awaitingPayment: !isPaid,
        timeline: mapTimeline(card.timeline || [], isPaid, base.locationType),
      };
    }
    case 'declined':
      return {
        ...base,
        kind: 'summary',
        badge: card.statusLabel || 'Declined',
        declinedReason: card.reason || null,
        // Who closed it and how: the customer declined the quotation / cancelled, or the provider did.
        closedBy: card.closedBy || 'provider',
        closedAction: card.closedAction || 'declined',
      };
    case 'diagnosis':
    default:
      return {
        ...base,
        kind: 'summary',
        badge: card.statusLabel || 'Pending',
        probableCause: card.probableCause || null,
        confidence: card.confidencePercent ?? null,
      };
  }
};

const formatAmount = (n) =>
  Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Everything on a card that the search box looks at.
const searchText = (r) =>
  [
    r.id,
    r.providerName,
    r.category,
    r.badge,
    r.probableCause,
    r.declinedReason,
    r.quotation?.reason,
    r.schedule?.reason,
    r.schedule?.dateTime,
    r.additionalPayment?.note,
    ...(r.timeline || []).map((s) => s.label),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

/* ------------------------------------ small UI parts ------------------------------------ */

// Status pill at the top-right of a card (Figma: Pending #DAC855, Approve Quote? #BB8157,
// In progress #577FBB).
const PILL_COLORS = {
  pending: '#DAC855',
  quotation: '#BB8157',
  progress: '#577FBB',
  completed: '#167713',
  declined: '#C62828',
};

const pillColorOf = (request) => {
  if (request.kind === 'quotation' || request.kind === 'schedule') return PILL_COLORS.quotation;
  if (request.kind === 'additional_payment') return PILL_COLORS.progress;
  if (request.kind === 'progress') {
    return request.status === 'done' ? PILL_COLORS.completed : PILL_COLORS.progress;
  }
  return request.status === 'declined' ? PILL_COLORS.declined : PILL_COLORS.pending;
};

function Pill({ children, color }) {
  return (
    <span
      className="-mr-[6px] inline-flex h-[24px] min-w-[85px] flex-none items-center justify-center whitespace-nowrap rounded-[20px] border border-[#B1A8A8] px-4 font-[Quicksand] text-[14px] font-medium leading-[24px] text-white"
      style={{ backgroundColor: color }}
    >
      {children}
    </span>
  );
}

// Outlined white button (Message, Proceed to Payment, Find Service Provider).
function OutlineButton({ children, onClick, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`box-border h-[31px] min-w-[90px] cursor-pointer rounded-[10px] border border-[#B1A8A8] bg-[#FFFDFD] px-5 font-[Inter] text-[12px] font-bold leading-[20px] text-[#414141] hover:bg-[#F3F3F3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0255AF] ${className}`}
    >
      {children}
    </button>
  );
}

// Gradient "View" button (Figma Rectangle 3521: 110x30, #04A5A5 -> #0255AF, white bold 12px).
function GradientButton({ children, onClick, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ background: 'linear-gradient(270deg, #04A5A5 0%, #0255AF 100%)' }}
      className={`box-border h-[30px] w-[110px] cursor-pointer rounded-[10px] border border-[#B1A8A8] p-0 font-[Inter] text-[12px] font-bold leading-[20px] text-white hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0255AF] ${className}`}
    >
      {children}
    </button>
  );
}

// Filled 100x30 action buttons (Figma: Approve #167713, Negotiate #DEBF6A, Decline #C62828).
const ACTION_COLORS = {
  approve: 'bg-[#167713] hover:bg-[#126010]',
  negotiate: 'bg-[#DEBF6A] hover:bg-[#CFAF55]',
  decline: 'bg-[#C62828] hover:bg-[#A82020]',
};

function ActionButton({ children, onClick, tone }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`box-border h-[30px] w-[100px] cursor-pointer rounded-[10px] border border-[#B1A8A8] font-[Inter] text-[12px] font-bold leading-[20px] text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0255AF] ${ACTION_COLORS[tone]}`}
    >
      {children}
    </button>
  );
}

function CardShell({ children, onClick, label, padding = 'px-[22px] pb-4 pt-[12px]' }) {
  const clickable = typeof onClick === 'function';
  return (
    <article
      onClick={onClick}
      onKeyDown={clickable ? (e) => (e.key === 'Enter' || e.key === ' ') && onClick() : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={clickable ? label : undefined}
      className={`box-border w-full rounded-[10px] border border-[#818080] bg-white ${padding} ${
        clickable ? 'cursor-pointer hover:bg-[#FAFCFF]' : ''
      }`}
    >
      {children}
    </article>
  );
}

function CardTitle({ id, large = false }) {
  return (
    <h3
      className={`m-0 font-[Inter] font-bold text-[#292727] ${
        large ? 'text-[16px] leading-[27px]' : 'text-[15px] leading-[26px]'
      }`}
    >
      Request #{id}
    </h3>
  );
}

function Divider({ className = '' }) {
  return <div className={`border-t border-black/40 ${className}`} />;
}

// Figma: updated by the provider = #577FBB + check; every other step = #414141. The last step
// ("completed" state) stays dark until the customer has paid the balance.
function StepDot({ state }) {
  const base = 'flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full';
  if (state === 'done') {
    return (
      <span className={`${base} bg-[#577FBB]`}>
        <Check size={13} strokeWidth={3} color="#FFEFEF" />
      </span>
    );
  }
  return <span className={`${base} bg-[#414141]`} />;
}

function Timeline({ steps }) {
  return (
    <ol className="m-0 mt-3 list-none p-0">
      {steps.map((step) => (
        <li key={step.label} className="mb-[17px] flex items-start gap-3">
          <StepDot state={step.state} />
          <div>
            <p
              className={`m-0 font-[Inter] text-[12px] font-bold leading-[20px] ${
                step.state === 'pending' ? 'text-[#191818]' : step.state === 'completed' ? 'text-[#7C7A79]' : 'text-[#191818]'
              }`}
            >
              {step.label}
            </p>
            {step.time ? (
              <p className="m-0 font-[Inter] text-[11px] leading-[19px] text-[#5B5959]">{step.time}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ------------------------------------ filter controls ------------------------------------ */

// Figma "Categories" / "Status" dropdown: 173x49, 14px radius, list drops down from the
// control. `value` null = nothing picked yet, so the placeholder label shows.
function FilterDropdown({ placeholder, options, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close when clicking outside or pressing Escape.
  useEffect(() => {
    if (!open) return undefined;
    const onMouseDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
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
  }, [open]);

  const selected = options.find((o) => o.key === value);

  return (
    <div ref={ref} className={`relative h-[49px] w-[173px] flex-none ${open ? 'z-30' : ''}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={placeholder}
        onClick={() => setOpen((o) => !o)}
        className="relative z-10 box-border flex h-full w-full cursor-pointer items-center justify-between rounded-[14px] border border-[#7E7A7A] bg-white px-5 text-left font-[Inter] text-[14px] font-semibold leading-[24px] tracking-[-0.3125px] text-[#484040]"
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <ChevronDown
          size={16}
          strokeWidth={2.5}
          color="#000"
          className={`ml-2 flex-none transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={placeholder}
          className="absolute left-0 top-[36px] z-0 m-0 box-border flex w-full list-none flex-col gap-[7px] rounded-b-[14px] rounded-t-[1px] border border-[#B4A9A9] bg-white px-5 pb-[10px] pt-[26px]"
        >
          {options.map((option) => (
            <li key={option.key} role="option" aria-selected={option.key === value}>
              <button
                type="button"
                onClick={() => {
                  onChange(option.key);
                  setOpen(false);
                }}
                className={`block h-[24px] w-full cursor-pointer truncate border-none bg-transparent p-0 text-left font-[Inter] text-[14px] leading-[24px] tracking-[-0.3125px] text-[#484040] hover:text-[#005FCA] ${
                  option.key === value ? 'font-semibold' : 'font-medium'
                }`}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------ request cards ------------------------------------ */

// "Pending" (sent) and "Closed" (declined) — AI probable cause + confidence
function SummaryCard({ request, onFindProvider }) {
  const declined = request.status === 'declined';
  return (
    <CardShell padding="px-[22px] pb-[19px] pt-[12px]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <CardTitle id={request.id} large />
          <p className="m-0 font-[Inter] text-[14px] leading-[17px] text-[#484040]">
            sent to <strong>{request.providerName}</strong>
          </p>
        </div>
        <div className="mt-[5px]">
          <Pill color={pillColorOf(request)}>{request.badge}</Pill>
        </div>
      </div>

      <Divider className="mt-2" />

      {declined ? (
        <>
          <p className="m-0 mt-[13px] font-[Inter] text-[13px] leading-[16px] text-[#484040]">
            {request.closedBy === 'customer'
              ? request.closedAction === 'cancelled'
                ? 'Cancelled by you'
                : 'You declined the quotation'
              : request.closedAction === 'cancelled'
                ? 'Cancelled by the service provider'
                : 'Declined by the service provider'}
          </p>
          {(request.declinedReason || request.closedBy !== 'customer') && (
            <p className="m-0 mt-2 font-[Inter] text-[20px] font-bold leading-[24px] text-[#484040]">
              {request.declinedReason || 'No reason given.'}
            </p>
          )}
          <div className="mt-3 flex justify-end">
            <OutlineButton onClick={onFindProvider}>Find Service Provider</OutlineButton>
          </div>
        </>
      ) : (
        <>
          <p className="m-0 mt-[13px] font-[Inter] text-[13px] leading-[16px] text-[#484040]">
            Probable Cause
          </p>
          <p className="m-0 mt-2 font-[Inter] text-[20px] font-bold leading-[24px] text-[#484040]">
            {request.probableCause || 'Waiting for the provider to review the request'}
          </p>
          {request.probableCause && request.confidence != null && (
            <p className="m-0 mt-[6px] font-[Inter] text-[13px] font-bold leading-[16px] text-[#5F5A5A]">
              {request.confidence}% AI Confidence based on similar reported cases
            </p>
          )}
        </>
      )}
    </CardShell>
  );
}

// "Active > Quotations" — provider sent a quotation (click to review it)
function QuotationCard({ request, onOpen }) {
  const { quotation } = request;
  return (
    <CardShell
      onClick={onOpen}
      label={`Review quotation for request ${request.id}`}
      padding="px-5 pb-4 pt-[10px]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <CardTitle id={request.id} />
          <p className="m-0 font-[Inter] text-[14px] leading-[24px] text-[#5B5959]">
            {request.providerName} sent a quotation
          </p>
        </div>
        <Pill color={pillColorOf(request)}>{request.badge}</Pill>
      </div>

      <div className="mt-[2px]">
        {quotation.items.map((item) => (
          <div
            key={item.label}
            className="flex justify-between font-[Inter] text-[12px] leading-[20px]"
          >
            <span className="font-bold text-[#191818]">{item.label}</span>
            <span className="text-[#5B5959]">{formatAmount(item.amount)}</span>
          </div>
        ))}
        <Divider className="my-1" />
        <div className="flex justify-between font-[Inter] text-[12px] font-bold leading-[20px]">
          <span className="text-[#191818]">Total</span>
          <span className="text-[#5B5959]">{formatAmount(quotation.total)}</span>
        </div>
      </div>
    </CardShell>
  );
}

// "Active > Quotations" — provider proposed a new schedule
function ScheduleCard({ request, onAccept, onReject }) {
  const { schedule } = request;
  return (
    <CardShell padding="px-5 pb-4 pt-[10px]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <CardTitle id={request.id} />
          <p className="m-0 font-[Inter] text-[14px] leading-[24px] text-[#5B5959]">
            {request.providerName} sent a new schedule
          </p>
        </div>
        <Pill color={pillColorOf(request)}>{request.badge}</Pill>
      </div>
      <p className="m-0 mt-3 text-center font-[Inter] text-[14px] font-bold leading-[24px] text-[#292727]">
        {schedule.dateTime}
      </p>
      <p className="m-0 mt-2 font-[Inter] text-[12px] font-bold leading-[20px] text-[#191818]">
        Reason for New Schedule
      </p>
      <p className="m-0 font-[Inter] text-[12px] leading-[20px] text-[#5B5959]">
        {schedule.reason}
      </p>
      <div className="mt-3 flex justify-end gap-[9px]">
        <ActionButton tone="approve" onClick={onAccept}>Accept</ActionButton>
        <ActionButton tone="decline" onClick={onReject}>Reject</ActionButton>
      </div>
    </CardShell>
  );
}

// "Active > On-going" — provider asks for an additional payment
function AdditionalPaymentCard({ request, onApprove, onNegotiate, onDecline, onMessage }) {
  const { additionalPayment } = request;
  return (
    <CardShell padding="px-[22px] pb-3 pt-[10px]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <CardTitle id={request.id} />
          <p className="m-0 font-[Inter] text-[14px] leading-[22px] text-[#5B5959]">
            {request.providerName}
          </p>
        </div>
        <Pill color={pillColorOf(request)}>{request.badge}</Pill>
      </div>

      <div className="mt-[6px] box-border flex items-center justify-between gap-4 rounded-[10px] border border-[#B1A8A8] bg-[#FFFED3] px-3 py-2">
        <div className="min-w-0">
          <p className="m-0 font-[Inter] text-[12px] font-bold leading-[20px] text-[#BB8157]">
            Additional payment needed
          </p>
          <p className="m-0 font-[Inter] text-[10px] leading-[17px] text-[#292727]">
            {additionalPayment.note}
          </p>
        </div>
        <div className="flex-none text-center">
          <p className="m-0 font-[Inter] text-[14px] font-bold leading-[24px] text-[#292727]">
            ₱ {Number(additionalPayment.amount || 0).toLocaleString('en-PH')}
          </p>
          <p className="m-0 font-[Inter] text-[10px] leading-[17px] text-[#292727]">
            due for approval
          </p>
        </div>
      </div>

      <div className="mt-[10px] flex justify-end gap-[9px]">
        <ActionButton tone="approve" onClick={onApprove}>Approve</ActionButton>
        <ActionButton tone="negotiate" onClick={onNegotiate}>Negotiate</ActionButton>
        <ActionButton tone="decline" onClick={onDecline}>Decline</ActionButton>
      </div>

      <Divider className="mt-3" />
      <div className="mt-[10px] flex justify-end">
        <OutlineButton onClick={onMessage}>Message</OutlineButton>
      </div>
    </CardShell>
  );
}

// "Active > On-going" and "Completed" — progress timeline (View opens the repair details)
function ProgressCard({ request, onPayFinal, onView, onMessage }) {
  return (
    <CardShell padding="px-[22px] pb-3 pt-[10px]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <CardTitle id={request.id} />
          <p className="m-0 font-[Inter] text-[14px] leading-[22px] text-[#5B5959]">
            {request.providerName}
          </p>
        </div>
        <Pill color={pillColorOf(request)}>{request.badge}</Pill>
      </div>

      <Timeline steps={request.timeline} />

      <Divider />
      <div className="mt-[10px] flex justify-end gap-2">
        {request.awaitingPayment && (
          <OutlineButton onClick={onPayFinal}>Proceed to Payment</OutlineButton>
        )}
        <GradientButton onClick={onView}>View</GradientButton>
        <OutlineButton onClick={onMessage} className="!h-[30px] !w-[110px]">
          Message
        </OutlineButton>
      </div>
    </CardShell>
  );
}

/* ------------------------------------ negotiate modal ------------------------------------ */

// Opened by the Negotiate button of an additional-payment card. The customer can counter with an
// amount, a message, or both; it is sent to the provider without answering the request, so
// Approve / Decline stay available afterwards.
function NegotiateModal({ request, onClose, onSubmit }) {
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState('');
  const amountRef = useRef(null);
  const requested = Number(request.additionalPayment.amount || 0);

  useEffect(() => {
    amountRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !sending) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, sending]);

  const submit = async (e) => {
    e.preventDefault();
    if (sending) return;
    const trimmed = message.trim();
    const hasAmount = amount.trim() !== '';
    const value = Number(amount);
    if (hasAmount && (!Number.isFinite(value) || value <= 0)) {
      setProblem('Enter a valid amount greater than zero.');
      return;
    }
    if (!hasAmount && !trimmed) {
      setProblem('Enter the amount you can pay or a message for the service provider.');
      return;
    }
    setSending(true);
    setProblem('');
    try {
      await onSubmit({ proposedAmount: hasAmount ? value : undefined, message: trimmed });
    } catch (err) {
      setProblem(err.message || 'Could not send your offer. Please try again.');
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !sending) onClose();
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="negotiate-title"
        onSubmit={submit}
        className="box-border w-full max-w-[460px] rounded-[14px] border border-[#818080] bg-white p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="negotiate-title" className="m-0 font-[Inter] text-[18px] font-bold leading-[26px] text-[#292727]">
              Negotiate additional payment
            </h2>
            <p className="m-0 font-[Inter] text-[13px] leading-[20px] text-[#5B5959]">
              Request #{request.id} · {request.providerName}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            disabled={sending}
            className="flex-none cursor-pointer rounded-full border-none bg-transparent p-1 text-[#484040] hover:bg-[#F3F3F3]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 box-border rounded-[10px] border border-[#B1A8A8] bg-[#FFFED3] px-3 py-2">
          <p className="m-0 font-[Inter] text-[12px] font-bold leading-[20px] text-[#BB8157]">
            Provider is asking for ₱ {formatAmount(requested)}
          </p>
          {request.additionalPayment.note && (
            <p className="m-0 font-[Inter] text-[11px] leading-[17px] text-[#292727]">
              {request.additionalPayment.note}
            </p>
          )}
        </div>

        <label htmlFor="negotiate-amount" className="mt-4 block font-[Inter] text-[12px] font-bold text-[#191818]">
          Amount you can pay (optional)
        </label>
        <div className="relative mt-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-[Inter] text-[14px] text-[#484040]">
            ₱
          </span>
          <input
            id="negotiate-amount"
            ref={amountRef}
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="box-border h-[40px] w-full rounded-[10px] border border-[#7E7A7A] bg-white pl-8 pr-3 font-[Inter] text-[14px] text-[#292727] outline-none focus-visible:border-[#0255AF] focus-visible:ring-1 focus-visible:ring-[#0255AF]"
          />
        </div>

        <label htmlFor="negotiate-message" className="mt-3 block font-[Inter] text-[12px] font-bold text-[#191818]">
          Message to the service provider
        </label>
        <textarea
          id="negotiate-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={500}
          rows={4}
          placeholder="Explain your offer or ask for a breakdown of the extra cost."
          className="mt-1 box-border w-full resize-none rounded-[10px] border border-[#7E7A7A] bg-white p-3 font-[Inter] text-[14px] leading-[20px] text-[#292727] outline-none placeholder:text-[#718096] focus-visible:border-[#0255AF] focus-visible:ring-1 focus-visible:ring-[#0255AF]"
        />
        <p className="m-0 mt-1 text-right font-[Inter] text-[11px] text-[#7C7979]">{message.length}/500</p>

        {problem && (
          <p role="alert" className="m-0 mt-2 font-[Inter] text-[13px] text-[#B91C1C]">
            {problem}
          </p>
        )}

        <p className="m-0 mt-3 font-[Inter] text-[11px] leading-[16px] text-[#7C7979]">
          Your offer is sent to the provider. The request stays open until you approve or decline it.
        </p>

        <div className="mt-4 flex justify-end gap-2">
          <OutlineButton onClick={onClose}>Cancel</OutlineButton>
          <button
            type="submit"
            disabled={sending}
            className="box-border h-[31px] min-w-[110px] cursor-pointer rounded-[10px] border border-[#B1A8A8] bg-[#DEBF6A] px-5 font-[Inter] text-[12px] font-bold leading-[20px] text-white hover:bg-[#CFAF55] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0255AF]"
          >
            {sending ? 'Sending…' : 'Send offer'}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ------------------------------------ page ------------------------------------ */

const EMPTY_GROUPS = () => Object.fromEntries(GROUP_ORDER.map((key) => [key, []]));

const EMPTY_TEXT = {
  all: 'No requests to show here yet.',
  pending: 'No pending requests.',
  active: 'No active requests here.',
  completed: 'No completed requests yet.',
  closed: 'No closed requests.',
};

export default function TrackRequest() {
  const navigate = useNavigate();

  // Filters. status / category = null until the customer picks one (placeholder label shows
  // and everything is listed). `activeSub` is the sub-tab under the "Active" status.
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const paymentParam = searchParams.get('payment');
  const initialView = TAB_TO_VIEW[tabFromUrl] || {};
  const [status, setStatus] = useState(initialView.status ?? null);
  const [activeSub, setActiveSub] = useState(initialView.sub ?? 'approved');
  const [category, setCategory] = useState(null);
  useEffect(() => {
    const view = TAB_TO_VIEW[tabFromUrl];
    if (!view) return;
    setStatus(view.status);
    if (view.sub) setActiveSub(view.sub);
  }, [tabFromUrl]);

  const [search, setSearch] = useState('');
  const [cardsByTab, setCardsByTab] = useState(EMPTY_GROUPS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null); // { tone: 'success' | 'info', text }
  const [busyCardId, setBusyCardId] = useState(null); // card with an action in flight
  const [negotiating, setNegotiating] = useState(null); // request shown in the Negotiate modal
  const loadSeq = useRef(0);

  // GET /api/service-requests/tracking — one call fills every group. Resolves the regrouped
  // cards (or null on failure) so callers can look at the fresh data.
  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    try {
      const groups = await getTrackingCards();
      const mapped = {};
      GROUP_ORDER.forEach((key) => {
        mapped[key] = (groups?.[key] ?? []).map(mapCard(key));
      });
      // mapCard() sets the final `status` of every card: quotations -> approved (Quotations tab),
      // a paid completed job -> done, an unpaid completed job -> ongoing.
      const regrouped = EMPTY_GROUPS();
      Object.values(mapped)
        .flat()
        .forEach((card) => regrouped[card.status in regrouped ? card.status : 'sent'].push(card));
      if (seq === loadSeq.current) {
        setCardsByTab(regrouped);
        setError('');
      }
      return regrouped;
    } catch (err) {
      if (seq === loadSeq.current) {
        setError(err.message || 'Could not load your requests. Please try again.');
      }
      return null;
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Coming back to this tab (e.g. from the payment page) refreshes the cards.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load]);

  // Keep the cards live: a provider's Update Status (new step, notes, photos) shows up here
  // without a reload. Paused while the tab is hidden, a modal is open or an action is running.
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible' || negotiating || busyCardId) return;
      load();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [load, negotiating, busyCardId]);

  // Back from the PayMongo checkout: /customer/requests?payment=success|cancelled&tab=...
  // The server confirms the payment with PayMongo while building the cards; if a card still
  // awaits payment, retry a few times in case the confirmation is slow.
  useEffect(() => {
    if (!paymentParam) return undefined;
    let stop = false;
    const clearParam = () => {
      const next = new URLSearchParams(window.location.search);
      next.delete('payment');
      setSearchParams(next, { replace: true });
    };
    if (paymentParam !== 'success') {
      setNotice({ tone: 'info', text: 'Payment cancelled. No charge was made.' });
      clearParam();
      return undefined;
    }
    (async () => {
      setNotice({ tone: 'info', text: 'Confirming your payment…' });
      let settled = false;
      for (let attempt = 0; attempt < 4 && !stop; attempt += 1) {
        const groups = await load();
        if (groups && !Object.values(groups).flat().some((c) => c.awaitingPayment)) {
          settled = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 2500));
      }
      if (stop) return;
      setNotice(
        settled
          ? { tone: 'success', text: 'Payment received. Your requests have been updated.' }
          : { tone: 'info', text: 'Payment submitted. It can take a moment to show up. Please check again shortly.' }
      );
      clearParam();
    })();
    return () => {
      stop = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentParam]);

  const statusKey = status ?? 'all';
  const showSubTabs = statusKey === 'active';
  const categoryKey = category ?? 'all';
  const filtersActive = statusKey !== 'all' || categoryKey !== 'all' || search.trim() !== '';

  // The Category dropdown and the search box apply to every status; the status picks the groups.
  const passesFilters = useCallback(
    (r) => {
      if (categoryKey !== 'all' && categoryKeyOf(r.category) !== categoryKey) return false;
      const q = search.trim().toLowerCase();
      return !q || searchText(r).includes(q);
    },
    [categoryKey, search]
  );

  const visibleRequests = useMemo(() => {
    const groups = showSubTabs ? [activeSub] : STATUS_GROUPS[statusKey] ?? GROUP_ORDER;
    return groups.flatMap((key) => cardsByTab[key] ?? []).filter(passesFilters);
  }, [cardsByTab, statusKey, showSubTabs, activeSub, passesFilters]);

  const subCounts = useMemo(
    () =>
      Object.fromEntries(
        ACTIVE_SUBTABS.map((tab) => [tab.key, (cardsByTab[tab.key] ?? []).filter(passesFilters).length])
      ),
    [cardsByTab, passesFilters]
  );

  // Payment screen. The amount is re-read from the server first: if nothing is due any more
  // (the payment already went through) the card is refreshed instead of opening a second payment.
  const goToPayment = async (request, paymentType) => {
    setError('');
    setBusyCardId(request.cardId);
    try {
      const due = await getPaymentDue(request.id);
      const amount = Number(due?.due?.[paymentType] ?? 0);
      if (!(amount > 0)) {
        setNotice({ tone: 'success', text: `Request #${request.id} has no balance left to pay.` });
        await load();
        return;
      }
      navigate(`/customer/requests/${request.id}/payment`, {
        state: { requestId: request.id, amount, paymentType },
      });
    } catch (err) {
      setError(err.message || 'Could not open the payment. Please try again.');
    } finally {
      setBusyCardId(null);
    }
  };

  /* ----- handlers: answer the provider, then reload the cards from the server ----- */

  // Runs one card action once at a time and dims the card while it is in flight.
  const runCardAction = async (request, action, failMessage) => {
    if (busyCardId) return;
    setError('');
    setBusyCardId(request.cardId);
    try {
      await action();
    } catch (err) {
      setError(err.message || failMessage);
    } finally {
      setBusyCardId(null);
    }
  };

  const handleScheduleResponse = (request, accepted) =>
    runCardAction(
      request,
      async () => {
        await answerScheduleProposal(request.id, request.schedule.proposalId, accepted ? 'accept' : 'reject');
        await load();
      },
      'Could not send your answer. Please try again.'
    );

  const handleAdditionalPayment = (request, approved) =>
    runCardAction(
      request,
      async () => {
        await answerPaymentRequest(
          request.id,
          request.additionalPayment.paymentRequestId,
          approved ? 'approve' : 'reject'
        );
        if (approved) {
          // The Payment screen re-computes the exact amount due from the backend.
          const due = await getPaymentDue(request.id);
          const amount = Number(due?.due?.additional ?? request.additionalPayment.amount ?? 0);
          navigate(`/customer/requests/${request.id}/payment`, {
            state: { requestId: request.id, amount, paymentType: 'additional' },
          });
        } else {
          await load();
        }
      },
      'Could not send your answer. Please try again.'
    );

  const handleMessage = (request) => {
    // Opens the chat popup (bottom-right) on this request's conversation.
    openChat({ id: request.providerId, name: request.providerName, requestId: request.id });
  };

  // Negotiate modal -> POST .../payment-requests/:pid/negotiate
  const sendNegotiation = async ({ proposedAmount, message }) => {
    const request = negotiating;
    await negotiatePaymentRequest(request.id, request.additionalPayment.paymentRequestId, {
      proposedAmount,
      message,
    });
    setNegotiating(null);
    setNotice({
      tone: 'success',
      text: `Your offer was sent to ${request.providerName}. You can still approve or decline the payment.`,
    });
  };

  const renderCard = (request) => {
    if (request.kind === 'quotation') {
      return (
        <QuotationCard request={request} onOpen={() => navigate(`/customer/requests/${request.id}`)} />
      );
    }
    if (request.kind === 'schedule') {
      return (
        <ScheduleCard
          request={request}
          onAccept={() => handleScheduleResponse(request, true)}
          onReject={() => handleScheduleResponse(request, false)}
        />
      );
    }
    if (request.kind === 'additional_payment') {
      return (
        <AdditionalPaymentCard
          request={request}
          onApprove={() => handleAdditionalPayment(request, true)}
          onNegotiate={() => setNegotiating(request)}
          onDecline={() => handleAdditionalPayment(request, false)}
          onMessage={() => handleMessage(request)}
        />
      );
    }
    if (request.kind === 'progress') {
      return (
        <ProgressCard
          request={request}
          onPayFinal={() => goToPayment(request, 'final')}
          onView={() => navigate(`/customer/requests/${request.id}/repair-details`)}
          onMessage={() => handleMessage(request)}
        />
      );
    }
    return (
      <SummaryCard request={request} onFindProvider={() => navigate('/customer/providers')} />
    );
  };

  return (
    <CustomerSidebar>
      <div className="min-h-full bg-[#FAFAFA]">
        <div className="box-border px-4 py-6 sm:px-[42px]">
          <h1 className="m-0 flex h-[68px] items-center font-[Quicksand] text-[48px] font-bold leading-[32px] text-[#005FCA]">
            My Requests
          </h1>

          <div>
            {/* Search + Categories + Status */}
            <div className="mt-[17px] flex flex-wrap items-start gap-x-[15px] gap-y-3">
              <div className="relative h-[49px] min-w-[240px] flex-1">
                <Search
                  size={20}
                  color="#393939"
                  className="pointer-events-none absolute left-[22px] top-1/2 -translate-y-1/2"
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search request"
                  aria-label="Search request"
                  className="box-border h-full w-full rounded-[14px] border border-[#7E7A7A] bg-white pl-[67px] pr-4 font-[Inter] text-[16px] font-medium leading-[24px] tracking-[-0.3125px] text-[#292727] outline-none placeholder:text-[#718096] focus-visible:border-[#0255AF] focus-visible:ring-1 focus-visible:ring-[#0255AF]"
                />
              </div>

              <div className="flex gap-2">
                <FilterDropdown
                  placeholder="Categories"
                  options={CATEGORY_OPTIONS}
                  value={category}
                  onChange={setCategory}
                />
                <FilterDropdown
                  placeholder="Status"
                  options={STATUS_OPTIONS}
                  value={status}
                  onChange={setStatus}
                />
              </div>
            </div>

            {/* Active > Quotations | On-going */}
            {showSubTabs && (
              <div role="tablist" aria-label="Active requests" className="mt-[18px] flex">
                {ACTIVE_SUBTABS.map((tab) => {
                  const on = tab.key === activeSub;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      role="tab"
                      aria-selected={on}
                      onClick={() => setActiveSub(tab.key)}
                      className="flex-1 cursor-pointer border-none bg-transparent p-0 text-center"
                    >
                      <span
                        className={`block h-[29px] font-[Quicksand] text-[17px] leading-[29px] text-[#292727] ${
                          on ? 'font-bold' : 'font-medium'
                        }`}
                      >
                        {tab.label}
                        {subCounts[tab.key] > 0 ? ` (${subCounts[tab.key]})` : ''}
                      </span>
                      <span
                        className={`mt-[10px] block h-[3px] rounded-[10px] ${
                          on ? 'bg-[#18315B]' : 'bg-[#D9D9D9]'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            )}

            {notice && (
              <div
                role="status"
                className={`mt-4 flex items-start justify-between gap-3 rounded-[10px] border px-4 py-3 font-[Inter] text-[13px] ${
                  notice.tone === 'success'
                    ? 'border-[#167713]/40 bg-[#EEF8EE] text-[#126010]'
                    : 'border-[#577FBB]/40 bg-[#EEF3FB] text-[#18315B]'
                }`}
              >
                <span>{notice.text}</span>
                <button
                  type="button"
                  aria-label="Dismiss"
                  onClick={() => setNotice(null)}
                  className="flex-none cursor-pointer border-none bg-transparent p-0 text-inherit"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {error && (
              <p role="alert" className="m-0 mt-4 font-[Inter] text-[13px] text-[#B91C1C]">
                {error}
              </p>
            )}

            <div className="mt-[29px] flex flex-col gap-3">
              {loading ? (
                <p className="m-0 font-[Inter] text-[14px] text-[#7C7979]">Loading your requests…</p>
              ) : visibleRequests.length === 0 ? (
                <p className="m-0 font-[Inter] text-[14px] text-[#7C7979]">
                  {filtersActive
                    ? categoryKey !== 'all' || search.trim()
                      ? 'No requests match your search or filters.'
                      : EMPTY_TEXT[statusKey]
                    : EMPTY_TEXT.all}
                </p>
              ) : (
                visibleRequests.map((request) => (
                  <div
                    key={request.cardId}
                    aria-busy={busyCardId === request.cardId}
                    className={busyCardId === request.cardId ? 'pointer-events-none opacity-60' : ''}
                  >
                    {renderCard(request)}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {negotiating && (
        <NegotiateModal
          request={negotiating}
          onClose={() => setNegotiating(null)}
          onSubmit={sendNegotiation}
        />
      )}
    </CustomerSidebar>
  );
}