import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import CustomerSidebar from '../components/CustomerSidebar';
import { openChat } from '../components/MessagingWidget';
// import { api } from '../api/client'; // BACKEND: use whichever request helper ../api/client exports

/* =====================================================================================
   BACKEND INTEGRATION (READY) — My Requests / Track Requests (customer)
   -------------------------------------------------------------------------------------
   Everything on this screen is hard-coded (MOCK_REQUESTS below). When the backend is
   ready, replace the mock data + the handler bodies with the calls below. The UI does not
   need to change as long as each request keeps the shape used in MOCK_REQUESTS.

   Proposed endpoints (rename to match ServEaseBackend):

   1) List requests (tab + search)
      GET  /api/customer/requests?status=sent|approved|ongoing|declined|done&q=<text>
      -> [{ id, status, kind, providerName, ... }]   (same shape as MOCK_REQUESTS)

      useEffect(() => {
        const controller = new AbortController();
        (async () => {
          try {
            const res = await api.get('/customer/requests', {
              params: { status: activeTab, q: search },
              signal: controller.signal,
            });
            setRequests(res.data);              // <- turn `requests` into useState([]) + setRequests
          } catch (err) {
            if (err.name !== 'CanceledError') console.error('Failed to load requests', err);
          }
        })();
        return () => controller.abort();
      }, [activeTab, search]);                   // debounce `search` (~300ms) before calling

   2) Quotation (opened in MyRequestDetails.jsx at /customer/requests/:requestId)
      Approve / decline calls live in MyRequestDetails.jsx.

   3) New schedule proposed by the provider
      POST /api/customer/requests/:id/schedule/accept
      POST /api/customer/requests/:id/schedule/reject

   4) Additional payment requested by the provider (On-going tab)
      POST /api/customer/requests/:id/additional-payment/approve   -> { amountDue }
      POST /api/customer/requests/:id/additional-payment/decline

   5) Final payment (Done tab) is started from the Payment screen (see Payment.jsx).
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

// HARD-CODED DATA — replace with the API response (see block above).
const MOCK_REQUESTS = [
  {
    id: 'SR-0000',
    status: 'sent',
    kind: 'summary',
    providerId: 'prov-mark-rivera', // BACKEND: the provider's user id
    providerName: 'Mark Rivera',
    probableCause: 'Liquid damage to charging circuit',
    confidence: 82,
  },
  {
    id: 'SR-0001',
    status: 'approved',
    kind: 'quotation',
    providerId: 'prov-micco-dominic', // BACKEND: the provider's user id
    providerName: 'Micco Dominic',
    badge: 'New Quotation',
    quotation: {
      reason: 'This sentence states the reason to justify the labor.',
      items: [{ label: 'Labor', amount: 850 }],
      total: 850,
    },
  },
  {
    id: 'SR-0002',
    status: 'approved',
    kind: 'schedule',
    providerId: 'prov-micco-dominic', // BACKEND: the provider's user id
    providerName: 'Micco Dominic',
    badge: 'New Schedule',
    schedule: {
      dateTime: 'MM/DD/YY 10:00AM',
      reason: 'Lorem ipsum dolor. Lorem ipsum dolor.',
    },
  },
  {
    id: 'SR-0003',
    status: 'ongoing',
    kind: 'additional_payment',
    providerId: 'prov-jose-rodolfo', // BACKEND: the provider's user id
    providerName: 'Jose Rodolfo',
    badge: 'In progress',
    additionalPayment: {
      amount: 3000,
      note: "Provider's reason for the extra charge is stated in this sentence.",
    },
  },
  {
    id: 'SR-0004',
    status: 'ongoing',
    kind: 'progress',
    providerId: 'prov-jose-rodolfo', // BACKEND: the provider's user id
    providerName: 'Jose Rodolfo',
    badge: 'In progress',
    timeline: ['done', 'done', 'current', 'pending'].map((state, i) => ({
      label: TIMELINE_LABELS[i],
      time: PLACEHOLDER_TIME,
      state,
    })),
  },
  {
    id: 'SR-0005',
    status: 'declined',
    kind: 'summary',
    providerId: 'prov-mark-rivera', // BACKEND: the provider's user id
    providerName: 'Mark Rivera',
    probableCause: 'Liquid damage to charging circuit',
    confidence: 82,
  },
  {
    id: 'SR-0006',
    status: 'done',
    kind: 'progress',
    providerId: 'prov-jose-rodolfo', // BACKEND: the provider's user id
    providerName: 'Jose Rodolfo',
    badge: 'Completed',
    finalPayment: 680, // remaining 80% of the 850.00 quotation
    timeline: ['done', 'done', 'done', 'completed'].map((state, i) => ({
      label: TIMELINE_LABELS[i],
      time: PLACEHOLDER_TIME,
      state,
    })),
  },
];

const formatAmount = (n) =>
  n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatPeso = (n) => `₱${formatAmount(n)}`;

/* ------------------------------------ small UI parts ------------------------------------ */

function SmallButton({ children, onClick, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-[26px] cursor-pointer rounded-[8px] border border-[#B1A8A8] bg-[#FFFDFD] px-4 font-[Inter] text-[11px] font-bold text-[#414141] hover:bg-[#F3F3F3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0255AF] ${className}`}
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

function StepDot({ state }) {
  const base = 'flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full';
  if (state === 'done') {
    return (
      <span className={`${base} bg-[#4B78BD]`}>
        <Check size={13} strokeWidth={3} color="#fff" />
      </span>
    );
  }
  if (state === 'current') return <span className={`${base} bg-[#4B78BD]`} />;
  if (state === 'completed') {
    return (
      <span className={`${base} bg-[#2B2B2B]`}>
        <Check size={13} strokeWidth={3} color="#fff" />
      </span>
    );
  }
  return <span className={`${base} bg-[#2B2B2B]`} />;
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
            <p className="m-0 font-[Inter] text-[10px] leading-[12px] text-[#7C7979]">
              {step.time}
            </p>
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
      <p className="m-0 mt-[11px] font-[Inter] text-[13px] leading-[16px] text-[#484040]">
        Probable Cause
      </p>
      <p className="m-0 mt-[2px] font-[Inter] text-[16px] font-bold leading-[19px] text-[#484040]">
        {request.probableCause}
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
        <SmallButton onClick={onAccept}>Accept</SmallButton>
        <SmallButton onClick={onReject}>Reject</SmallButton>
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
          <SmallButton onClick={onApprove}>Approve</SmallButton>
          <SmallButton onClick={onDecline}>Decline</SmallButton>
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
        {request.status === 'done' && (
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

  // BACKEND: turn into useState([]) and fill it with the API response.
  const [requests] = useState(MOCK_REQUESTS);
  const [activeTab, setActiveTab] = useState('sent');
  const [search, setSearch] = useState('');

  const visibleRequests = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter(
      (r) =>
        r.status === activeTab &&
        // BACKEND: search should be done server-side (?q=). This is only for the mock data.
        (!q || JSON.stringify(r).toLowerCase().includes(q))
    );
  }, [requests, activeTab, search]);

  const goToPayment = (request, amount, paymentType) => {
    navigate(`/customer/requests/${request.id}/payment`, {
      state: { requestId: request.id, amount, paymentType },
    });
  };

  /* ----- handlers (BACKEND: replace the TODO lines with the calls in the block at the top) ----- */

  const handleScheduleResponse = async (request, accepted) => {
    // TODO: await api.post(`/customer/requests/${request.id}/schedule/${accepted ? 'accept' : 'reject'}`);
    console.log(`Schedule ${accepted ? 'accepted' : 'rejected'}`, request.id);
  };

  const handleAdditionalPayment = async (request, approved) => {
    if (approved) {
      // TODO: const { data } = await api.post(`/customer/requests/${request.id}/additional-payment/approve`);
      goToPayment(request, request.additionalPayment.amount, 'additional'); // BACKEND: use data.amountDue
    } else {
      // TODO: await api.post(`/customer/requests/${request.id}/additional-payment/decline`);
      console.log('Additional payment declined', request.id);
    }
  };

  const handleMessage = (request) => {
    // Opens the chat popup (bottom-right) with this request's provider.
    openChat({ id: request.providerId, name: request.providerName });
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

        <div className="mt-[34px] flex flex-col gap-5">
          {visibleRequests.length === 0 ? (
            <p className="m-0 font-[Inter] text-[14px] text-[#7C7979]">
              No requests to show here yet.
            </p>
          ) : (
            visibleRequests.map((request) => <div key={request.id}>{renderCard(request)}</div>)
          )}
        </div>
      </div>
    </CustomerSidebar>
  );
}