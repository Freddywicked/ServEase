import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import CustomerSidebar from '../components/CustomerSidebar.jsx';
import UserAvatar from '../components/UserAvatar.jsx';
import { me, updateProfile } from '../api/client';
import { useAuth } from '../context/auth_context';

// Utility helper to resolve key variations across backend representations
const pickFirst = (source, keys) => {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') return String(value);
  }
  return '';
};

const ADDRESS_KEYS = ['address', 'address_details', 'addressDetails', 'location'];

export default function CustomerEditProfile() {
  const { user, loading, setUser } = useAuth();
  const navigate = useNavigate();

  // State management for profile editable fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // Status states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    // Fetch fresh details from backend (API /api/me)
    me()
      .then((data) => {
        if (cancelled) return;
        const fetchedUser = data.user || user;
        setName(fetchedUser.name || '');
        setEmail(fetchedUser.email || '');
        setAddress(pickFirst(fetchedUser, ADDRESS_KEYS));
      })
      .catch((err) => {
        if (cancelled) return;
        // Fallback to local user context if backend fetch fails
        setName(user.name || '');
        setEmail(user.email || '');
        setAddress(pickFirst(user, ADDRESS_KEYS));
        console.error('Failed to load full profile data:', err);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  const toggleEditMode = () => {
    setIsEditing((prev) => !prev);
  };

  const handleDone = async () => {
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      // API call to save changes to the backend
      const payload = { name, email, address };
      const updatedUser = await updateProfile(payload);

      // Update global auth context if backend returns updated user
      if (setUser && updatedUser) {
        setUser((prev) => ({ ...prev, ...updatedUser }));
      } else if (setUser) {
        setUser((prev) => ({ ...prev, ...payload }));
      }

      // Navigate back to the main customer profile page
      navigate('/customer/profile');
    } catch (err) {
      console.error('Error saving profile changes:', err);
      setErrorMsg(err.message || 'Failed to update profile. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <CustomerSidebar>
      <div className="box-border min-w-[820px] px-4 pb-10 pt-6 sm:pl-[31px] sm:pr-[66px]">
        {/* Page Title */}
        <h1 className="m-0 flex min-h-[68px] items-center pl-1 font-['Quicksand'] text-[32px] font-bold leading-tight text-[#005FCA] sm:text-[40px] lg:text-[48px] lg:leading-[32px]">
          Profile
        </h1>

        {/* Profile Card Header Banner */}
        <div className="relative mt-[17px]">
          <div className="box-border h-[142px] rounded-t-[10px] rounded-b-[1px] border border-b-0 border-black/[0.14] bg-[#7DABDD]" />
          
          <div className="relative box-border h-[82px] rounded-b-[10px] border border-t-0 border-black/40 bg-[#FDFFFF] px-[189px] flex items-center justify-between">
            {isEditing ? (
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="font-['Quicksand'] text-[24px] font-bold leading-[30px] text-[#292727] border border-gray-400 rounded px-2 py-1 focus:outline-none focus:border-[#005FCA]"
                placeholder="Full Name"
              />
            ) : (
              <p className="m-0 max-w-[calc(100%-150px)] truncate font-['Quicksand'] text-[24px] font-bold leading-[30px] text-[#292727]">
                {name || user.name}
              </p>
            )}

            {/* Clickable Edit Button */}
            <button
              type="button"
              onClick={toggleEditMode}
              className={`box-border h-[39px] w-[109px] cursor-pointer rounded-[10px] border border-[#3F4143] bg-white font-['SF_Pro',system-ui,sans-serif] text-[16px] font-bold leading-[27px] text-black transition-colors hover:bg-gray-100 ${
                isEditing ? 'bg-gray-200 border-[#005FCA] text-[#005FCA]' : ''
              }`}
            >
              {isEditing ? 'Editing' : 'Edit'}
            </button>
          </div>

          {/* User Avatar overlapping the banner */}
          <div className="absolute left-[27px] top-[82px]">
            <UserAvatar
              name={name || user.name}
              src={user.photoUrl}
              sizeClass="h-[121px] w-[121px]"
              textClass="text-[64px] leading-[77px]"
            />
          </div>
        </div>

        {/* Account Details Form Section */}
        <div className="mt-[41px]">
          <h2 className="mb-[20px] font-['Quicksand'] text-[18px] font-bold text-[#292727]">
            Account Details
          </h2>

          {errorMsg && (
            <div className="mb-4 rounded bg-red-50 p-3 text-sm text-red-600 border border-red-200">
              {errorMsg}
            </div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); handleDone(); }}>
            {/* Email Address Input */}
            <div className="mb-[16px]">
              <label 
                htmlFor="email" 
                className="block mb-[6px] font-['SF_Pro',system-ui,sans-serif] text-[15px] font-normal leading-[170%] text-[#484040]"
              >
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={!isEditing && false} // Set to true if email editing requires special verification
                className="box-border h-[41px] w-full max-w-[1105px] rounded-[8px] border border-[#818080] bg-white px-3 font-['SF_Pro',system-ui,sans-serif] text-[15px] leading-[170%] text-[#6F6F6F] focus:outline-none focus:border-[#005FCA] disabled:bg-gray-50"
              />
            </div>

            {/* Address Input */}
            <div className="mb-[40px]">
              <label 
                htmlFor="address" 
                className="block mb-[6px] font-['SF_Pro',system-ui,sans-serif] text-[15px] font-normal leading-[170%] text-[#484040]"
              >
                Address
              </label>
              <input
                id="address"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="box-border h-[41px] w-full max-w-[1105px] rounded-[8px] border border-[#818080] bg-white px-3 font-['SF_Pro',system-ui,sans-serif] text-[15px] leading-[170%] text-[#6F6F6F] focus:outline-none focus:border-[#005FCA]"
              />
            </div>

            {/* Done Button */}
            <div className="flex justify-end pr-[20px]">
              <button
                type="button"
                onClick={handleDone}
                disabled={isSubmitting}
                className="box-border h-[36px] min-w-[88px] cursor-pointer rounded-[10px] border border-[#55575B] bg-white px-4 font-['SF_Pro',system-ui,sans-serif] text-[15px] font-bold text-black transition-colors hover:bg-gray-100 disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Done'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </CustomerSidebar>
  );
}