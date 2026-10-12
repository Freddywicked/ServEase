import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CustomerSidebar from '../components/CustomerSidebar.jsx';
import { browseServiceProviders } from '../api/client';

// Filter chips shown under the search bar. 'Available' and 'Top rated' are quick filters;
// the rest are service categories. Each chip maps to query params for
// GET /api/service-providers (the server does the searching/filtering/sorting).
const FILTER_CHIPS = ['Available', 'Top rated', 'Automotive', 'IT Devices', 'Phone', 'Home Repair'];

// Chip label -> backend query. Category keywords match specialization names on the
// server; 'Top rated' needs no param (the list arrives sorted by rating, highest first).
const CHIP_TO_QUERY = {
  Available: { available: true },
  'Top rated': {},
  Automotive: { category: 'Automotive Services' },
  'IT Devices': { category: 'IT-related Device Repair' },
  Phone: { category: 'Phone Repair' },
  'Home Repair': { category: 'Home Repair Services' },
};


function PinIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#292727" strokeWidth="1.5" aria-hidden="true" className="opacity-90">
      <path d="M12 22s-7-6.4-7-12a7 7 0 0 1 14 0c0 5.6-7 12-7 12Z" />
      <circle cx="12" cy="10" r="2.6" />
    </svg>
  );
}

function CheckBadgeIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <circle cx="12" cy="12" r="12" fill="#0255AF" />
      <path d="M6.8 12.6l3.5 3.5 6.9-7.4" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function FindServiceProvider() {
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [activeChip, setActiveChip] = useState('Automotive');

  // Live provider list from the backend. The server does the search + chip filtering;
  // typing is debounced so every keystroke does not fire a request.
  const [providers, setProviders] = useState([]);
  const [status, setStatus] = useState('loading'); // 'loading' | 'done' | 'error'

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    const timer = setTimeout(() => {
      browseServiceProviders({
        search: search.trim(),
        ...(CHIP_TO_QUERY[activeChip] || {}),
      })
        .then((data) => {
          if (cancelled) return;
          // Map the server shape onto the card fields below.
          setProviders(
            (data?.providers ?? []).map((p) => ({
              id: p.id,
              name: p.name,
              address: p.locationName || '',
              rating: p.rating ?? 'New',
              category: p.specialty,
              verified: Boolean(p.verified),
              available: Boolean(p.available),
            }))
          );
          setStatus('done');
        })
        .catch(() => {
          if (!cancelled) setStatus('error');
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, activeChip]);

  const handleChipClick = (chip) => {
    // Clicking the active chip again clears the filter.
    setActiveChip((current) => (current === chip ? '' : chip));
  };

  const handleViewProfile = (providerId) => {
    // Route: service provider details screen (adjust if the route name differs).
    // TODO (backend-ready): carry along request context if needed, e.g.
    // navigate(`/customer/providers/${providerId}`, { state: { requestId, diagnosis } });
    navigate(`/customer/providers/${providerId}`);
  };

  return (
    <CustomerSidebar>
      <div className="box-border px-4 py-6 sm:px-9">
        <h1 className="m-0 flex min-h-[68px] items-center font-[Quicksand] text-[32px] font-bold leading-tight text-[#005FCA] sm:text-[40px] lg:text-[48px] lg:leading-[32px]">
          Service Providers
        </h1>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search services or service providers..."
          className="box-border mt-[19px] block h-[54px] w-full max-w-[876px] rounded-[8px] border-0 bg-[#EAEAEA] px-5 font-[Poppins,Quicksand,sans-serif] text-[16px] font-medium text-[#292727] outline-none placeholder:text-black/[0.34] sm:text-[20px]"
        />

        <div className="mt-[37px] flex flex-wrap gap-[5px]">
          {FILTER_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => handleChipClick(chip)}
              className={`box-border h-[32px] w-[103px] cursor-pointer rounded-[20px] border border-[#B1A8A8] p-0 text-center font-[Quicksand] text-[13px] font-medium leading-[22px] ${
                activeChip === chip ? 'bg-[#021E79] text-white' : 'bg-[#FFFDFD] text-[#414141]'
              }`}
            >
              {chip}
            </button>
          ))}
        </div>

        <div className="mt-8 flex max-w-[859px] flex-col gap-4">
          {providers.map((provider) => (
            <div
              key={provider.id}
              role="button"
              tabIndex={0}
              onClick={() => handleViewProfile(provider.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleViewProfile(provider.id);
                }
              }}
              className="relative box-border h-[98px] w-full min-w-[340px] cursor-pointer rounded-[10px] border border-[#818080] bg-white font-[SF_Pro,system-ui,sans-serif] text-[#484040]"
            >
              <div className="absolute right-[15px] top-[9px] flex gap-[5px]">
                {provider.verified && (
                  <span className="flex h-[21px] w-[71px] items-center rounded-[10px] bg-[rgba(2,85,175,0.46)] pl-[3px] text-[10px] leading-[12px] text-[#0255AF]">
                    <CheckBadgeIcon />
                    <span className="ml-[5px]">Verified</span>
                  </span>
                )}
                {provider.available && (
                  <span className="flex h-[21px] w-[63px] items-center justify-center rounded-[10px] bg-[#86FF8A] text-[10px] leading-[12px] text-[#167713]">
                    Available
                  </span>
                )}
              </div>

              <p className="absolute left-[19px] top-[12px] m-0 max-w-[calc(100%-180px)] truncate text-[20px] font-bold leading-[24px]">
                {provider.name}
              </p>

              <div className="absolute left-[19px] top-[39px]">
                <PinIcon />
              </div>
              <p className="absolute left-[42px] top-[41px] m-0 text-[12px] leading-[14px]">
                {provider.address}
              </p>

              <p className="absolute left-[22px] top-[63px] m-0 text-[11px] leading-[13px] underline">
                Reviews ({provider.rating})
              </p>

              <span className="absolute left-[calc(50%-12px)] top-[80px] -translate-x-1/2 text-center text-[9px] leading-[11px] underline">
                View Profile
              </span>
            </div>
          ))}

          {status === 'loading' && (
            <p className="m-0 py-10 text-center font-[Roboto] text-[14px] text-[#817C7C]">
              Searching service providers…
            </p>
          )}
          {status === 'error' && (
            <p role="alert" className="m-0 py-10 text-center font-[Roboto] text-[14px] text-[#B91C1C]">
              Could not load service providers. Please try again.
            </p>
          )}
          {status === 'done' && providers.length === 0 && (
            <p className="m-0 py-10 text-center font-[Roboto] text-[14px] text-[#817C7C]">
              No service providers found.
            </p>
          )}
        </div>
      </div>
    </CustomerSidebar>
  );
}