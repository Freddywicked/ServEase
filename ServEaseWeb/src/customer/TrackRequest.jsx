import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check } from 'lucide-react';
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

   Actions:
     schedule proposal     -> POST /api/service-requests/:id/schedule-proposals/:pid/accept|reject
     additional payment    -> POST /api/service-requests/:id/payment-requests/:pid/approve|reject
     quotation review      -> MyRequestDetails.jsx (/customer/requests/:requestId)
     final payment         -> Payment.jsx (/customer/requests/:requestId/payment)
   ===================================================================================== */


const TABS = [
  { key: 'sent', label: 'Sent' },
  { key: 'approved', label: 'Approved' },
  { key: 'ongoing', label: 'On-going' },
  { key: 'declined', label: 'Declined' },
  { key: 'done', label: 'Done' },
];

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
  };
  switch (card.cardType) {
    case 'quotation':
      return {
        ...base,
        kind: 'quotation',
        badge: card.statusLabel || 'New Quotation',
        quotation: {
          reason: card.notes || '',
          items: [
            { label: 'Labor', amount: card.laborCost },
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
      // Provider marked the job completed. It is only finished (Done tab) once the customer
      // paid the remaining balance; until then it stays On-going with "Proceed to Payment".
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
      return { ...base, kind: 'summary', declinedReason: card.reason || null };
    case 'diagnosis':
    default:
      return {
        ...base,
        kind: 'summary',
        probableCause: card.probableCause || null,
        confidence: card.confidencePercent ?? 0,
      };
  }
};

const formatAmount = (n) =>
  n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatPeso = (n) => `₱${formatAmount(n)}`;

/* ------------------------------------ small UI parts ------------------------------------ */

// Accept/Approve buttons are green (#167713) and Decline/Reject buttons red (#C62828).
const BUTTON_VARIANTS = {
  default: 'border-[#B1A8A8] bg-[#FFFDFD] text-[#414141] hover:bg-[#F3F3F3]',
  accept: 'border-[#167713] bg-[#167713] text-white hover:bg-[#126010]',
  decline: 'border-[#C62828] bg-[#C62828] text-white hover:bg-[#A82020]',
};

function SmallButton({ children, onClick, variant = 'default', className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-[26px] cursor-pointer rounded-[8px] border px-4 font-[Inter] text-[11px] font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0255AF] ${BUTTON_VARIANTS[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

function Badge({ children, color }) {
  return (
    <span
      className="flex-none rounded-[4px] px-2 py-[3px] font-[Inter] text-[10px] font-bold leading-[12px] text-white"
      style={{ backgroundColor: color }}
    >
      {children}
    </span>
  );
}

const BADGE_BLUE = '#4B78BD';
const BADGE_BROWN = '#B08968';

function CardShell({ children, onClick, label }) {
  const clickable = typeof onClick === 'function';
  return (
    <article
      onClick={onClick}
      onKeyDown={clickable ? (e) => (e.key === 'Enter' || e.key === ' ') && onClick() : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={clickable ? label : undefined}
      className={`box-border w-full max-w-[876px] rounded-[10px] border border-[#818080] bg-white px-[19px] py-4 ${
        clickable ? 'cursor-pointer hover:bg-[#FAFCFF]' : ''
      }`}
    >
      {children}
    </article>
  );
}

function CardTitle({ id }) {
  return (
    <h3 className="m-0 font-[Inter] text-[15px] font-bold leading-[26px] text-[#292727]">
      Request #{id}
    </h3>
  );
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

/* ------------------------------------ request cards ------------------------------------ */

// "Sent" and "Declined" tabs (AI probable cause + confidence bar)
function SummaryCard({ request, onFindProvider }) {
  return (
    <CardShell>
      <CardTitle id={request.id} />
      <p className="m-0 mt-[6px] font-[Inter] text-[14px] leading-[17px] text-[#484040]">
        sent to <strong>{request.providerName}</strong>
      </p>
      {request.declinedReason !== undefined && request.status === 'declined' ? (
        <>
          <p className="m-0 mt-[11px] font-[Inter] text-[13px] leading-[16px] text-[#484040]">
            Declined by the service provider
          </p>
          <p className="m-0 mt-[2px] font-[Inter] text-[14px] leading-[17px] text-[#484040]">
            {request.declinedReason || 'No reason given.'}
          </p>
        </>
      ) : (
        <>
          <p className="m-0 mt-[11px] font-[Inter] text-[13px] leading-[16px] text-[#484040]">
            Probable Cause
          </p>
          <p className="m-0 mt-[2px] font-[Inter] text-[16px] font-bold leading-[19px] text-[#484040]">
            {request.probableCause || 'Waiting for the provider to review the request'}
          </p>
          <div className="mt-[9px] flex items-center gap-[14px]">
            <div className="h-[10px] max-w-[742px] flex-1 overflow-hidden rounded-[10px] bg-[#D9D9D9]">
              <div
                className="h-full rounded-[10px] bg-[#0255AF]"
                style={{ width: `${request.confidence}%` }}
              />
            </div>
            <span className="w-[34px] font-[Inter] text-[10px] leading-[12px] text-[#484040]">
              {request.confidence}%
            </span>
          </div>
          <p className="m-0 mt-[6px] font-[Inter] text-[13px] leading-[16px] text-[#484040]">
            Confidence based on similar reported cases
          </p>
        </>
      )}
      {request.status === 'declined' && (
        <div className="mt-3 flex justify-end">
          <SmallButton onClick={onFindProvider}>Find Service Provider</SmallButton>
        </div>
      )}
    </CardShell>
  );
}

// "Approved" tab — provider sent a quotation (click to review it)
function QuotationCard({ request, onOpen }) {
  const { quotation } = request;
  return (
    <CardShell onClick={onOpen} label={`Review quotation for request ${request.id}`}>
      <div className="flex items-start justify-between gap-3">
        <CardTitle id={request.id} />
        <Badge color={BADGE_BROWN}>{request.badge}</Badge>
      </div>
      <p className="m-0 font-[Inter] text-[13px] leading-[16px] text-[#484040]">
        {request.providerName} sent a quotation
      </p>
      <div className="mt-3 flex justify-between font-[Inter] text-[12px] leading-[16px] text-[#484040]">
        <span className="font-bold">Labor Cost</span>
        <span>{formatAmount(quotation.items[0].amount)}</span>
      </div>
      <div className="mt-[6px] flex justify-between border-t border-[#292727] pt-[6px] font-[Inter] text-[12px] font-bold leading-[16px] text-[#292727]">
        <span>Total</span>
        <span>{formatPeso(quotation.total)}</span>
      </div>
    </CardShell>
  );
}

// "Approved" tab — provider proposed a new schedule
function ScheduleCard({ request, onAccept, onReject }) {
  const { schedule } = request;
  return (
    <CardShell>
      <div className="flex items-start justify-between gap-3">
        <CardTitle id={request.id} />
        <Badge color={BADGE_BROWN}>{request.badge}</Badge>
      </div>
      <p className="m-0 font-[Inter] text-[13px] leading-[16px] text-[#484040]">
        {request.providerName} sent a new schedule
      </p>
      <p className="m-0 mt-3 text-center font-[Inter] text-[14px] font-bold leading-[17px] text-[#292727]">
        {schedule.dateTime}
      </p>
      <p className="m-0 mt-3 font-[Inter] text-[12px] font-bold leading-[16px] text-[#292727]">
        Reason for New Schedule
      </p>
      <p className="m-0 font-[Inter] text-[12px] leading-[16px] text-[#5B5959]">
        {schedule.reason}
      </p>
      <div className="mt-3 flex justify-end gap-2">
        <SmallButton variant="accept" onClick={onAccept}>Accept</SmallButton>
        <SmallButton variant="decline" onClick={onReject}>Reject</SmallButton>
      </div>
    </CardShell>
  );
}

// "On-going" tab — provider asks for an additional payment
function AdditionalPaymentCard({ request, onApprove, onDecline, onMessage }) {
  const { additionalPayment } = request;
  return (
    <CardShell>
      <div className="flex items-start justify-between gap-3">
        <div>
          <CardTitle id={request.id} />
          <p className="m-0 font-[Inter] text-[13px] leading-[16px] text-[#484040]">
            {request.providerName}
          </p>
        </div>
        <Badge color={BADGE_BLUE}>{request.badge}</Badge>
      </div>

      <div className="mt-3 rounded-[6px] border border-[#EBDD9A] bg-[#FFF8D6] px-4 py-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="m-0 font-[Inter] text-[13px] font-bold leading-[16px] text-[#B7791F]">
              Additional payment needed
            </p>
            <p className="m-0 mt-[2px] font-[Inter] text-[11px] leading-[14px] text-[#5B5959]">
              {additionalPayment.note}
            </p>
          </div>
          <div className="text-right">
            <p className="m-0 font-[Inter] text-[15px] font-bold leading-[18px] text-[#414141]">
              ₱ {additionalPayment.amount.toLocaleString('en-PH')}
            </p>
            <p className="m-0 font-[Inter] text-[10px] leading-[12px] text-[#7C7979]">
              Due for approval
            </p>
          </div>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <SmallButton variant="accept" onClick={onApprove}>Approve</SmallButton>
          <SmallButton variant="decline" onClick={onDecline}>Decline</SmallButton>
        </div>
      </div>

      <div className="mt-3 flex justify-end border-t border-[#D9D9D9] pt-3">
        <SmallButton onClick={onMessage}>Message</SmallButton>
      </div>
    </CardShell>
  );
}

// "On-going" and "Done" tabs — progress timeline
function ProgressCard({ request, onPayFinal, onMessage }) {
  return (
    <CardShell>
      <div className="flex items-start justify-between gap-3">
        <div>
          <CardTitle id={request.id} />
          <p className="m-0 font-[Inter] text-[13px] leading-[16px] text-[#484040]">
            {request.providerName}
          </p>
        </div>
        <Badge color={BADGE_BLUE}>{request.badge}</Badge>
      </div>

      <Timeline steps={request.timeline} />

      <div className="flex justify-end gap-2 border-t border-[#D9D9D9] pt-3">
        {request.awaitingPayment && (
          <SmallButton onClick={onPayFinal}>Proceed to Payment</SmallButton>
        )}
        <SmallButton onClick={onMessage}>Message</SmallButton>
      </div>
    </CardShell>
  );
}

/* ------------------------------------ page ------------------------------------ */

export default function TrackRequest() {
  const navigate = useNavigate();

  // Notifications deep-link here with ?tab=sent|approved|ongoing|declined|done.
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const isValidTab = (key) => TABS.some((tab) => tab.key === key);
  const [activeTab, setActiveTab] = useState(isValidTab(tabFromUrl) ? tabFromUrl : 'sent');
  useEffect(() => {
    if (isValidTab(tabFromUrl)) setActiveTab(tabFromUrl);
  }, [tabFromUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const [search, setSearch] = useState('');
  const [cardsByTab, setCardsByTab] = useState({
    sent: [],
    approved: [],
    ongoing: [],
    declined: [],
    done: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // GET /api/service-requests/tracking — one call fills every tab.
  const load = useCallback(async () => {
    setError('');
    try {
      const groups = await getTrackingCards();
      const mapped = {};
      TABS.forEach(({ key }) => {
        mapped[key] = (groups?.[key] ?? []).map(mapCard(key));
      });
      // An unpaid completed job belongs in On-going; a paid one in Done (mapCard sets `status`).
      const regrouped = Object.fromEntries(TABS.map(({ key }) => [key, []]));
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

  const visibleRequests = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = cardsByTab[activeTab] ?? [];
    if (!q) return list;
    return list.filter((r) => JSON.stringify(r).toLowerCase().includes(q));
  }, [cardsByTab, activeTab, search]);

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
      <div className="box-border px-[42px] pb-10 pt-[25px]">
        <h1 className="m-0 flex h-[68px] items-center font-[Quicksand] text-[48px] font-bold leading-[32px] text-[#005FCA]">
          My Requests
        </h1>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search request details...."
          aria-label="Search request details"
          className="mt-[21px] box-border h-[54px] w-full max-w-[876px] rounded-[8px] border-none bg-[#D2D2D2] px-[25px] font-[Poppins] text-[16px] font-medium text-black outline-none placeholder:text-black/[0.34] focus-visible:ring-2 focus-visible:ring-[#0255AF]"
        />

        <div className="mt-[21px] flex flex-wrap gap-1" role="group" aria-label="Request status">
          {TABS.map((tab) => {
            const active = tab.key === activeTab;
            return (
              <button
                key={tab.key}
                type="button"
                aria-pressed={active}
                onClick={() => setActiveTab(tab.key)}
                className={`h-[29px] w-[102px] cursor-pointer rounded-full border border-[#B1A8A8] font-[Quicksand] text-[13px] font-medium ${
                  active ? 'bg-[#021E79] text-white' : 'bg-white text-[#414141] hover:bg-[#F3F3F3]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {error && (
          <p role="alert" className="m-0 mt-4 font-[Inter] text-[13px] text-[#B91C1C]">
            {error}
          </p>
        )}

        <div className="mt-[34px] flex flex-col gap-5">
          {loading ? (
            <p className="m-0 font-[Inter] text-[14px] text-[#7C7979]">Loading your requests…</p>
          ) : visibleRequests.length === 0 ? (
            <p className="m-0 font-[Inter] text-[14px] text-[#7C7979]">
              No requests to show here yet.
            </p>
          ) : (
            visibleRequests.map((request) => (
              <div key={request.cardId}>{renderCard(request)}</div>
            ))
          )}
        </div>
      </div>
    </CustomerSidebar>
  );
}