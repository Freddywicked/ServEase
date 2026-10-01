import { Navigate, useNavigate } from 'react-router-dom';
import iconLogo from '../assets/servease_logo.png';
import { useAuth } from '../context/auth_context';

// Where each role lands.
const ROLE_DESTINATIONS = {
  customer: '/customer/dashboard',
  'service-provider': '/serviceprovider/service-category',
};

const ROLES = [
  { key: 'customer', label: 'Customer' },
  { key: 'service-provider', label: 'Service Provider' },
];

// Shown right after signup. The backend already creates every new account as a
// customer, so choosing Customer just continues to the dashboard. Choosing
// Service Provider starts the provider application, which is submitted on the
// verification screen.
export default function RoleSelection() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  // Wait while the saved login is being restored, then require a logged-in user.
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#EBEBEB] px-4 pb-[120px]">
      <div className="flex w-[336px] max-w-full flex-col items-center">
        <img
          src={iconLogo}
          alt="ServEase"
          className="block h-[220px] w-[220px] max-w-full object-contain"
        />

        <h1 className="m-0 mt-10 flex h-[52px] items-center justify-center whitespace-nowrap text-center font-[Roboto] text-[32px] font-bold leading-[32px] text-[#021E79]">
          Continue as
        </h1>

        <div className="mt-9 flex w-full flex-col gap-9">
          {ROLES.map((role) => (
            <button
              key={role.key}
              type="button"
              onClick={() => navigate(ROLE_DESTINATIONS[role.key])}
              className="box-border flex h-[46px] w-full cursor-pointer items-center justify-center gap-[10px] rounded-lg border border-black/30 bg-gradient-to-r from-[#0255AF] to-[#04A5A5] px-[93.5px] py-[15.5px] font-[Quicksand] text-[16px] font-bold leading-[23px] text-white"
            >
              {role.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}