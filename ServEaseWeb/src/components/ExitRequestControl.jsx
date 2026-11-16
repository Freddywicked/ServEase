import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { cancelDraftRequest, clearDraftRequestId } from '../api/client';
import closeIcon from '../assets/icon_close.png';

/* =====================================================================================
   EXIT REQUEST CONTROL — the "X" in the upper right of every "Creating Service Request"
   screen (steps 1 to 4) and the "Do you still want to continue?" confirmation (Figma: Create SR).

     Yes -> the modal closes and the customer carries on with the request.
     No  -> the request is NOT recorded: the draft saved on the backend (if this step already
            created one) is deleted, the saved draft id is cleared, and the customer goes
            back to the dashboard.

   Usage (inside the screen's relatively positioned content wrapper):
     <ExitRequestControl />                        // step 1 — nothing is saved yet
     <ExitRequestControl requestId={requestId} />  // steps 2-4 — a draft exists on the backend
   ===================================================================================== */

export default function ExitRequestControl({ requestId = null, redirectTo = '/customer/dashboard' }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // Escape works like "Yes": back to the request.
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !leaving) setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, leaving]);

  // "Yes" — keep going.
  const handleContinue = () => {
    if (!leaving) setOpen(false);
  };

  // "No" — discard the request. Nothing was submitted, so nothing stays recorded.
  const handleDiscard = async () => {
    if (leaving) return;
    setLeaving(true);
    try {
      if (requestId) await cancelDraftRequest(requestId);
    } catch (err) {
      // The customer is leaving anyway; the draft is never submitted to a provider.
      console.error('Failed to delete the draft service request', err);
    }
    clearDraftRequestId();
    navigate(redirectTo, { replace: true });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Close"
        className="absolute right-4 top-4 z-10 flex cursor-pointer items-center justify-center border-none bg-transparent p-0 sm:right-[60px] sm:top-[44px]"
      >
        <img src={closeIcon} alt="" className="h-6 w-6" />
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] box-border flex items-center justify-center bg-[rgba(229,229,229,0.7)] p-4"
            role="presentation"
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="exit-request-title"
              className="box-border flex h-[400px] max-h-full w-[600px] max-w-full flex-col items-center rounded-[10px] bg-white px-4 pt-[90px]"
            >
              <h2
                id="exit-request-title"
                className="m-0 text-center font-[Roboto] text-[24px] font-normal leading-[35px] text-[#414141] sm:text-[30px]"
              >
                Do you still want to continue?
              </h2>

              <button
                type="button"
                onClick={handleContinue}
                disabled={leaving}
                autoFocus
                className="mt-[48px] box-border h-[50px] w-full max-w-[300px] cursor-pointer rounded-[10px] border border-[#B1A8A8] bg-[#021E79] font-[SF_Pro,system-ui,sans-serif] text-[20px] font-bold leading-[34px] text-white disabled:cursor-not-allowed disabled:opacity-70"
              >
                Yes
              </button>
              <button
                type="button"
                onClick={handleDiscard}
                disabled={leaving}
                className="mt-6 box-border h-[50px] w-full max-w-[300px] cursor-pointer rounded-[10px] border border-[#B1A8A8] bg-[#FFFDFD] font-[SF_Pro,system-ui,sans-serif] text-[20px] font-bold leading-[34px] text-[#414141] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {leaving ? 'Cancelling…' : 'No'}
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}