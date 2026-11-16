import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import CustomerSidebar from '../components/CustomerSidebar.jsx';
import { useAuth } from '../context/auth_context';
import { getCustomerHistory, getTrackingCards } from '../api/client';

// "Mark Frederick Cerillo" -> "MC"
const getInitials = (name = '') => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
};

// "Roof Leakage | #SR-0000"
const rowTitle = (category, requestId) => {
  const ref = requestId ? `#${String(requestId).replace(/^#/, '')}` : '';
  return [category, ref].filter(Boolean).join(' | ');
};

const pick = (obj, keys) => {
  for (const key of keys) {
    if (obj?.[key] != null && obj[key] !== '') return obj[key];
  }
  return '';
};

const peso = (amount) =>
  `\u20B1${Number(amount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// A Track Requests card (GET /service-requests/tracking) -> one dashboard row.
const toRequestRow = (card) => {
  const ref = pick(card, ['requestNumber', 'requestId', 'id']);
  return {
    id: String(ref),
    title: rowTitle(pick(card, ['category', 'serviceCategory', 'jobTitle', 'title']), ref),
    summary:
      pick(card, ['description', 'summary']) ||
      [pick(card, ['providerName']), pick(card, ['statusLabel', 'currentStepLabel'])].filter(Boolean).join(' - '),
  };
};

// A request can come back as several cards (diagnosis, quotation, schedule...): show it once.
const uniqueRows = (cards) => {
  const seen = new Set();
  return (cards || [])
    .map(toRequestRow)
    .filter((row) => row.id && !seen.has(row.id) && seen.add(row.id));
};

// One repair or transaction from GET /service-requests/history -> one dashboard row.
const toHistoryRow = (item, index) => {
  const ref = pick(item, ['requestNumber', 'requestId']);
  const isTransaction = pick(item, ['type', 'kind']) === 'transaction';
  const amount = pick(item, ['amount', 'finalAmount', 'total']);
  const summary = isTransaction
    ? ['Payment', amount !== '' ? peso(amount) : '', pick(item, ['providerName'])].filter(Boolean).join(' - ')
    : pick(item, ['description', 'summary']) ||
      [pick(item, ['providerName']), pick(item, ['statusLabel', 'status'])].filter(Boolean).join(' - ');
  return {
    id: `${pick(item, ['type', 'kind']) || 'item'}-${pick(item, ['id']) || ref}-${index}`,
    title: rowTitle(pick(item, ['category', 'serviceCategory', 'title']) || (isTransaction ? 'Transaction' : ''), ref),
    summary,
  };
};

// White card with a bold title (Figma: Pending Request / Active Repair / History).
function DashboardCard({
  title,
  emptyMessage,
  minHeightClass,
  listMaxHeightClass = 'max-h-[190px]',
  hasItems,
  actionLabel,
  actionTo,
  children,
}) {
  return (
    <section
      className={`box-border flex w-full flex-col rounded-[14px] border border-[#C9C2C2] bg-white px-[21px] pb-[21px] pt-[11px] ${minHeightClass}`}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 font-[SF_Pro,system-ui,sans-serif] text-[20px] font-bold leading-[34px] text-[#414141]">
          {title}
        </h2>
        {actionTo && (
          <Link
            to={actionTo}
            className="font-[SF_Pro,system-ui,sans-serif] text-[13px] font-medium leading-[34px] text-[#0255AF] no-underline hover:underline"
          >
            {actionLabel}
          </Link>
        )}
      </div>

      {hasItems ? (
        <div className={`mt-[16px] flex flex-col gap-[15px] overflow-y-auto ${listMaxHeightClass}`}>{children}</div>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <p className="m-0 text-center font-[Roboto] text-[14px] font-medium leading-[23px] text-[#817C7C]">
            {emptyMessage}
          </p>
        </div>
      )}
    </section>
  );
}

// One request row: bold "Category | #SR-0000" and a one-line summary underneath.
function RequestRow({ title, summary }) {
  return (
    <div className="box-border flex h-[54px] w-full flex-none flex-col overflow-hidden rounded-[14px] border border-[#C9C2C2] bg-white px-[15px] pt-[8px]">
      <p className="m-0 truncate font-[SF_Pro,system-ui,sans-serif] text-[12px] font-bold leading-[20px] text-[#3D3D3D]">
        {title}
      </p>
      <p className="m-0 truncate font-[SF_Pro,system-ui,sans-serif] text-[11px] font-normal leading-[19px] text-[#484040]">
        {summary}
      </p>
    </div>
  );
}

export default function CustomerDashboard() {
  const { user, loading } = useAuth();

  // [{ id, title, summary }] for each list below, all loaded from the backend.
  const [pendingRequests, setPendingRequests] = useState([]);
  const [activeRepairs, setActiveRepairs] = useState([]);
  const [history, setHistory] = useState([]);

  // All three boxes come from the backend:
  //   Pending Request -> requests the customer sent that no provider has accepted yet
  //                      (Track Requests "sent" cards).
  //   Active Repair   -> repairs that are on-going: the provider's quotation was approved by the customer
  //                      and the initial payment was paid (Track Requests "ongoing" cards).
  //   History         -> every completed repair and every payment transaction
  //                      (GET /service-requests/history?type=all, the same data as the History screen).
  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;

    getTrackingCards()
      .then((data) => {
        if (cancelled) return;
        setPendingRequests(uniqueRows(data?.sent));
        setActiveRepairs(uniqueRows(data?.ongoing));
      })
      .catch((err) => console.error('Failed to load the pending and active requests', err));

    getCustomerHistory('all')
      .then((data) => {
        if (cancelled) return;
        setHistory((data?.items ?? []).map(toHistoryRow));
      })
      .catch((err) => console.error('Failed to load the history', err));

    return () => {
      cancelled = true;
    };
  }, [user]);

  // Wait while the saved login is being restored, then require a logged-in user.
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  const firstName = user.name?.trim().split(/\s+/)[0] || '';
  const initials = getInitials(user.name);

  return (
    <CustomerSidebar initials={initials}>
      <div className="box-border px-4 py-6 sm:px-9">
        <h1 className="m-0 mb-1 font-[Quicksand] text-[32px] font-bold leading-none text-[#021E79] sm:text-[40px] lg:text-[48px]">
          Welcome, {firstName}!
        </h1>
        <p className="m-0 mb-5 font-[Quicksand] text-[18px] font-bold text-black/70 sm:text-[20px]">
          What needs fixing today?
        </p>

        <Link
          to="/customer/requests/new"
          className="box-border flex h-[46px] w-full items-center justify-center rounded-lg border border-black/30 bg-gradient-to-r from-[#0255AF] to-[#04A5A5] font-[Quicksand] text-[16px] font-bold leading-[23px] text-[#D9D9D9] no-underline"
        >
          Create New Request
        </Link>

        {/* Figma: the cards sit slightly inset from the Create New Request button */}
        <div className="mt-8 px-0 md:mt-[65px] md:px-[10px]">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-[52px]">
            <DashboardCard
              title="Pending Request"
              emptyMessage="No Pending Request"
              minHeightClass="min-h-[248px]"
              hasItems={pendingRequests.length > 0}
            >
              {pendingRequests.map((r) => (
                <RequestRow key={r.id} title={r.title} summary={r.summary} />
              ))}
            </DashboardCard>

            <DashboardCard
              title="Active Repair"
              emptyMessage="No Active Repair"
              minHeightClass="min-h-[248px]"
              hasItems={activeRepairs.length > 0}
            >
              {activeRepairs.map((r) => (
                <RequestRow key={r.id} title={r.title} summary={r.summary} />
              ))}
            </DashboardCard>
          </div>

          <div className="mt-6 md:mt-[39px]">
            <DashboardCard
              title="History"
              emptyMessage="No History"
              minHeightClass="min-h-[226px]"
              listMaxHeightClass="max-h-[320px]"
              hasItems={history.length > 0}
              actionLabel="View All"
              actionTo="/customer/history"
            >
              {history.map((r) => (
                <RequestRow key={r.id} title={r.title} summary={r.summary} />
              ))}
            </DashboardCard>
          </div>
        </div>
      </div>
    </CustomerSidebar>
  );
}