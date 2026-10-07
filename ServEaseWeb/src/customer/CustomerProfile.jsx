import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import CustomerSidebar from '../components/CustomerSidebar.jsx';
import { me } from '../api/client';
import { useAuth } from '../context/auth_context';
import avatarCircle from '../assets/icon_bigellipse.png';
import gearIconWhite from '../assets/icon_gear_white.png';

// Returns the first non-empty value found under any of the given keys of `source`.
// The account fields below are read from the logged-in user (useAuth / GET /api/me).
// If your backend names them differently, only the key lists in this file need to change.
const pickFirst = (source, keys) => {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') return String(value);
  }
  return '';
};

const MOBILE_KEYS = [
  'phone',
  'phone_number',
  'phoneNumber',
  'mobile_number',
  'mobileNumber',
  'mobile',
  'mobile_no',
  'contact_number',
  'contactNumber',
  'contact_no',
  'contact',
];
const ADDRESS_KEYS = ['address', 'address_details', 'addressDetails', 'location'];

function EditButton({ onClick, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`box-border h-[39px] w-[109px] cursor-pointer rounded-[10px] border border-[#3F4143] bg-white p-0 font-[SF_Pro,system-ui,sans-serif] text-[16px] font-bold leading-[27px] text-black ${className}`}
    >
      Edit
    </button>
  );
}

// Blue banner + white strip with the avatar, name and Edit button.
function ProfileBanner({ name, onEdit }) {
  const letter = (name || '').trim()[0]?.toUpperCase() || '';
  return (
    <div className="relative">
      <div className="box-border h-[142px] rounded-b-[1px] rounded-t-[10px] border border-b-0 border-black/[0.14] bg-[#7DABDD]" />
      <div className="relative box-border h-[82px] rounded-b-[10px] border border-t-0 border-black/40 bg-[#FDFFFF]">
        <p className="absolute left-[189px] top-[18px] m-0 max-w-[calc(100%-420px)] truncate font-[Quicksand] text-[24px] font-bold leading-[30px] text-[#292727]">
          {name}
        </p>
        <EditButton onClick={onEdit} className="absolute right-[34px] top-[21px]" />
      </div>

      <div className="absolute left-[27px] top-[82px] flex h-[121px] w-[121px] items-center justify-center">
        <img src={avatarCircle} alt="" className="absolute inset-0 h-full w-full" />
        <span className="relative font-[Inter] text-[64px] font-bold leading-[77px] text-white">{letter}</span>
      </div>
    </div>
  );
}

function Field({ label, value, left }) {
  return (
    <div className="absolute font-[SF_Pro,system-ui,sans-serif] text-[16px] leading-[27px]" style={{ left, top: 69 }}>
      <p className="m-0 text-[#484040]">{label}</p>
      <p className="m-0 -mt-[3px] max-w-[240px] truncate font-bold text-black">{value || '—'}</p>
    </div>
  );
}

export default function CustomerProfile() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // undefined = still loading, null = this account has no service provider application.
  const [provider, setProvider] = useState(undefined);
  const [account, setAccount] = useState(null); // user fields returned by GET /api/me (may have more than useAuth)

  // Load this account's provider application so "Apply as Service Provider" is only offered to
  // accounts that have not applied yet.
  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    me()
      .then((data) => {
        if (cancelled) return;
        // Dev-only: shows exactly which fields the backend returns, to match the key lists above.
        if (import.meta.env.DEV) console.debug('[profile] GET /api/me ->', data);
        setAccount(data.user || null);
        setProvider(data.provider || null);
      })
      .catch(() => {
        if (!cancelled) setProvider(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Wait while the saved login is being restored, then require a logged-in user.
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  const profile = { ...user, ...(account || {}) };
  const mobile = pickFirst(profile, MOBILE_KEYS);
  const address = pickFirst(profile, ADDRESS_KEYS);

  const handleEditProfile = () => {
    // TODO (backend-ready): open the edit form for the profile (name / photo), then save it, e.g.
    // await api.updateProfile({ name });   // PATCH /api/me
    console.log('Edit profile clicked');
  };

  const handleEditAccount = () => {
    // TODO (backend-ready): open the edit form for the account details, then save it, e.g.
    // await api.updateProfile({ email, phone, address });   // PATCH /api/me
    console.log('Edit account details clicked');
  };

  const handleApply = () => {
    // Route: service provider application (adjust if the route differs, e.g. '/role-selection').
    navigate('/serviceprovider/service-category');
  };

  return (
    <CustomerSidebar>
      <div className="box-border min-w-[820px] px-4 pb-10 pt-6 sm:pl-[31px] sm:pr-[66px]">
        <h1 className="m-0 flex min-h-[68px] items-center pl-1 font-[Quicksand] text-[32px] font-bold leading-tight text-[#005FCA] sm:text-[40px] lg:text-[48px] lg:leading-[32px]">
          Profile
        </h1>

        <div className="mt-[17px]">
          <ProfileBanner name={user.name} onEdit={handleEditProfile} />
        </div>

        <section className="relative mt-[41px] box-border h-[173px] rounded-[10px] border border-black/[0.46] bg-[#FDFFFF]">
          <h2 className="absolute left-[26px] top-[20px] m-0 font-[Quicksand] text-[20px] font-bold leading-[25px] text-[#292727]">
            Account Details
          </h2>
          <Field label="Email Address" value={user.email} left={27} />
          <Field label="Mobile Number" value={mobile} left={292} />
          <Field label="Address Details" value={address} left={516} />
          <EditButton onClick={handleEditAccount} className="absolute bottom-[20px] right-[34px]" />
        </section>

        {provider === null && (
          <div className="mt-[41px] flex justify-end">
            <button
              type="button"
              onClick={handleApply}
              className="box-border flex h-[67px] w-[291px] cursor-pointer items-center gap-[17px] rounded-[10px] border-0 bg-gradient-to-r from-[#0255AF] to-[#04A5A5] pl-[27px] text-left font-[SF_Pro,system-ui,sans-serif] text-[15px] font-bold leading-[18px] text-white"
            >
              <img src={gearIconWhite} alt="" className="h-[26px] w-[26px] flex-none object-contain" />
              Apply as Service Provider
            </button>
          </div>
        )}
      </div>
    </CustomerSidebar>
  );
}