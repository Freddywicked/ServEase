import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import CustomerSidebar from '../components/CustomerSidebar.jsx';
import { useAuth } from '../context/auth_context';

const SECTION_LABEL =
  'm-0 mb-3 mt-5 font-[Lato] text-[16px] font-bold uppercase leading-[19px] text-black/50';

// "Mark Frederick Cerillo" -> "MC"
const getInitials = (name = '') => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
};

function EmptyBox({ sizeClass, message, children }) {
  return (
    <div
      className={`box-border flex w-full flex-col rounded-lg border-[0.5px] border-[#1F1D1D]/45 ${sizeClass} ${
        children ? 'justify-start overflow-y-auto p-4' : 'items-center justify-center'
      }`}
    >
      {children || (
        <p className="m-0 text-center font-[Roboto] text-[14px] font-medium leading-[23px] text-[#817C7C]">
          {message}
        </p>
      )}
    </div>
  );
}

export default function CustomerDashboard() {
  const { user, loading } = useAuth();

  // TODO: fill these from the backend once the endpoints exist.
  const [notifications, setNotifications] = useState([]); // [{ id, message }]
  const [activeRepairs, setActiveRepairs] = useState([]); // [{ id, title, status, provider }]

  useEffect(() => {
    // TODO: fetch notifications and active repairs for user.id, then call
    // setNotifications(...) and setActiveRepairs(...)
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

        <h2 className={SECTION_LABEL}>Notifications</h2>
        <EmptyBox sizeClass="min-h-[120px] sm:h-[156px]" message="No Notifications">
          {notifications.length > 0 &&
            notifications.map((n) => (
              <p
                key={n.id}
                className="m-0 border-b border-black/10 py-2 font-[Roboto] text-[14px] text-[#292727] last:border-b-0"
              >
                {n.message}
              </p>
            ))}
        </EmptyBox>

        <h2 className={SECTION_LABEL}>Active Repair</h2>
        <EmptyBox sizeClass="min-h-[180px] sm:h-[273px]" message="No Active Repair">
          {activeRepairs.length > 0 &&
            activeRepairs.map((r) => (
              <div key={r.id} className="border-b border-black/10 py-3 last:border-b-0">
                <p className="m-0 font-[Quicksand] text-[16px] font-bold text-black">{r.title}</p>
                <p className="m-0 font-[Roboto] text-[14px] text-[#817C7C]">
                  {[r.provider, r.status].filter(Boolean).join(' - ')}
                </p>
              </div>
            ))}
        </EmptyBox>
      </div>
    </CustomerSidebar>
  );
}