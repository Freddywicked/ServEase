import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { submitProviderApplication, me } from '../api/client';
import { useAuth } from '../context/auth_context';
import iconLogo from '../assets/servease_logo.png';
import iconUpload from '../assets/icon_upload.png';

// Where the provider lands once the application has been submitted.
const AFTER_SUBMIT_ROUTE = '/serviceprovider/dashboard';

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const formatSize = (bytes) =>
  bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const fieldLabel =
  'm-0 font-["Roboto",sans-serif] text-[10px] font-bold uppercase leading-[12px] tracking-[0.2em] text-[#7C7979]';

// One "Tap to upload" drop box. Shows the chosen file name/size once picked.
function UploadField({
  label,
  hint,
  accept,
  capture,
  multiple = false,
  files,
  onChange,
  className = '',
}) {
  const hasFiles = files.length > 0;
  const title = !hasFiles
    ? 'Tap to upload'
    : files.length === 1
      ? files[0].name
      : `${files.length} files selected`;
  const subtitle = !hasFiles
    ? hint
    : files.length === 1
      ? formatSize(files[0].size)
      : files.map((f) => f.name).join(', ');

  return (
    <div className={className}>
      <p className={fieldLabel}>{label}</p>
      <label className="mt-[6px] box-border flex h-[58px] w-full cursor-pointer items-center gap-[17px] rounded-md border border-[#A6A6A6] px-5 focus-within:border-[#0255AF] hover:border-[#7C7979]">
        <input
          type="file"
          accept={accept}
          capture={capture}
          multiple={multiple}
          onChange={(e) => onChange(Array.from(e.target.files || []))}
          className="sr-only"
          aria-label={label}
        />
        <img
          src={iconUpload}
          alt=""
          className="h-[30px] w-[38px] shrink-0 bg-[#EBEBEB] object-contain"
        />
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-['Plus_Jakarta_Sans',sans-serif] text-[12px] font-bold leading-[15px] text-black">
            {title}
          </span>
          {subtitle && (
            <span className="truncate font-['Plus_Jakarta_Sans',sans-serif] text-[9px] leading-[11px] text-[#555555]">
              {subtitle}
            </span>
          )}
        </span>
      </label>
    </div>
  );
}

// Agreement checkbox: 21px rounded square with a 2px black outline, as in the design.
function AgreementBox({ checked, onChange, children }) {
  return (
    <label className="flex cursor-pointer items-center gap-[23px]">
      <span className="relative flex h-[21px] w-[21px] shrink-0 items-center justify-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="peer sr-only"
        />
        <span className="h-[21px] w-[21px] rounded-[5px] border-2 border-black bg-transparent peer-checked:bg-black peer-focus-visible:ring-2 peer-focus-visible:ring-[#0255AF] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[#E2E5E8]" />
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
      <span className="font-['Roboto',sans-serif] text-[9px] font-bold uppercase leading-[11px] tracking-[0.2em] text-[#7C7979]">
        {children}
      </span>
    </label>
  );
}

// Step 2 of 2 of the Service Provider application (after ServiceCategory).
//
// TODO (routing): like RoleSelection, ServiceCategory and this screen must only show up
// while the provider's application hasn't been submitted. Gate both routes on the backend's
// user record (e.g. user.role === 'service-provider' && !user.applicationSubmitted) in a
// protected-route wrapper, and redirect everyone else to their dashboard. Once the submit
// below succeeds the backend should flag the application as submitted, so no local
// "seen it once" flag is needed and these screens never appear again after login.
export default function VerificationRequirements() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useAuth();

// Step 1 data arrives via router state. If missing (e.g. page refresh), go back.
useEffect(() => {
  if (!location.state) {
    navigate('/serviceprovider/service-category', { replace: true });
  }
}, [location.state, navigate]);
  const [validId, setValidId] = useState([]);
  const [selfie, setSelfie] = useState([]);
  const [supportingDocs, setSupportingDocs] = useState([]);
  const [certified, setCertified] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Rejects oversized files before they are stored in state.
  const pick = (setter) => (picked) => {
    if (picked.some((file) => file.size > MAX_FILE_SIZE_BYTES)) {
      setError(`Each file must be ${MAX_FILE_SIZE_MB} MB or smaller.`);
      return;
    }
    setError(null);
    setter(picked);
  };

  const handleSubmit = async () => {
    if (validId.length === 0) {
      setError('Please upload a valid ID.');
      return;
    }
    if (selfie.length === 0) {
      setError('Please upload a selfie for verification.');
      return;
    }
    if (!certified || !agreedToTerms) {
      setError('Please accept both agreements to continue.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
  await submitProviderApplication(location.state, {
    validId: validId[0],
    selfie: selfie[0],
    supportingDocs,
  });
  const data = await me(); // refresh the user so the app knows the application is in
  setUser(data.user);
  navigate(AFTER_SUBMIT_ROUTE);
} catch (err) {
  setError(err.message || "Couldn't submit your application. Please try again.");
}
  };

  return (
    <div className="flex min-h-screen flex-col items-center bg-[#EBEBEB] px-4 pb-[51px] pt-[50px]">
      {/* Header */}
      <img
        src={iconLogo}
        alt="ServEase"
        className="block h-[220px] w-[220px] max-w-full object-contain"
      />

      <h1 className="m-0 mt-2 text-center font-['Plus_Jakarta_Sans',sans-serif] text-[30px] font-bold leading-[38px] text-[#021E79]">
        Apply as Service Provider
      </h1>

      {/* Progress: step 2 of 2 */}
      <div
        className="mt-[11px] flex w-[601px] max-w-full gap-[14px]"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={2}
        aria-valuenow={2}
        aria-label="Application progress, step 2 of 2"
      >
        <div className="h-[7px] flex-1 rounded-[10px] bg-[#D9D9D9]" />
        <div className="h-[7px] flex-1 rounded-[10px] bg-[#021E79]" />
      </div>

      {/* Card */}
      <div className="mt-[44px] box-border w-[571px] max-w-full rounded-[30px] bg-[#E2E5E8] px-5 pb-[44px] pt-[25px] sm:px-[22px]">
        <h2 className="m-0 font-['Plus_Jakarta_Sans',sans-serif] text-[24px] font-extrabold leading-[30px] text-[#021E79]">
          Verification Requirements
        </h2>

        <div className="mt-7 sm:mx-[15px]">
          <UploadField
            label="Upload valid ID"
            hint="Government-issued ID"
            accept="image/*,application/pdf"
            files={validId}
            onChange={pick(setValidId)}
          />

          <UploadField
            className="mt-4"
            label="Selfie verification"
            accept="image/*"
            capture="user"
            files={selfie}
            onChange={pick(setSelfie)}
          />

          <UploadField
            className="mt-4"
            label="Supporting documents (optional)"
            accept="image/*,application/pdf"
            multiple
            files={supportingDocs}
            onChange={pick(setSupportingDocs)}
          />

          <div className="mt-5">
            <p className={`${fieldLabel} sm:ml-[19px]`}>Agreements</p>
            <div className="mt-[10px] flex flex-col gap-[19px]">
              <AgreementBox
                checked={certified}
                onChange={(e) => setCertified(e.target.checked)}
              >
                I certify that all information provided is true and correct.
              </AgreementBox>
              <AgreementBox
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
              >
                I agree to ServEase&apos;s Terms &amp; Conditions.
              </AgreementBox>
            </div>
          </div>
        </div>
      </div>

      {/* Submit */}
      <button
        type="button"
        disabled={isSubmitting}
        onClick={handleSubmit}
        className={`mt-[30px] box-border flex h-[39px] w-[325px] max-w-full items-center justify-center rounded-lg border border-black/30 bg-gradient-to-r from-[#0255AF] to-[#04A5A5] font-['Quicksand',sans-serif] text-[16px] font-bold leading-[23px] text-white ${
          isSubmitting ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
        }`}
      >
        SUBMIT
      </button>

      {error && (
        <p role="alert" className="m-0 mt-4 text-center font-['Roboto',sans-serif] text-[13px] text-[#B91C1C]">
          {error}
        </p>
      )}
    </div>
  );
}