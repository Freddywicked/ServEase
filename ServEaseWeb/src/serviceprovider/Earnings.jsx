import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import ServiceProviderSidebar from '../components/ServiceProviderSidebar.jsx';
import { useAuth } from '../context/auth_context';
import { getProviderEarnings } from '../api/client';

// Live data: GET /api/provider/earnings -> { summary: { thisWeek, pendingPayment },
// transactions: [{ id, requestNumber, customerName, date, amount }] }.
// "This week" and "Pending Payment" are computed server-side; the transactions list
// contains the payments already received (all 'Paid'), newest first.

const formatPeso = (value) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(value);

const formatDateLabel = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export default function Earnings() {
  const { user, loading: authLoading } = useAuth();

  const [summary, setSummary] = useState({ thisWeekTotal: 0, pendingPaymentTotal: 0 });
  const [transactions, setTransactions] = useState([]);
  const [status, setStatus] = useState('loading'); // 'loading' | 'done' | 'error'

  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    setStatus('loading');
    getProviderEarnings()
      .then((data) => {
        if (cancelled) return;
        setSummary({
          thisWeekTotal: data?.summary?.thisWeek ?? 0,
          pendingPaymentTotal: data?.summary?.pendingPayment ?? 0,
        });
        setTransactions(
          (data?.transactions ?? []).map((t) => ({
            id: t.id,
            requestNumber: t.requestNumber,
            customerName: t.customerName,
            dateLabel: formatDateLabel(t.date),
            amount: t.amount,
            status: 'Paid', // the endpoint only lists payments already received
          }))
        );
        setStatus('done');
      })
      .catch((err) => {
        console.error('Failed to load earnings', err);
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Wait while the saved login is being restored, then require a logged-in provider.
  if (authLoading) return null;
  if (!user) return <Navigate to="/login" replace />;

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

          {status === 'loading' && (
            <p className="m-0 py-6 text-center font-[Roboto] text-[14px] text-[#817C7C]">
              Loading earnings…
            </p>
          )}
          {status === 'error' && (
            <p role="alert" className="m-0 py-6 text-center font-[Roboto] text-[14px] text-[#B91C1C]">
              Could not load your earnings. Please try again.
            </p>
          )}
          {status === 'done' && transactions.length === 0 && (
            <p className="m-0 py-6 text-center font-[Roboto] text-[14px] text-[#817C7C]">No transactions yet.</p>
          )}
        </div>
      </div>
    </ServiceProviderSidebar>
  );
}