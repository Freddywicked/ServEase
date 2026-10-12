import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import CustomerSidebar from '../components/CustomerSidebar';
import { getCustomerHistory } from '../api/client';

/* =====================================================================================
   HISTORY (customer) — live data
   Route: /customer/history
   -------------------------------------------------------------------------------------
   GET /api/service-requests/history?type=all|repair|transactions
   -> { items: [{ id, type: 'repair' | 'transaction', title, providerName, date, status, amount? }] }
      - repair:       closed service requests (completed / declined / resolved / ...)
      - transaction:  paid payments (initial fee, additional payment, final payment)
   The backend filters by `type`; the tab buttons only switch the query param.
   ===================================================================================== */

const TABS = [
  { key: 'all', label: 'All', widthClass: 'w-[242px]' },
  { key: 'repair', label: 'Repair', widthClass: 'w-[243px]' },
  { key: 'transactions', label: 'Transactions', widthClass: 'w-[242px]' },
];


// ISO timestamp (or date-only string) -> "Jun 27, 2026"
const formatDate = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatPeso = (n) =>
  `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;



export default function History() {
  // Notifications link here with ?tab=all | repair | transactions.
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const isValidTab = (key) => TABS.some((tab) => tab.key === key);
  const [activeTab, setActiveTab] = useState(isValidTab(tabFromUrl) ? tabFromUrl : 'all');
  useEffect(() => {
    if (isValidTab(tabFromUrl)) setActiveTab(tabFromUrl);
  }, [tabFromUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetched from the backend; the server filters by the active tab (?type=).
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    getCustomerHistory(activeTab)
      .then((data) => {
        if (!cancelled) setItems(data?.items ?? []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load your history.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  const visibleItems = items;

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
                    active ? 'bg-[#021E79] text-[#FFFAFA]' : 'bg-[#FFFDFD] text-[#414141] hover:bg-[#F3F3F3]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {error && (
            <p role="alert" className="m-0 mt-4 font-[Roboto] text-[13px] text-[#B91C1C]">
              {error}
            </p>
          )}

          <div className="mt-[34px] flex max-w-[752px] flex-col gap-4">
            {loading ? (
              <p className="m-0 font-[Roboto] text-[14px] font-medium text-[#817C7C]">
                Loading history…
              </p>
            ) : visibleItems.length === 0 ? (
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