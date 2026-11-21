import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import ServiceProviderSidebar from '../components/ServiceProviderSidebar.jsx';
import {
  FilterDropdown,
  GRADIENT,
  QuotationModal,
  SearchField,
  SF_PRO,
} from '../components/ProviderRequestUI.jsx';
import { useAuth } from '../context/auth_context';
import { getProviderServiceRequests, getServiceCategories, sendQuote } from '../api/client';
import lightningIcon from '../assets/icon_lightning.png';
import pinIcon from '../assets/icon_pinloc.png';

// The list comes from the backend: GET /api/providers/requests -> { requests: [...] }.
// A request shows up here as soon as a customer submits it to this provider
// (RecommendServiceProvider.jsx -> POST /api/service-requests/:id/submit).
//
// Shape of one request:
// {
//   id: 'SR-0000',                  // request number shown as "Request #SR-0000"
//   customerName: 'Dominic Alcantara',
//   createdAt: '2026-06-27',        // ISO date, shown as "Jun 27"
//   category: 'IT-Related Devices', // the request's service category (Categories dropdown)
//   aiDiagnosis: 'capacitor failure' | null,   // null when the customer skipped the AI step
//   aiConfidence: 82 | null,        // percent
//   distanceKm: 1.2 | null,         // null until the backend can compute it
//   status: 'new' | 'quoted' | 'closed',
//       // new    = waiting on this provider (no quotation sent yet)
//       // quoted = Pending: quotation sent, the customer has not answered yet
//       // closed = declined by this provider OR the customer declined the quotation
//   quote: { labor: 800, parts: 2000 } | null, // present once a quotation was sent
//   closedBy: 'provider' | 'customer' | null,  // only when status === 'closed'
//   declinedReason: 'text' | null,             // only when status === 'closed'
// }

// New requests appear without a page refresh: the list is re-fetched this often.
const POLL_INTERVAL_MS = 15000;

// Status dropdown. `match` maps the dropdown value to the backend request status.
const STATUS_OPTIONS = [
  { value: 'all', label: 'All', match: () => true },
  { value: 'new', label: 'New', match: (r) => r.status === 'new' },
  { value: 'pending', label: 'Pending', match: (r) => r.status === 'quoted' },
  { value: 'closed', label: 'Closed', match: (r) => r.status === 'closed' },
];

// "2026-06-27" -> "Jun 27"
const formatShortDate = (iso) => {
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!y || !m || !d) return '';
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatPesos = (n) => Number(n || 0).toLocaleString('en-US');
const sameText = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

function DistanceRow({ km, textClass }) {
  if (km == null) return null;
  return (
    <div className="flex items-center gap-[7px]">
      <img src={pinIcon} alt="" className="h-[18px] w-[14px] flex-none object-contain" />
      <span className={`${textClass} font-normal text-[#5B5959]`}>{km} km away</span>
    </div>
  );
}

function AiBar({ request, compact }) {
  if (!request.aiDiagnosis) return null;
  return (
    <div
      className={`box-border flex w-full items-center rounded-[10px] bg-[#262728] ${
        compact ? 'h-[34px] pl-[15px]' : 'h-[41px] pl-[17px]'
      }`}
    >
      <img src={lightningIcon} alt="" className="h-[18px] w-[14px] flex-none object-contain" />
      <span
        className={`font-normal text-white ${
          compact ? 'ml-[12px] text-[9px] leading-[15px]' : 'ml-[14px] text-[11px] leading-[19px]'
        }`}
      >
        AI suggests {request.aiDiagnosis}
        {request.aiConfidence != null ? ` (${request.aiConfidence}% confidence)` : ''}
      </span>
    </div>
  );
}

const CARD_BASE = `relative box-border w-full rounded-[10px] border border-[#818080] bg-white ${SF_PRO}`;

// status: new — Figma "Service Requests" card (View + Accept)
function NewRequestCard({ request, onAccept }) {
  return (
    <article className={`${CARD_BASE} pb-[18px] pt-[11px]`}>
      <div className="px-4">
        <p className="m-0 text-[13px] font-bold leading-[22px] text-[#292727]">Request #{request.id}</p>
        <p className="m-0 text-[11px] font-normal leading-[19px] text-[#5B5959]">
          {request.customerName} | {formatShortDate(request.createdAt)}
        </p>
        {request.distanceKm != null && (
          <div className="mt-[8px]">
            <DistanceRow km={request.distanceKm} textClass="text-[10px] leading-[17px]" />
          </div>
        )}
      </div>

      {request.aiDiagnosis && (
        <div className="mx-[29px] mt-[13px]">
          <AiBar request={request} />
        </div>
      )}

      <hr className="mx-[32px] mb-0 mt-[17px] border-0 border-t border-black/40" />

      <div className="mt-[17px] flex flex-wrap justify-end gap-[26px] px-[29px]">
        <Link
          to={`/serviceprovider/requests/${encodeURIComponent(request.id)}`}
          className="box-border flex h-[35px] w-[175px] max-w-full items-center justify-center rounded-[10px] border border-[#B1A8A8] bg-[#FFFDFD] text-[12px] font-bold leading-[20px] text-[#414141] no-underline"
        >
          View
        </Link>
        <button
          type="button"
          onClick={() => onAccept(request)}
          className={`box-border flex h-[35px] w-[175px] max-w-full cursor-pointer items-center justify-center rounded-[10px] border border-[#B1A8A8] ${GRADIENT} text-[12px] font-bold leading-[20px] text-white`}
        >
          Accept
        </button>
      </div>
    </article>
  );
}

// status: quoted — Figma "Pending Status" card
function PendingRequestCard({ request }) {
  const labor = request.quote?.labor ?? 0;
  const parts = request.quote?.parts ?? 0;
  return (
    <article className={`${CARD_BASE} pb-[17px] pt-[10px]`}>
      <span
        className="absolute right-[29px] top-[14px] box-border flex h-[20px] w-[103px] items-center justify-center rounded-full border border-[#B1A8A8] bg-[#BBAE57] font-[Quicksand] text-[10px] font-medium leading-[17px] text-white"
      >
        Quoted
      </span>

      <div className="px-[17px]">
        <p className="m-0 text-[13px] font-bold leading-[22px] text-[#292727]">Request #{request.id}</p>
        <p className="m-0 text-[10px] font-normal leading-[17px] text-[#5B5959]">
          {request.customerName} | {formatShortDate(request.createdAt)}
        </p>
      </div>

      {request.aiDiagnosis && (
        <div className="mx-[13px] mt-[10px]">
          <AiBar request={request} compact />
        </div>
      )}

      {request.distanceKm != null && (
        <div className="mt-[9px] px-[17px]">
          <DistanceRow km={request.distanceKm} textClass="text-[9px] leading-[15px]" />
        </div>
      )}

      <hr className="mx-[13px] mb-0 mt-[14px] border-0 border-t border-black/40" />

      <p className="m-0 mt-[5px] px-[19px] text-[9px] leading-[15px] text-[#5B5959]">
        <span className="font-bold">Quote sent:</span> {formatPesos(labor)} pesos (Labor), {formatPesos(parts)} pesos
        (Parts)
      </p>
      <p className="m-0 px-[29px] text-right text-[10px] font-bold leading-[17px] text-[#5B5959]">
        TOTAL: {formatPesos(labor + parts)}
      </p>

      <div className="mt-[18px] flex justify-end px-[34px]">
        <Link
          // TODO: link to the conversation with this customer, e.g. /serviceprovider/messages/:customerId
          to="/serviceprovider/messages"
          state={{ requestId: request.id }}
          className="box-border flex h-[40px] w-full max-w-[350px] items-center justify-center rounded-[10px] border border-[#B1A8A8] bg-[#FFFDFD] text-[10px] font-bold leading-[17px] text-[#414141] no-underline"
        >
          Message Customer
        </Link>
      </div>
    </article>
  );
}

// status: closed — Figma "Closed" card (declined by the provider, or the quotation was declined by the customer)
function ClosedRequestCard({ request }) {
  const byCustomer = request.closedBy === 'customer';
  const note = byCustomer
    ? 'The customer declined your quotation.'
    : `You declined this request${request.declinedReason ? `: ${request.declinedReason}` : '.'}`;

  return (
    <article className={`${CARD_BASE} pb-[14px] pt-[13px]`}>
      <span className="absolute right-4 top-[15px] box-border flex h-[20px] w-[85px] items-center justify-center rounded-full border border-[#B1A8A8] bg-[#DA5555] font-[Quicksand] text-[10px] font-medium leading-[17px] text-white">
        Declined
      </span>

      <div className="px-[22px]">
        <p className="m-0 text-[16px] font-bold leading-[27px] text-[#292727]">Request #{request.id}</p>
        <p className="m-0 mt-[3px] text-[14px] font-bold leading-[17px] text-[#484040]">{request.customerName}</p>
      </div>

      <hr className="mx-[23px] mb-0 mt-[16px] border-0 border-t border-black/40" />

      <div className="px-[22px]">
        {request.aiDiagnosis ? (
          <>
            <p className="m-0 mt-[10px] text-[13px] font-normal leading-[16px] text-[#484040]">Probable Cause</p>
            <p className="m-0 mt-[10px] text-[16px] font-bold capitalize leading-[19px] text-[#484040]">
              {request.aiDiagnosis}
            </p>
            {request.aiConfidence != null && (
              <p className="m-0 mt-[7px] text-[14px] font-[510] leading-[17px] text-[#484040]">
                {request.aiConfidence}% AI Confidence based on similar reported cases
              </p>
            )}
          </>
        ) : (
          <p className="m-0 mt-[10px] text-[13px] font-normal leading-[16px] text-[#484040]">
            No AI diagnosis was available for this request.
          </p>
        )}
      </div>

      <hr className="mx-[23px] mb-0 mt-[19px] border-0 border-t border-black/40" />
      <p className="m-0 mt-[10px] px-[22px] text-[12px] leading-[18px] text-[#5B5959]">{note}</p>
    </article>
  );
}

export default function IncomingServiceRequest() {
  const { user, loading } = useAuth();

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [statusFilter, setStatusFilter] = useState('new');

  const [requests, setRequests] = useState([]);
  const [backendCategories, setBackendCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [quoteTarget, setQuoteTarget] = useState(null); // request being quoted from the list
  const [isSaving, setIsSaving] = useState(false);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const noticeTimer = useRef(null);

  const load = useCallback(
    () =>
      getProviderServiceRequests()
        .then((data) => {
          setRequests(data.requests || []);
          setLoadError('');
        })
        .catch((err) => setLoadError(err.message || "Couldn't load service requests."))
        .finally(() => setIsLoading(false)),
    []
  );

  // The list refreshes on a timer so new requests appear without reloading the page.
  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    const tick = () => {
      if (!cancelled) load();
    };
    tick();
    const timer = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [user, load]);

  // Category choices come from the backend (GET /api/categories).
  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    getServiceCategories()
      .then((data) => {
        if (!cancelled) setBackendCategories((data?.categories || []).map((c) => c.label));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => () => clearTimeout(noticeTimer.current), []);

  const categoryOptions = useMemo(() => {
    // Backend list first; any category that only exists on a loaded request is added too.
    const labels = [...backendCategories];
    requests.forEach((r) => {
      if (r.category && !labels.some((l) => sameText(l, r.category))) labels.push(r.category);
    });
    return [{ value: 'all', label: 'All' }, ...labels.map((label) => ({ value: label, label }))];
  }, [backendCategories, requests]);

  const visibleRequests = useMemo(() => {
    const matchStatus = STATUS_OPTIONS.find((o) => o.value === statusFilter)?.match || (() => true);
    const q = search.trim().toLowerCase();
    return requests.filter((r) => {
      if (!matchStatus(r)) return false;
      if (category !== 'all' && !sameText(r.category, category)) return false;
      if (!q) return true;
      return [r.id, r.customerName, r.aiDiagnosis, r.category]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
  }, [requests, statusFilter, category, search]);

  // Accept from the list = send the pre-repair quotation (same popup as the details screen).
  const handleSendQuote = async ({ laborPrice, itemPrice, notes }) => {
    if (!quoteTarget) return;
    setIsSaving(true);
    setActionError('');
    try {
      await sendQuote(quoteTarget.id, { laborPrice, itemPrice, notes });
      setNotice(`Quotation sent for Request #${quoteTarget.id}.`);
      clearTimeout(noticeTimer.current);
      noticeTimer.current = setTimeout(() => setNotice(''), 6000);
      setQuoteTarget(null);
      await load();
    } catch (err) {
      setActionError(err.message || "Couldn't send the quotation. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <ServiceProviderSidebar>
      {/* Same page spacing as FindServiceProvider: px-4 / sm:px-[42px], py-6, full-width content */}
      <div className="box-border px-4 py-6 sm:px-[42px]">
        <h1 className="m-0 flex min-h-[68px] items-center font-[Quicksand] text-[32px] font-bold leading-[32px] text-[#005FCA] sm:text-[40px] lg:text-[48px]">
          Incoming Service Requests
        </h1>

        {/* Search + Categories + Status (Figma: 699px search, two 173px dropdowns) */}
        <div className="relative z-30 mt-[17px] flex flex-col gap-[10px] sm:flex-row sm:items-start sm:gap-[15px]">
          <div className="min-w-0 flex-1 [&>*]:!w-full [&>*]:!max-w-full">
            <SearchField value={search} onChange={setSearch} placeholder="Search request" />
          </div>
          <div className="flex flex-wrap gap-2 sm:flex-nowrap">
            <FilterDropdown
              ariaLabel="Filter by category"
              options={categoryOptions}
              value={category}
              onChange={setCategory}
              placeholder="Categories"
            />
            <FilterDropdown
              ariaLabel="Filter by status"
              options={STATUS_OPTIONS}
              value={statusFilter}
              onChange={setStatusFilter}
              placeholder="Status"
              emptyValue="__none__"
            />
          </div>
        </div>

        {notice && (
          <p role="status" className="m-0 mt-4 font-[Roboto] text-[14px] font-medium text-[#167713]">
            {notice}
          </p>
        )}

        {/* Request cards */}
        <div className="relative z-0 mt-[29px] flex flex-col gap-3">
          {loadError && (
            <p role="alert" className="m-0 font-[Roboto] text-[14px] font-medium text-[#B91C1C]">
              {loadError}
            </p>
          )}
          {visibleRequests.length === 0 ? (
            <p className="m-0 font-[Roboto] text-[14px] font-medium text-[#817C7C]">
              {isLoading ? 'Loading service requests…' : 'No service requests found'}
            </p>
          ) : (
            visibleRequests.map((request) => {
              if (request.status === 'quoted') return <PendingRequestCard key={request.id} request={request} />;
              if (request.status === 'closed') return <ClosedRequestCard key={request.id} request={request} />;
              return <NewRequestCard key={request.id} request={request} onAccept={setQuoteTarget} />;
            })
          )}
        </div>
      </div>

      {quoteTarget && (
        <QuotationModal
          onClose={() => {
            if (isSaving) return;
            setQuoteTarget(null);
            setActionError('');
          }}
          onSubmit={handleSendQuote}
          isSaving={isSaving}
          error={actionError}
        />
      )}
    </ServiceProviderSidebar>
  );
}