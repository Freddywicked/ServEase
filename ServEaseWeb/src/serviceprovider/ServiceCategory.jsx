import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronDown } from 'lucide-react';
import { getHomeRepairServices } from '../api/client';
import iconLogo from '../assets/servease_logo.png';

/* =====================================================================================
   BACKEND — home repair services dropdown
   -------------------------------------------------------------------------------------
   When the applicant ticks "Home repair services", a "Services" dropdown appears. Its
   choices come from getHomeRepairServices() in api/client.js:
     GET /api/service-categories/home-repair/services
     -> [{ "id": 1, "name": "Plumbing" }, ...]  (a plain array of strings also works)

   That endpoint is optional: if it is missing or fails, the screen falls back to
   FALLBACK_HOME_REPAIR_SERVICES below. Only the service NAMES are sent to the backend
   when the application is submitted (see VerificationRequirements / client.js).
   ===================================================================================== */
const FALLBACK_HOME_REPAIR_SERVICES = [
  'Plumbing',
  'Carpentry',
  'Electrical',
  'Appliance Repair',
  'General Handyman',
].map((name) => ({ id: name, name }));

// Normalizes the backend response into [{ id, name }].
const normalizeServices = (data) => {
  const list = Array.isArray(data) ? data : data?.services ?? [];
  return list
    .map((item) =>
      typeof item === 'string'
        ? { id: item, name: item }
        : { id: item.id ?? item.name ?? item.label, name: item.name ?? item.label }
    )
    .filter((item) => item.name);
};

// Where the user goes after this step (step 2 of the provider application).
// Register this route with <VerificationRequirements />.
const NEXT_STEP_ROUTE = '/serviceprovider/service-category/verification-requirements';

const CATEGORIES = [
  { key: 'it-related', label: 'IT-Related device repair' },
  { key: 'phone-repair', label: 'Phone repair' },
  { key: 'automotive', label: 'Automotive services' },
  { key: 'home-repair', label: 'Home repair services' },
];

const HOME_SERVICE_OPTIONS = [
  { key: 'yes', label: 'Yes' },
  { key: 'no', label: 'No' },
];

const fieldLabel =
  'm-0 font-["Roboto",sans-serif] text-[15px] font-bold uppercase leading-[18px] tracking-[0.2em] text-[#7C7979]';

const textInput =
  'box-border h-[40px] w-full rounded-md border border-[#A6A6A6] bg-white p-2 font-["Roboto",sans-serif] text-[12px] leading-[14px] text-black outline-none placeholder:text-[#A6A6A6] focus:border-[#0255AF]';

// Square selector used for both the category checkboxes and the Yes/No options.
// Same look as the Figma design: 27px hit area, 19px black outlined square.
function SelectBox({ type = 'checkbox', name, checked, onChange, label, weight = 'font-semibold' }) {
  return (
    <label className="flex h-[27px] cursor-pointer items-center gap-5">
      <span className="relative flex h-[27px] w-[27px] shrink-0 items-center justify-center">
        <input
          type={type}
          name={name}
          checked={checked}
          onChange={onChange}
          className="peer sr-only"
        />
        <span className="h-[19px] w-[19px] rounded-[3px] border-2 border-black bg-transparent peer-checked:bg-black peer-focus-visible:ring-2 peer-focus-visible:ring-[#0255AF] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[#E2E5E8]" />
        <svg
          viewBox="0 0 12 12"
          className="pointer-events-none absolute hidden h-3 w-3 text-white peer-checked:block"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M2 6.5l2.5 2.5L10 3" />
        </svg>
      </span>
      <span
        className={`font-['Roboto',sans-serif] text-[14px] ${weight} uppercase leading-[16px] tracking-[0.2em] text-black`}
      >
        {label}
      </span>
    </label>
  );
}

// "Services" dropdown shown when "Home repair services" is ticked. Several services can be picked.
function HomeRepairDropdown({ options, selectedIds, loading, onToggle }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
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
  }, [open]);

  const label = selectedIds.length > 0 ? `${selectedIds.length} selected` : 'Services';

  return (
    <div ref={containerRef} className="relative w-full max-w-[445px]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="box-border flex h-[40px] w-full cursor-pointer items-center gap-[10px] rounded-md border border-[#A6A6A6] bg-white p-2 text-left font-['Roboto',sans-serif] text-[12px] leading-[14px] outline-none focus-visible:border-[#0255AF]"
      >
        <span className={`flex-1 truncate ${selectedIds.length > 0 ? 'text-black' : 'text-[#A6A6A6]'}`}>
          {label}
        </span>
        <ChevronDown
          size={15}
          color="#7C7979"
          className={`flex-none transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-multiselectable="true"
          aria-label="Home repair services"
          className="absolute left-0 top-full z-20 m-0 box-border max-h-[220px] w-full list-none overflow-y-auto rounded-b-[15px] border border-t-0 border-[#5B5959]/[0.27] bg-[#FFFEFE] px-4 py-[10px] shadow-[0_4px_8px_rgba(0,0,0,0.08)]"
        >
          {loading && options.length === 0 ? (
            <li className="py-[5px] font-['Roboto',sans-serif] text-[12px] leading-[14px] text-[#7C7979]">
              Loading services...
            </li>
          ) : (
            options.map((option) => {
              const selected = selectedIds.includes(option.id);
              return (
                <li key={option.id} role="option" aria-selected={selected}>
                  <button
                    type="button"
                    onClick={() => onToggle(option)}
                    className="flex w-full cursor-pointer items-center justify-between border-0 bg-transparent px-0 py-[5px] text-left font-['Roboto',sans-serif] text-[12px] leading-[14px] text-[#1E1E1E] hover:text-[#0255AF]"
                  >
                    {option.name}
                    {selected && <Check size={13} color="#0255AF" />}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}

// Step 1 of 2 of the Service Provider application.
// Reached from RoleSelection after choosing "Service Provider".
export default function ServiceCategory() {
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [companyName, setCompanyName] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [yearsOfExperience, setYearsOfExperience] = useState('');
  const [offersHomeService, setOffersHomeService] = useState(null); // 'yes' | 'no' | null
  const [serviceInput, setServiceInput] = useState('');
  const [services, setServices] = useState([]); // services typed in by the applicant
  const [homeRepairOptions, setHomeRepairOptions] = useState([]); // loaded from the backend
  const [homeRepairLoading, setHomeRepairLoading] = useState(false);
  const [homeRepairServices, setHomeRepairServices] = useState([]); // [{ id, name }] picked in the dropdown
  const [error, setError] = useState(null);
  const errorRef = useRef(null);

  // The error sits below the Next button, which can be off-screen; bring it into view.
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [error]);

  const homeRepairChecked = categories.includes('home-repair');

  // Load the dropdown choices from the backend the first time "Home repair services" is ticked.
  useEffect(() => {
    if (!homeRepairChecked || homeRepairOptions.length > 0) return undefined;
    let cancelled = false;
    setHomeRepairLoading(true);
    getHomeRepairServices()
      .then((data) => {
        const list = normalizeServices(data);
        if (!cancelled) setHomeRepairOptions(list.length > 0 ? list : FALLBACK_HOME_REPAIR_SERVICES);
      })
      .catch((err) => {
        console.warn('Could not load home repair services from the backend, using defaults.', err);
        if (!cancelled) setHomeRepairOptions(FALLBACK_HOME_REPAIR_SERVICES);
      })
      .finally(() => {
        if (!cancelled) setHomeRepairLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [homeRepairChecked, homeRepairOptions.length]);

  const toggleCategory = (key) => {
    setCategories((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
    // Unticking "Home repair services" also clears what was picked in its dropdown.
    if (key === 'home-repair' && homeRepairChecked) setHomeRepairServices([]);
  };

  const toggleHomeRepairService = (option) =>
    setHomeRepairServices((prev) =>
      prev.some((s) => s.id === option.id)
        ? prev.filter((s) => s.id !== option.id)
        : [...prev, option]
    );

  const removeHomeRepairService = (id) =>
    setHomeRepairServices((prev) => prev.filter((s) => s.id !== id));

  const addService = () => {
    const value = serviceInput.trim();
    if (!value) return;
    if (!services.some((s) => s.toLowerCase() === value.toLowerCase())) {
      setServices((prev) => [...prev, value]);
    }
    setServiceInput('');
  };

  const removeService = (value) =>
    setServices((prev) => prev.filter((s) => s !== value));

  const handleNext = () => {
    if (categories.length === 0 && services.length === 0) {
      setError('Please select at least one service category or add a service.');
      return;
    }
    if (!companyName.trim()) {
      setError('Please enter your company or work name (write Freelance if none).');
      return;
    }
    if (!companyAddress.trim()) {
      setError('Please enter your company address.');
      return;
    }
    if (homeRepairChecked && homeRepairServices.length === 0 && services.length === 0) {
      setError('Please choose at least one home repair service.');
      return;
    }
    if (yearsOfExperience === '') {
      setError('Please enter your years of experience.');
      return;
    }
    if (!offersHomeService) {
      setError('Please tell us whether you offer home services.');
      return;
    }
    setError(null);

    // TODO: persist this step (categories, companyName, companyAddress, services, homeRepairServices, yearsOfExperience,
    // offersHomeService) on the backend or in a shared application-form context before moving on.
    // e.g. POST /api/provider/application/service-category
    navigate(NEXT_STEP_ROUTE, {
      state: {
        categories,
        companyName: companyName.trim(),
        companyAddress: companyAddress.trim(),
        services,
        homeRepairServices, // [{ id, name }] chosen in the home repair dropdown
        yearsOfExperience: Number(yearsOfExperience),
        offersHomeService: offersHomeService === 'yes',
      },
    });
  };

  return (
    <div className="flex min-h-screen flex-col items-center bg-[#EBEBEB] px-4 pb-[66px] pt-[50px]">
      {/* Header */}
      <img
        src={iconLogo}
        alt="ServEase"
        className="block h-[220px] w-[220px] max-w-full object-contain"
      />

      <h1 className="m-0 -mt-2 text-center font-['Plus_Jakarta_Sans',sans-serif] text-[30px] font-bold leading-[38px] text-[#021E79]">
        Apply as Service Provider
      </h1>

      {/* Progress: step 1 of 2 */}
      <div
        className="mt-[26px] flex w-[601px] max-w-full gap-[14px]"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={2}
        aria-valuenow={1}
        aria-label="Application progress, step 1 of 2"
      >
        <div className="h-[7px] flex-1 rounded-[10px] bg-[#021E79]" />
        <div className="h-[7px] flex-1 rounded-[10px] bg-[#D9D9D9]" />
      </div>

      {/* Card */}
      <div className="mt-[47px] box-border min-h-[454px] w-[1064px] max-w-full rounded-[30px] bg-[#E2E5E8] px-6 pb-10 pt-[37px] lg:px-[30px]">
        <h2 className="m-0 font-['Plus_Jakarta_Sans',sans-serif] text-[24px] font-extrabold leading-[30px] text-[#021E79]">
          Service Category
        </h2>

        <div className="mt-[33px] grid grid-cols-1 gap-10 lg:grid-cols-[531px_1fr] lg:gap-0">
          {/* Left column */}
          <div>
            <div className="flex flex-col gap-[10.5px] lg:ml-[44px]">
              {CATEGORIES.map((category) => (
                <SelectBox
                  key={category.key}
                  label={category.label}
                  checked={categories.includes(category.key)}
                  onChange={() => toggleCategory(category.key)}
                />
              ))}
            </div>

            <div className="mt-7 flex flex-col gap-5 lg:ml-[23px]">
              <div>
                <label htmlFor="company-name" className={`${fieldLabel} block`}>
                  Company name
                </label>
                <div className="mt-3 w-full max-w-[445px]">
                  <input
                    id="company-name"
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Company/Work Name (write Freelance if none)"
                    autoComplete="organization"
                    className={textInput}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="company-address" className={`${fieldLabel} block`}>
                  Company address
                </label>
                <div className="mt-3 w-full max-w-[445px]">
                  <input
                    id="company-address"
                    type="text"
                    value={companyAddress}
                    onChange={(e) => setCompanyAddress(e.target.value)}
                    placeholder="Work Address"
                    autoComplete="street-address"
                    className={textInput}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="lg:pr-[23px]">
            <div className="lg:ml-[5px] lg:mt-[2px]">
              <p className={fieldLabel}>What services do you provide?</p>

              {homeRepairChecked && (
                <div className="mt-5">
                  <HomeRepairDropdown
                    options={homeRepairOptions}
                    selectedIds={homeRepairServices.map((s) => s.id)}
                    loading={homeRepairLoading}
                    onToggle={toggleHomeRepairService}
                  />
                </div>
              )}

              <div className={`${homeRepairChecked ? 'mt-[11px]' : 'mt-5'} flex items-start gap-[5px]`}>
                <div className="w-full max-w-[323px]">
                  <input
                    type="text"
                    value={serviceInput}
                    onChange={(e) => setServiceInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addService();
                      }
                    }}
                    placeholder={homeRepairChecked ? 'Other Services' : 'Services'}
                    aria-label={homeRepairChecked ? 'Other services' : 'Services'}
                    className={textInput}
                  />
                </div>
                <button
                  type="button"
                  onClick={addService}
                  className="box-border flex h-[39px] w-[117px] shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-[#30373F] font-['Quicksand',sans-serif] text-[14px] font-bold leading-[23px] text-white shadow-[0_4px_4px_rgba(0,0,0,0.25)]"
                >
                  Add more
                </button>
              </div>

              {(homeRepairServices.length > 0 || services.length > 0) && (
                <ul className="m-0 mt-3 flex list-none flex-wrap gap-2 p-0">
                  {homeRepairServices.map((service) => (
                    <li
                      key={`home-${service.id}`}
                      className="flex items-center gap-2 rounded-md bg-white px-3 py-1 font-['Roboto',sans-serif] text-[12px] text-black"
                    >
                      {service.name}
                      <button
                        type="button"
                        onClick={() => removeHomeRepairService(service.id)}
                        aria-label={`Remove ${service.name}`}
                        className="cursor-pointer border-0 bg-transparent p-0 text-[14px] leading-none text-[#7C7979]"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                  {services.map((service) => (
                    <li
                      key={service}
                      className="flex items-center gap-2 rounded-md bg-white px-3 py-1 font-['Roboto',sans-serif] text-[12px] text-black"
                    >
                      {service}
                      <button
                        type="button"
                        onClick={() => removeService(service)}
                        aria-label={`Remove ${service}`}
                        className="cursor-pointer border-0 bg-transparent p-0 text-[14px] leading-none text-[#7C7979]"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <p className={`${fieldLabel} mt-7 lg:ml-[5px]`}>Years of experience</p>
            <div className="mt-6 lg:ml-[5px]">
              <input
                type="text"
                inputMode="numeric"
                value={yearsOfExperience}
                onChange={(e) =>
                  setYearsOfExperience(e.target.value.replace(/\D/g, '').slice(0, 2))
                }
                placeholder="0"
                aria-label="Years of experience"
                className={textInput}
              />
            </div>

            <p className={`${fieldLabel} mt-[46px] lg:ml-[5px]`}>
              Do you offer home services?
            </p>
            <div className="mt-[18px] flex flex-col gap-2 lg:ml-[26px]">
              {HOME_SERVICE_OPTIONS.map((option) => (
                <SelectBox
                  key={option.key}
                  type="radio"
                  name="home-services"
                  weight="font-bold"
                  label={option.label}
                  checked={offersHomeService === option.key}
                  onChange={() => setOffersHomeService(option.key)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Next */}
      <button
        type="button"
        onClick={handleNext}
        className="mt-11 box-border flex h-[39px] w-[325px] max-w-full cursor-pointer items-center justify-center rounded-lg border border-black/30 bg-gradient-to-r from-[#0255AF] to-[#04A5A5] font-['Quicksand',sans-serif] text-[16px] font-bold leading-[23px] text-white"
      >
        NEXT
      </button>

      {error && (
        <p ref={errorRef} role="alert" className="m-0 mt-4 text-center font-['Roboto',sans-serif] text-[13px] text-[#B91C1C]">
          {error}
        </p>
      )}
    </div>
  );
}