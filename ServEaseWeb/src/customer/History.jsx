import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import CustomerSidebar from '../components/CustomerSidebar';
// import { api } from '../api/client'; // BACKEND: use whichever request helper ../api/client exports

/* =====================================================================================
   HISTORY (customer)
   Route: /customer/history
   -------------------------------------------------------------------------------------
   The Figma only shows the title and the three filter buttons (All, Repair, Transactions),
   so the list under them is a simple placeholder built from the same card style as My
   Requests. Everything is hard-coded (MOCK_HISTORY below).

   BACKEND INTEGRATION (READY)
   Proposed endpoint (rename to match ServEaseBackend):
     GET /api/customer/history?type=all|repair|transactions
     -> [{ id, type: 'repair' | 'transaction', title, providerName, date, status, amount? }]
        (same shape as MOCK_HISTORY)
        - repair:       finished or declined service requests
        - transaction:  payments (initial fee, additional payment, final payment) with amount

   Replace the mock data with:
     const [items, setItems] = useState([]);
     useEffect(() => {
       let cancelled = false;
       api.get('/customer/history', { params: { type: activeTab } })
         .then((res) => { if (!cancelled) setItems(res.data); })
         .catch((err) => console.error('Failed to load history', err));
       return () => { cancelled = true; };
     }, [activeTab]);
   and remove the client-side filter below (the backend filters by `type`).
   ===================================================================================== */

const TABS = [
  { key: 'all', label: 'All', widthClass: 'w-[242px]' },
  { key: 'repair', label: 'Repair', widthClass: 'w-[243px]' },
  { key: 'transactions', label: 'Transactions', widthClass: 'w-[242px]' },
];

// HARD-CODED DATA — replace with the API response.
const MOCK_HISTORY = [
  {
    id: 'SR-0007',
    type: 'repair',
    title: 'Liquid damage to charging circuit',
    providerName: 'Mark Rivera',
    date: '2026-06-20',
    status: 'Completed',
  },
  {
    id: 'TX-0002',
    type: 'transaction',
    title: 'Final payment (Request #SR-0007)',
    providerName: 'Mark Rivera',
    date: '2026-06-20',
    status: 'Paid',
    amount: 680,
  },
  {
    id: 'TX-0001',
    type: 'transaction',
    title: 'Initial fee (Request #SR-0007)',
    providerName: 'Mark Rivera',
    date: '2026-06-14',
    status: 'Paid',
    amount: 170,
  },
];

// "2026-06-27" -> "Jun 27, 2026"
const formatDate = (iso) => {
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!y || !m || !d) return '';
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatPeso = (n) =>
  `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const TAB_FILTERS = {
  all: () => true,
  repair: (item) => item.type === 'repair',
  transactions: (item) => item.type === 'transaction',
};

export default function History() {
  // Notifications link here with ?tab=all | repair | transactions.
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const isValidTab = (key) => TABS.some((tab) => tab.key === key);
  const [activeTab, setActiveTab] = useState(isValidTab(tabFromUrl) ? tabFromUrl : 'all');
  useEffect(() => {
    if (isValidTab(tabFromUrl)) setActiveTab(tabFromUrl);
  }, [tabFromUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // BACKEND: turn into useState([]) and fill it with the API response.
  const [items] = useState(MOCK_HISTORY);

  const visibleItems = useMemo(
    () => items.filter(TAB_FILTERS[activeTab]),
    [items, activeTab]
  );

  return (
    <CustomerSidebar>
      <div className="box-border px-[35px] pb-10 pt-[25px]">
        <h1 className="m-0 flex h-[68px] items-center font-[Quicksand] text-[48px] font-bold leading-[32px] text-[#005FCA]">
          History
        </h1>

        <div className="lg:ml-[134px]">
          <div
            className="mt-[30px] flex flex-wrap gap-3"
            role="group"
            aria-label="History filter"
          >
            {TABS.map((tab) => {
              const active = tab.key === activeTab;
              return (
                <button
                  key={tab.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setActiveTab(tab.key)}
                  className={`box-border h-[32px] ${tab.widthClass} max-w-full cursor-pointer rounded-[20px] border border-[#B1A8A8] text-center font-[Quicksand] text-[13px] font-medium leading-[170%] ${
                    active ? 'bg-[#577FBB] text-[#FFFAFA]' : 'bg-[#FFFDFD] text-[#414141] hover:bg-[#F3F3F3]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="mt-[34px] flex max-w-[752px] flex-col gap-4">
            {visibleItems.length === 0 ? (
              <p className="m-0 font-[Roboto] text-[14px] font-medium text-[#817C7C]">
                No history yet
              </p>
            ) : (
              visibleItems.map((item) => (
                <article
                  key={item.id}
                  className="box-border flex items-start justify-between gap-4 rounded-[10px] border border-[#818080] bg-white px-[19px] py-4"
                >
                  <div className="min-w-0">
                    <p className="m-0 font-[Inter] text-[15px] font-bold leading-[22px] text-[#292727]">
                      {item.title}
                    </p>
                    <p className="m-0 font-[Inter] text-[13px] leading-[19px] text-[#5B5959]">
                      {item.providerName} | {formatDate(item.date)}
                    </p>
                  </div>
                  <div className="flex-none text-right">
                    {item.amount != null && (
                      <p className="m-0 font-[Inter] text-[15px] font-bold leading-[22px] text-[#292727]">
                        {formatPeso(item.amount)}
                      </p>
                    )}
                    <p className="m-0 font-[Inter] text-[12px] leading-[19px] text-[#5B5959]">
                      {item.status}
                    </p>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </div>
    </CustomerSidebar>
  );
}