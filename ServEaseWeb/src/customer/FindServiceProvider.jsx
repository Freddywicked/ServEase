import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CustomerSidebar from '../components/CustomerSidebar.jsx';
import { browseServiceProviders } from '../api/client';

// Two dropdowns sit next to the search bar (Figma): a status filter and a category filter.
// Each option maps to the query params of GET /api/service-providers. These lists only describe
// the FILTERS — every provider shown on the screen (name, location, rating, badges) comes
// from the backend.
const STATUS_OPTIONS = [
  { value: 'available', label: 'Available', query: { available: true } },
  { value: 'unavailable', label: 'Unavailable', query: { available: false } },
  // The list arrives sorted by rating; it is also sorted again below so "Top-rated" is reliable.
  { value: 'top-rated', label: 'Top-rated', query: {} },
];

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'All', query: {} },
  { value: 'it', label: 'IT-Related Devices', query: { category: 'IT-related Device Repair' } },
  { value: 'phone', label: 'Phone Devices', query: { category: 'Phone Repair' } },
  { value: 'automotive', label: 'Automotive', query: { category: 'Automotive Services' } },
  { value: 'home', label: 'Home', query: { category: 'Home Repair Services' } },
];

// The provider's location comes from the provider's own account (stored by the backend).
// The API may send it ready-made (locationName / address / location) or as separate parts
// (street, barangay, city, ...). Whatever arrives is shown; nothing is invented here.
const clean = (v) => (typeof v === 'string' ? v.trim() : '');
const resolveLocation = (p = {}) => {
  const direct = [
    p.locationName,
    p.location_name,
    p.address,
    p.companyAddress,
    p.company_address,
    typeof p.location === 'string' ? p.location : '',
  ]
    .map(clean)
    .find(Boolean);
  if (direct) return direct;
  const src = p.location && typeof p.location === 'object' ? p.location : p;
  return [src.street, src.barangay, src.city, src.municipality, src.province]
    .map(clean)
    .filter(Boolean)
    .join(', ');
};

function SearchIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#393939"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
      className="pointer-events-none absolute left-[22px] top-1/2 -translate-y-1/2"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-none">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#292727" strokeWidth="1.5" aria-hidden="true" className="opacity-[0.88]">
      <path d="M12 22s-7-6.4-7-12a7 7 0 0 1 14 0c0 5.6-7 12-7 12Z" />
      <circle cx="12" cy="10" r="2.6" />
    </svg>
  );
}

function CheckBadgeIcon({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <circle cx="12" cy="12" r="12" fill="#0255AF" />
      <path d="M6.8 12.6l3.5 3.5 6.9-7.4" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Dropdown that opens a list right under its button (Figma: "Available" / "Automotive" filters).
function FilterDropdown({ label, options, value, onChange, className = '' }) {
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

  const selected = options.find((o) => o.value === value) || options[0];

  return (
    <div ref={ref} className={`relative h-[49px] w-full flex-none sm:w-[173px] ${open ? 'z-30' : 'z-10'} ${className}`}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="relative z-10 box-border flex h-[49px] w-full cursor-pointer items-center justify-between rounded-[14px] border border-[#7E7A7A] bg-white pl-5 pr-[5px] text-left font-[Inter] text-[14px] font-semibold leading-[24px] tracking-[-0.3125px] text-[#484040]"
      >
        <span className="truncate">{selected.label}</span>
        <ChevronIcon />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={label}
          className="absolute left-0 right-0 top-[calc(100%-14px)] z-0 m-0 box-border list-none rounded-b-[14px] border border-[#7E7A7A] bg-white px-0 pb-3 pt-[22px]"
        >
          {options.map((option) => (
            <li key={option.value} role="option" aria-selected={option.value === selected.value}>
              <button
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className="box-border block h-[31px] w-full cursor-pointer border-0 bg-transparent px-5 text-left font-[Inter] text-[14px] font-medium leading-[24px] tracking-[-0.3125px] text-[#484040] hover:bg-[#F6FAFF]"
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

export default function FindServiceProvider() {
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(STATUS_OPTIONS[0].value);
  const [categoryFilter, setCategoryFilter] = useState(CATEGORY_OPTIONS[0].value);

  // Live provider list from the backend. The server does the search + filtering;
  // typing is debounced so every keystroke does not fire a request.
  const [providers, setProviders] = useState([]);
  const [loadState, setLoadState] = useState('loading'); // 'loading' | 'done' | 'error'

  useEffect(() => {
    let cancelled = false;
    setLoadState('loading');
    const statusOption = STATUS_OPTIONS.find((o) => o.value === statusFilter) || STATUS_OPTIONS[0];
    const categoryOption = CATEGORY_OPTIONS.find((o) => o.value === categoryFilter) || CATEGORY_OPTIONS[0];

    const timer = setTimeout(() => {
      browseServiceProviders({
        search: search.trim(),
        ...statusOption.query,
        ...categoryOption.query,
      })
        .then((data) => {
          if (cancelled) return;
          // Map the server shape onto the card fields below.
          let list = (data?.providers ?? []).map((p) => ({
            id: p.id,
            name: p.name,
            address: resolveLocation(p),
            rating: p.rating ?? null, // null = no reviews yet
            verified: Boolean(p.verified),
            available: Boolean(p.available),
          }));
          if (statusFilter === 'unavailable') list = list.filter((p) => !p.available);
          if (statusFilter === 'top-rated') {
            list = [...list].sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0));
          }
          setProviders(list);
          setLoadState('done');
        })
        .catch(() => {
          if (!cancelled) setLoadState('error');
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, statusFilter, categoryFilter]);

  const handleViewProfile = (providerId) => {
    navigate(`/customer/providers/${providerId}`);
  };

  return (
    <CustomerSidebar>
      <div className="box-border px-4 py-6 sm:px-[42px]">
        <h1 className="m-0 flex min-h-[68px] items-center font-[Quicksand] text-[32px] font-bold leading-tight text-[#005FCA] sm:text-[40px] lg:text-[48px] lg:leading-[32px]">
          Service Providers
        </h1>

        {/* Search bar (699px) + the two filter dropdowns (173px each), one row, 49px high */}
        <div className="mt-[17px] flex max-w-[1068px] flex-col gap-[10px] sm:flex-row sm:items-start sm:gap-0">
          <div className="relative h-[49px] min-w-0 flex-1">
            <SearchIcon />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search request"
              aria-label="Search service providers"
              className="box-border h-full w-full rounded-[14px] border border-[#7E7A7A] bg-white pl-[67px] pr-4 font-[Inter] text-[16px] font-medium leading-[24px] tracking-[-0.3125px] text-[#292727] outline-none placeholder:text-[#718096]"
            />
          </div>
          <FilterDropdown
            className="sm:ml-[15px]"
            label="Filter by availability"
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={setStatusFilter}
          />
          <FilterDropdown
            className="sm:ml-2"
            label="Filter by category"
            options={CATEGORY_OPTIONS}
            value={categoryFilter}
            onChange={setCategoryFilter}
          />
        </div>

        <div className="mt-[29px] flex max-w-[1068px] flex-col gap-3">
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
              className="relative box-border h-[98px] w-full min-w-[340px] cursor-pointer rounded-[20px] border border-[#818080] bg-white font-[SF_Pro,system-ui,sans-serif] text-[#484040]"
            >
              <div className="absolute right-[14px] top-[9px] flex gap-[4px]">
                {provider.verified && (
                  <span className="flex h-[21px] w-[74px] items-center rounded-[10px] bg-[rgba(2,85,175,0.46)] pl-[9px] text-[11px] leading-[13px] text-[#0255AF]">
                    <CheckBadgeIcon />
                    <span className="ml-[3px]">Verified</span>
                  </span>
                )}
                {provider.available && (
                  <span className="flex h-[21px] w-[64px] items-center justify-center rounded-[10px] bg-[#2E7D32] text-[11px] leading-[13px] text-white">
                    Available
                  </span>
                )}
              </div>

              <p className="absolute left-[22px] top-[12px] m-0 max-w-[calc(100%-190px)] truncate text-[20px] font-bold leading-[24px]">
                {provider.name}
              </p>

              {/* Location from the provider's account: pin + address, right under the name */}
              {provider.address && (
                <>
                  <div className="absolute left-[19px] top-[39px]">
                    <PinIcon />
                  </div>
                  <p className="absolute left-[41px] top-[38px] m-0 max-w-[calc(100%-70px)] truncate text-[13px] leading-[16px]">
                    {provider.address}
                  </p>
                </>
              )}

              <p className="absolute left-[22px] top-[61px] m-0 text-[11px] leading-[13px]">
                Reviews ({provider.rating ?? 'New'})
              </p>

              <span className="absolute left-[calc(50%-20px)] top-[75px] -translate-x-1/2 text-center text-[9px] leading-[11px] underline">
                View Profile
              </span>
            </div>
          ))}

          {loadState === 'loading' && (
            <p className="m-0 py-10 text-center font-[Roboto] text-[14px] text-[#817C7C]">
              Searching service providers…
            </p>
          )}
          {loadState === 'error' && (
            <p role="alert" className="m-0 py-10 text-center font-[Roboto] text-[14px] text-[#B91C1C]">
              Could not load service providers. Please try again.
            </p>
          )}
          {loadState === 'done' && providers.length === 0 && (
            <p className="m-0 py-10 text-center font-[Roboto] text-[14px] text-[#817C7C]">
              No service providers found.
            </p>
          )}
        </div>
      </div>
    </CustomerSidebar>
  );
}