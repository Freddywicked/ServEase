import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, ChevronDown, Search } from 'lucide-react';
import CustomerSidebar from '../components/CustomerSidebar';
import { openChat } from '../components/MessagingWidget';
import {
  answerPaymentRequest,
  answerScheduleProposal,
  getTrackingCards,
} from '../api/client';

/* =====================================================================================
   MY REQUESTS / TRACK REQUESTS (customer) — live data
   -------------------------------------------------------------------------------------
   One call (GET /api/service-requests/tracking) returns the cards grouped by tab:
   { sent, approved, ongoing, declined, done }. mapCard() below turns each backend
   card (cardType: diagnosis | quotation | schedule | payment | timeline | completed |
   declined) into the shape the card components render.

   Figma layout (Track / SR - SENT / SR - APPROVED):
     - Search bar + two dropdowns: "Categories" and "Status".
     - Status: All | Pending | Active | Completed | Closed
         Pending   -> backend group "sent"
         Active    -> backend groups "approved" (sub-tab "Quotations") and
                      "ongoing" (sub-tab "On-going")
         Completed -> backend group "done"
         Closed    -> backend group "declined"
     - Categories: All | IT-Related Devices | Phone Devices | Automotive | Home.
       Filtering uses the category the backend sends on each card
       (card.serviceCategory / card.category / card.categoryName) — see pickCategory().

   Actions:
     schedule proposal     -> POST /api/service-requests/:id/schedule-proposals/:pid/accept|reject
     additional payment    -> POST /api/service-requests/:id/payment-requests/:pid/approve|reject
     negotiate             -> opens the chat with the provider (no extra endpoint)
     quotation review      -> MyRequestDetails.jsx (/customer/requests/:requestId)
     final payment         -> Payment.jsx (/customer/requests/:requestId/payment)
   ===================================================================================== */

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
  if (/phone/.test(t)) return 'phone';
  if (/auto|vehicle|\bcar\b|motor/.test(t)) return 'automotive';
  if (/home|plumb|carpent|electric|appliance|handyman/.test(t)) return 'home';
  if (/\bit\b|computer|laptop|device/.test(t)) return 'it';
  return '';
};

const pickCategory = (card) =>
  card.serviceCategory ?? card.category ?? card.categoryName ?? card.category_name ?? '';

const TIMELINE_LABELS = [
  'Request received',
  'Quotation approved',
  'Service Provider is on the way',
  'Completed',
];
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

// The backend timeline is a list of { label, timestamp, description, done } using the
// provider's job stages; the design shows its own four labels, matched by position.
// Indicator flow (see Figma):
//  - a step stays grey ('pending') until the service provider updates it, then it is blue
//    with a check ('done');
//  - the last step, "Completed", is a darker grey ('completed') until the customer has paid
//    the remaining balance. Once the provider marked it completed but the balance is unpaid
//    it reads "Payment Pending"; after payment it turns blue like the other steps.
const mapTimeline = (steps, isPaid) =>
  steps.map((s, i) => {
    const isLast = i === steps.length - 1;
    if (isLast) {
      if (s.done && isPaid) {
        return { label: TIMELINE_LABELS[i] || s.label, time: s.timestamp ? formatDateTime(s.timestamp) : '', state: 'done' };
      }
      return {
        label: TIMELINE_LABELS[i] || s.label,
        time: s.done ? 'Payment Pending' : '',
        state: 'completed',
      };
    }
    return {
      label: TIMELINE_LABELS[i] || s.label,
      time: s.done && s.timestamp ? formatDateTime(s.timestamp) : '',
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
  };
  switch (card.cardType) {
    case 'quotation':
      return {
        ...base,
        kind: 'quotation',
        badge: card.statusLabel || 'Approve Quote?',
        quotation: {
          reason: card.notes || '',
          items: [
            { label: 'Labor Cost', amount: card.laborCost },
            ...(Number(card.partsCost) > 0 ? [{ label: 'Parts/Items', amount: card.partsCost }] : []),
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
        timeline: mapTimeline(card.timeline || [], false),
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
        awaitingPayment: !isPaid,
        timeline: mapTimeline(card.timeline || [], isPaid),
      };
    }
    case 'declined':
      return {
        ...base,
        kind: 'summary',
        badge: card.statusLabel || 'Declined',
        declinedReason: card.reason || null,
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

// done = blue + check; pending = grey; completed = darker grey (until the balance is paid).
function StepDot({ state }) {
  const base = 'flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full';
  if (state === 'done') {
    return (
      <span className={`${base} bg-[#4B78BD]`}>
        <Check size={13} strokeWidth={3} color="#fff" />
      </span>
    );
  }
  if (state === 'completed') return <span className={`${base} bg-[#3F3F3F]`} />;
  return <span className={`${base} bg-[#6B6B6B]`} />;
}

function Timeline({ steps }) {
  return (
    <ol className="m-0 mt-3 list-none p-0">
      {steps.map((step) => (
        <li key={step.label} className="mb-3 flex items-start gap-3">
          <StepDot state={step.state} />
          <div>
            <p className="m-0 font-[Inter] text-[12px] font-bold leading-[14px] text-[#292727]">
              {step.label}
            </p>
            {step.time ? (
              <p className="m-0 font-[Inter] text-[10px] leading-[12px] text-[#7C7979]">
                {step.time}
              </p>
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
            Declined by the service provider
          </p>
          <p className="m-0 mt-2 font-[Inter] text-[20px] font-bold leading-[24px] text-[#484040]">
            {request.declinedReason || 'No reason given.'}
          </p>
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

// "Active > On-going" and "Completed" — progress timeline
function ProgressCard({ request, onPayFinal, onMessage }) {
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
        <OutlineButton onClick={onMessage}>Message</OutlineButton>
      </div>
    </CardShell>
  );
}

/* ------------------------------------ page ------------------------------------ */

export default function TrackRequest() {
  const navigate = useNavigate();

  // Filters. status / category = null until the customer picks one (placeholder label shows
  // and everything is listed). `activeSub` is the sub-tab under the "Active" status.
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
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
  const [cardsByTab, setCardsByTab] = useState(
    Object.fromEntries(GROUP_ORDER.map((key) => [key, []]))
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // GET /api/service-requests/tracking — one call fills every group.
  const load = useCallback(async () => {
    setError('');
    try {
      const groups = await getTrackingCards();
      const mapped = {};
      GROUP_ORDER.forEach((key) => {
        mapped[key] = (groups?.[key] ?? []).map(mapCard(key));
      });
      // An unpaid completed job belongs in On-going; a paid one in Completed (mapCard sets `status`).
      const regrouped = Object.fromEntries(GROUP_ORDER.map((key) => [key, []]));
      Object.values(mapped)
        .flat()
        .forEach((card) => regrouped[card.status in regrouped ? card.status : 'sent'].push(card));
      setCardsByTab(regrouped);
    } catch (err) {
      setError(err.message || 'Could not load your requests. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const statusKey = status ?? 'all';
  const showSubTabs = statusKey === 'active';
  const filtersActive = statusKey !== 'all' || (category && category !== 'all') || search.trim();

  const visibleRequests = useMemo(() => {
    const groups = showSubTabs ? [activeSub] : STATUS_GROUPS[statusKey] ?? GROUP_ORDER;
    const q = search.trim().toLowerCase();
    return groups
      .flatMap((key) => cardsByTab[key] ?? [])
      .filter((r) => !category || category === 'all' || categoryKeyOf(r.category) === category)
      .filter((r) => !q || searchText(r).includes(q));
  }, [cardsByTab, statusKey, showSubTabs, activeSub, category, search]);

  const goToPayment = (request, amount, paymentType) => {
    navigate(`/customer/requests/${request.id}/payment`, {
      state: { requestId: request.id, amount, paymentType },
    });
  };

  /* ----- handlers: answer the provider, then reload the cards from the server ----- */

  const handleScheduleResponse = async (request, accepted) => {
    setError('');
    try {
      await answerScheduleProposal(request.id, request.schedule.proposalId, accepted ? 'accept' : 'reject');
      await load();
    } catch (err) {
      setError(err.message || 'Could not send your answer. Please try again.');
    }
  };

  const handleAdditionalPayment = async (request, approved) => {
    setError('');
    try {
      await answerPaymentRequest(
        request.id,
        request.additionalPayment.paymentRequestId,
        approved ? 'approve' : 'reject'
      );
      if (approved) {
        // The Payment screen re-computes the exact amount due from the backend.
        goToPayment(request, request.additionalPayment.amount, 'additional');
      } else {
        await load();
      }
    } catch (err) {
      setError(err.message || 'Could not send your answer. Please try again.');
    }
  };

  const handleMessage = (request) => {
    // Opens the chat popup (bottom-right) on this request's conversation.
    openChat({ id: request.providerId, name: request.providerName, requestId: request.id });
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
          onNegotiate={() => handleMessage(request)}
          onDecline={() => handleAdditionalPayment(request, false)}
          onMessage={() => handleMessage(request)}
        />
      );
    }
    if (request.kind === 'progress') {
      return (
        <ProgressCard
          request={request}
          onPayFinal={() => goToPayment(request, request.finalPayment, 'final')}
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
        <div className="box-border px-[42px] pb-10 pt-[25px]">
          <h1 className="m-0 flex h-[68px] items-center font-[Quicksand] text-[48px] font-bold leading-[32px] text-[#005FCA]">
            My Requests
          </h1>

          <div className="max-w-[1068px]">
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

            {error && (
              <p role="alert" className="m-0 mt-4 font-[Inter] text-[13px] text-[#B91C1C]">
                {error}
              </p>
            )}

            <div className={`flex flex-col gap-[18px] ${showSubTabs ? 'mt-[30px]' : 'mt-[37px]'}`}>
              {loading ? (
                <p className="m-0 font-[Inter] text-[14px] text-[#7C7979]">Loading your requests…</p>
              ) : visibleRequests.length === 0 ? (
                <p className="m-0 font-[Inter] text-[14px] text-[#7C7979]">
                  {filtersActive
                    ? 'No requests match your search or filters.'
                    : 'No requests to show here yet.'}
                </p>
              ) : (
                visibleRequests.map((request) => (
                  <div key={request.cardId}>{renderCard(request)}</div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </CustomerSidebar>
  );
}