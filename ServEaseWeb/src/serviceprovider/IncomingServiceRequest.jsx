import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import ServiceProviderSidebar from '../components/ServiceProviderSidebar.jsx';
import { useAuth } from '../context/auth_context';
import { getProviderServiceRequests } from '../api/client';
import lightningIcon from '../assets/icon_lightning.png';
import pinIcon from '../assets/icon_pinloc.png';

const SF_PRO = "font-[SF_Pro,system-ui,sans-serif]";

// The list comes from the backend: GET /api/providers/requests -> { requests: [...] }.
// A request shows up here as soon as a customer submits it to this provider
// (RecommendServiceProvider.jsx -> POST /api/service-requests/:id/submit).
//
// Shape of one request:
// {
//   id: 'SR-0000',                  // request number shown as "Request #SR-0000"
//   customerName: 'Dominic Alcantara',
//   createdAt: '2026-06-27',        // ISO date, shown as "Jun 27"
//   aiDiagnosis: 'capacitor failure' | null,   // null when the customer skipped the AI step
//   aiConfidence: 82 | null,        // percent
//   distanceKm: 1.2 | null,         // null until the backend can compute it
//   status: 'new' | 'quoted',       // 'new' = no quote sent yet, 'quoted' = Pending Quotation
//   quote: { labor: 800, parts: 2000 } | null, // only present when status === 'quoted'
// }

// New requests appear without a page refresh: the list is re-fetched this often.
const POLL_INTERVAL_MS = 15000;

const TABS = [
  { key: 'all', widthClass: 'w-[87px]' },
  { key: 'new', widthClass: 'w-[96px]' },
  { key: 'pending', widthClass: 'w-[135px]' },
];

// Which request statuses belong to each tab.
const TAB_FILTERS = {
  all: () => true,
  new: (r) => r.status === 'new',
  pending: (r) => r.status === 'quoted',
};

// "2026-06-27" -> "Jun 27"
const formatShortDate = (iso) => {
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!y || !m || !d) return '';
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatPesos = (n) => Number(n || 0).toLocaleString('en-US');

function RequestCard({ request }) {
  const isQuoted = request.status === 'quoted';
  const labor = request.quote?.labor ?? 0;
  const parts = request.quote?.parts ?? 0;

  return (
    <div
      className={`relative box-border w-full max-w-[1064px] rounded-[10px] border border-[#818080] bg-white pb-3 pl-[15px] pr-4 pt-3 sm:pr-10 ${SF_PRO}`}
    >
      {isQuoted && (
        <span className="absolute right-4 top-3 flex h-5 w-[98px] items-center justify-center rounded-full bg-[#B8AD5B] text-[10px] font-medium leading-none text-white sm:right-10">
          Quoted
        </span>
      )}

      <p className="m-0 text-[13px] font-bold leading-[22px] text-[#292727]">
        Request #{request.id}
      </p>
      <p className="m-0 text-[11px] font-normal leading-[19px] text-[#5B5959]">
        {request.customerName} | {formatShortDate(request.createdAt)}
      </p>

      {/* AI diagnosis bar (hidden when the customer skipped the AI step) */}
      {request.aiDiagnosis && (
        <div className="mt-[9px] box-border flex h-[41px] w-full items-center rounded-[10px] bg-[#262728] pl-[15px]">
          <img src={lightningIcon} alt="" className="h-[18px] w-[14px] flex-none object-contain" />
          <span className="ml-[13px] text-[11px] font-normal leading-[19px] text-white">
            AI suggests {request.aiDiagnosis} ({request.aiConfidence}% confidence)
          </span>
        </div>
      )}

      {/* Distance (hidden until the backend can compute it) */}
      {request.distanceKm != null && (
        <div className="mt-[13px] flex items-center gap-[7px]">
          <img src={pinIcon} alt="" className="h-[18px] w-[14px] flex-none object-contain" />
          <span className="text-[10px] font-normal leading-[17px] text-[#5B5959]">
            {request.distanceKm} km away
          </span>
        </div>
      )}

      <hr className="m-0 ml-[6px] mt-[15px] border-0 border-t border-black/40" />

      {isQuoted ? (
        <>
          <p className="m-0 ml-[6px] mt-[10px] text-[10px] leading-[17px] text-[#292727]">
            <span className="font-bold">Quote sent:</span> {formatPesos(labor)} pesos (Labor),{' '}
            {formatPesos(parts)} pesos (Parts)
          </p>
          <p className="m-0 text-right text-[10px] font-bold leading-[17px] text-[#292727]">
            TOTAL: {formatPesos(labor + parts)}
          </p>
          <Link
            // TODO: link to the conversation with this customer, e.g. /serviceprovider/messages/:customerId
            to="/serviceprovider/messages"
            className="mx-auto mt-2 box-border flex h-[34px] w-full max-w-[400px] items-center justify-center rounded-[10px] border border-[#B1A8A8] bg-[#FFFDFD] text-[10px] font-bold text-[#292727] no-underline"
          >
            Message Customer
          </Link>
        </>
      ) : (
        <div className="mt-[13px] flex justify-end">
          <Link
            to={`/serviceprovider/requests/${request.id}`}
            className="box-border flex h-[39px] w-[104px] items-center justify-center rounded-[10px] border border-[#B1A8A8] bg-[#577FBB] text-[12px] font-bold leading-[20px] text-white no-underline"
          >
            View
          </Link>
        </div>
      )}
    </div>
  );
}

export default function IncomingServiceRequest() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('new');

  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;

    const load = () =>
      getProviderServiceRequests()
        .then((data) => {
          if (cancelled) return;
          setRequests(data.requests || []);
          setLoadError('');
        })
        .catch((err) => {
          if (!cancelled) setLoadError(err.message || "Couldn't load service requests.");
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });

    load();
    const timer = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [user]);

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  const newCount = requests.filter(TAB_FILTERS.new).length;
  const labels = {
    all: `All (${requests.length})`,
    new: `New (${newCount})`,
    pending: 'Pending Quotation',
  };
  const visibleRequests = requests.filter(TAB_FILTERS[activeTab]);

  return (
    <ServiceProviderSidebar>
      {/* Content starts 54px from the sidebar edge and 25px below the header in the Figma frame */}
      <div className="box-border px-4 pb-10 pt-[25px] sm:px-[54px]">
        <h1 className="m-0 flex h-[68px] items-center font-[Quicksand] text-[32px] font-bold leading-[32px] text-[#005FCA] sm:text-[40px] lg:text-[48px]">
          Incoming Service Requests
        </h1>

        {/* Filter tabs */}
        <div className="mt-[27px] flex flex-wrap gap-3">
          {TABS.map((tab) => {
            const isActive = tab.key === activeTab;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`box-border h-[36px] ${tab.widthClass} cursor-pointer rounded-[20px] border border-[#B1A8A8] text-center font-[Quicksand] text-[10px] font-medium leading-[170%] ${
                  isActive ? 'bg-[#021E79] text-white' : 'bg-white text-[#414141]'
                }`}
              >
                {labels[tab.key]}
              </button>
            );
          })}
        </div>

        {/* Request cards */}
        <div className="mt-[23px] flex flex-col gap-4">
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
            visibleRequests.map((request) => <RequestCard key={request.id} request={request} />)
          )}
        </div>
      </div>
    </ServiceProviderSidebar>
  );
}