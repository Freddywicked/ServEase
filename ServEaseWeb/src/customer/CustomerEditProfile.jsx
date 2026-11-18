import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import CustomerSidebar from '../components/CustomerSidebar.jsx';
import UserAvatar from '../components/UserAvatar.jsx';
import { me, updateProfile } from '../api/client';
import { useAuth } from '../context/auth_context';

// Resolve key variations across backend representations
const pickFirst = (source, keys) => {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') return String(value);
  }
  return '';
};

const ADDRESS_KEYS = ['address', 'address_details', 'addressDetails', 'location'];

const toFields = (source) => ({
  name: source?.name || '',
  email: source?.email || '',
  address: pickFirst(source, ADDRESS_KEYS),
});

const FONT_SF = "font-['SF_Pro',system-ui,sans-serif]";

export default function CustomerEditProfile() {
  const { user, loading, setUser } = useAuth();
  const navigate = useNavigate();
  const nameRef = useRef(null);
  const addressRef = useRef(null);

  // Editable fields
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [address, setAddress] = useState(pickFirst(user, ADDRESS_KEYS));

  // Last values loaded from / saved to the backend (used for Esc-to-revert and change detection)
  const [saved, setSaved] = useState(toFields(user));

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const userKey = user?.user_id ?? user?.id ?? user?.email ?? null;

  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;

    const apply = (source) => {
      const next = toFields(source);
      setName(next.name);
      setEmail(next.email);
      setAddress(next.address);
      setSaved(next);
      setLoadingProfile(false);
    };

    // Fetch fresh details from the backend (/api/auth/me), fall back to the auth context
    me()
      .then((data) => {
        if (!cancelled) apply(data?.user || user);
      })
      .catch((err) => {
        console.error('Failed to load full profile data:', err);
        if (!cancelled) apply(user);
      });

    return () => {
      cancelled = true;
    };
    // Re-run only when the logged-in account changes, so typing is never overwritten
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userKey]);

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  const focusName = () => {
    nameRef.current?.focus();
    nameRef.current?.select();
  };

  const handleNameKeyDown = (e) => {
    if (e.key === 'Escape') {
      setName(saved.name);
      e.currentTarget.blur();
    }
  };

  const handleSave = async (e) => {
    e?.preventDefault();
    if (isSubmitting) return;

    const payload = {
      name: name.trim(),
      email: email.trim(),
      address: address.trim(),
    };

    if (!payload.name) {
      setErrorMsg('Please enter your name.');
      focusName();
      return;
    }
    if (!payload.address) {
      setErrorMsg('Please enter your address.');
      addressRef.current?.focus();
      return;
    }

    const unchanged =
      payload.name === saved.name.trim() &&
      payload.email === saved.email.trim() &&
      payload.address === saved.address.trim();

    if (unchanged) {
      navigate('/customer/profile');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const updatedUser = await updateProfile(payload);

      // Keep the global auth context in sync (header name, avatar, etc.)
      if (setUser) {
        setUser((prev) => ({ ...prev, ...(updatedUser || payload) }));
      }

      navigate('/customer/profile');
    } catch (err) {
      console.error('Error saving profile changes:', err);
      setErrorMsg(
        err?.details?.name ||
          err?.details?.email ||
          err?.details?.address ||
          err?.message ||
          'Failed to update profile. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputBase =
    `box-border h-[41px] w-full rounded-[8px] border border-[#818080] bg-white px-3 ${FONT_SF} ` +
    'text-[15px] font-normal leading-[170%] text-[#6F6F6F] outline-none transition-colors ' +
    'placeholder:text-[#A5A2A2] hover:border-[#5E5C5C] focus:border-[#005FCA] focus:text-[#292727] ' +
    'disabled:cursor-wait disabled:bg-[#F7F7F7]';

  const labelBase = `mb-[1px] block ${FONT_SF} text-[15px] font-normal leading-[26px] text-[#484040]`;

  return (
    <CustomerSidebar>
      <form
        onSubmit={handleSave}
        noValidate={false}
        className="box-border min-w-[820px] px-4 pb-10 pt-6 sm:pl-[31px] sm:pr-[66px]"
      >
        {/* Page title */}
        <h1 className="m-0 flex min-h-[68px] items-center pl-1 font-['Quicksand'] text-[32px] font-bold leading-tight text-[#005FCA] sm:text-[40px] lg:text-[48px] lg:leading-[32px]">
          Profile
        </h1>

        {/* Profile card */}
        <div className="relative mt-[17px]">
          {/* Banner */}
          <div className="box-border h-[142px] rounded-t-[10px] rounded-b-[1px] border border-b-0 border-black/[0.14] bg-[#7DABDD]" />

          {/* Name row: click the name to edit it */}
          <div className="box-border flex h-[82px] items-start rounded-b-[10px] border border-t-0 border-black/40 bg-[#FDFFFF] pl-[190px] pr-6 pt-[18px]">
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errorMsg) setErrorMsg('');
              }}
              onKeyDown={handleNameKeyDown}
              disabled={loadingProfile}
              maxLength={60}
              placeholder="Full name"
              aria-label="Full name"
              title="Click to edit your name"
              spellCheck={false}
              autoComplete="name"
              className="-ml-2 box-border h-[34px] w-full max-w-[520px] cursor-text truncate rounded-[6px] border-b-2 border-transparent bg-transparent pl-2 pr-2 font-['Quicksand'] text-[24px] font-bold leading-[30px] text-[#292727] outline-none transition-colors placeholder:font-semibold placeholder:text-[#B9B6B6] hover:bg-[#EEF4FB] focus:border-[#005FCA] focus:bg-white disabled:cursor-wait"
            />
          </div>

          {/* Avatar overlapping the banner and the name row */}
          <div className="absolute left-[27px] top-[82px]">
            <UserAvatar
              name={name || user.name}
              src={user.photoUrl}
              sizeClass="h-[121px] w-[121px]"
              textClass="text-[64px] leading-[77px]"
            />
            <button
              type="button"
              onClick={focusName}
              aria-label="Edit name"
              className="absolute bottom-[2px] right-[2px] flex h-[28px] w-[28px] cursor-pointer items-center justify-center rounded-[6px] border-0 bg-white p-0 text-[#1E1E1E] shadow-[0_1px_3px_rgba(0,0,0,0.25)] transition-transform hover:scale-105"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M11 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" />
                <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Account details (inputs end 9px before the card edge, as in Figma) */}
        <div className="pr-[9px]">
          <h2 className="mb-[8px] mt-[33px] font-['Quicksand'] text-[18px] font-bold leading-[23px] text-[#292727]">
            Account Details
          </h2>

          {errorMsg && (
            <div
              role="alert"
              className={`mb-3 rounded-[8px] border border-red-200 bg-red-50 px-3 py-2 ${FONT_SF} text-[14px] text-red-600`}
            >
              {errorMsg}
            </div>
          )}

          <label htmlFor="email" className={labelBase}>
            Email Address
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loadingProfile}
            autoComplete="email"
            className={inputBase}
          />

          <label htmlFor="address" className={`${labelBase} mt-[5px]`}>
            Address
          </label>
          <input
            ref={addressRef}
            id="address"
            type="text"
            required
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            disabled={loadingProfile}
            autoComplete="street-address"
            className={inputBase}
          />

          {/* Save button, right-aligned with the inputs */}
          <div className="mt-[73px] flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting || loadingProfile}
              className={`box-border h-[50px] w-[265px] cursor-pointer rounded-[10px] border border-[#B1A8A8] bg-[linear-gradient(270deg,#04A5A5_0%,#0255AF_100%)] ${FONT_SF} text-[15px] font-bold leading-[170%] text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {isSubmitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </form>
    </CustomerSidebar>
  );
}