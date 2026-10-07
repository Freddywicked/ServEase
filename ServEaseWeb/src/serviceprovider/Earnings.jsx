import { useMemo } from 'react';
import ServiceProviderSidebar from '../components/ServiceProviderSidebar.jsx';

// ── HARD-CODED CONTENT: START ─────────────────────────────────────────────
// Expected shape of the earnings summary once the backend is wired up (adjust to the real contract):
//   {
//     thisWeekTotal: number,          // pesos earned this week
//     pendingPaymentTotal: number,    // pesos still to be paid out / collected
//   }
const MOCK_SUMMARY = {
  thisWeekTotal: 8150,
  pendingPaymentTotal: 1300,
};

// Expected shape of each recent transaction (adjust to the real contract):
//   {
//     id: string | number,
//     requestNumber: string,          // e.g. 'SR-0000'
//     customerName: string,
//     dateLabel: string,              // formatted from an ISO date, e.g. 'Jun 27'
//     amount: number,                 // pesos
//     status: 'Paid' | 'Pending',
//   }
const MOCK_TRANSACTIONS = [
  { id: 1, requestNumber: 'SR-0000', customerName: 'Nikki Pie', dateLabel: 'Jun 27', amount: 500, status: 'Paid' },
  { id: 2, requestNumber: 'SR-0000', customerName: 'Nikki Pie', dateLabel: 'Jun 25', amount: 650, status: 'Paid' },
  { id: 3, requestNumber: 'SR-0000', customerName: 'Nikki Pie', dateLabel: 'Jun 24', amount: 1300, status: 'Pending' },
];
// ── HARD-CODED CONTENT: END ───────────────────────────────────────────────

const formatPeso = (value) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(value);

export default function Earnings() {
  // TODO (backend-ready): this tab is for the logged-in service provider. Guard the route the
  // same way as the dashboard (useAuth: redirect to /login when there is no provider user),
  // then replace the mock data with the provider's earnings from the database, e.g.
  //
  //   // const [summary, setSummary] = useState({ thisWeekTotal: 0, pendingPaymentTotal: 0 });
  //   // const [transactions, setTransactions] = useState([]);
  //   // const [status, setStatus] = useState('loading'); // 'loading' | 'done' | 'error'
  //   //
  //   // useEffect(() => {
  //   //   let cancelled = false;
  //   //   async function loadEarnings() {
  //   //     try {
  //   //       setStatus('loading');
  //   //       const [summaryResult, transactionsResult] = await Promise.all([
  //   //         api.getProviderEarningsSummary(),              // GET /provider/earnings/summary
  //   //         api.getProviderTransactions({ limit: 10 }),    // GET /provider/earnings/transactions
  //   //       ]);
  //   //       if (!cancelled) {
  //   //         setSummary(summaryResult);
  //   //         setTransactions(transactionsResult);
  //   //         setStatus('done');
  //   //       }
  //   //     } catch (err) {
  //   //       if (!cancelled) setStatus('error');
  //   //     }
  //   //   }
  //   //   loadEarnings();
  //   //   return () => { cancelled = true; };
  //   // }, []);
  //
  // "This week" should be computed server-side (week start/end in the provider's timezone), and
  // "Pending Payment" is the sum of payments the customer has not completed yet. Optionally
  // link each transaction to its job / request details page.
  const summary = MOCK_SUMMARY;
  const transactions = useMemo(() => MOCK_TRANSACTIONS, []);

  const summaryCards = [
    { label: 'This week', value: summary.thisWeekTotal, widthClass: 'w-[242px]' },
    { label: 'Pending Payment', value: summary.pendingPaymentTotal, widthClass: 'w-[241px]' },
  ];

  return (
    <ServiceProviderSidebar>
      <div className="box-border px-4 py-6 sm:px-[54px]">
        <h1 className="m-0 flex min-h-[68px] items-center font-[Quicksand] text-[32px] font-bold leading-tight text-[#005FCA] sm:text-[40px] lg:text-[48px] lg:leading-[32px]">
          Earnings
        </h1>

        <div className="mt-7 flex flex-wrap gap-[34px] font-[SF_Pro,system-ui,sans-serif] text-black">
          {summaryCards.map((card) => (
            <div
              key={card.label}
              className={`relative h-[119px] max-w-full rounded-[10px] bg-[#E7E7E7] ${card.widthClass}`}
            >
              <p className="absolute left-0 right-0 top-[16px] m-0 text-center text-[20px] font-bold leading-[34px]">
                {formatPeso(card.value)}
              </p>
              <p className="absolute left-0 right-0 top-[64px] m-0 text-center text-[11px] leading-[19px]">
                {card.label}
              </p>
            </div>
          ))}
        </div>

        <h2 className="m-0 mt-8 font-[SF_Pro,system-ui,sans-serif] text-[13px] font-bold uppercase leading-[22px] text-[#414141]">
          Recent Transactions
        </h2>

        <div className="mt-[23px] flex max-w-[508px] flex-col gap-[27px] font-[SF_Pro,system-ui,sans-serif]">
          {transactions.map((tx) => (
            <div
              key={tx.id}
              className="relative box-border h-[79px] w-full rounded-[10px] border border-[#818080] bg-white"
            >
              <p className="absolute left-[16px] top-[14px] m-0 text-[13px] font-bold leading-[22px] text-[#292727]">
                Request #{tx.requestNumber}
              </p>
              <p className="absolute left-[16px] top-[36px] m-0 text-[9px] leading-[15px] text-[#5B5959]">
                {tx.customerName} | {tx.dateLabel}
              </p>
              <p className="absolute right-[16px] top-[14px] m-0 text-[13px] font-bold leading-[22px] text-[#292727]">
                {formatPeso(tx.amount)}
              </p>
              <p
                className={`absolute right-[16px] top-[36px] m-0 text-[9px] leading-[15px] ${
                  tx.status === 'Paid' ? 'text-[#62BB57]' : 'text-[#817C7C]'
                }`}
              >
                {tx.status}
              </p>
            </div>
          ))}

          {transactions.length === 0 && (
            <p className="m-0 py-6 text-center font-[Roboto] text-[14px] text-[#817C7C]">No transactions yet.</p>
          )}
        </div>
      </div>
    </ServiceProviderSidebar>
  );
}