import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { X } from 'lucide-react';
import ServiceProviderSidebar from '../components/ServiceProviderSidebar.jsx';
import { useAuth } from '../context/auth_context';
import { getProviderServiceRequest, rejectServiceRequest, sendQuote } from '../api/client';
import lightningIcon from '../assets/icon_lightning.png';
import pinIcon from '../assets/icon_pinloc.png';
import ellipseIcon from '../assets/icon_ellipse.png';
import photoIcon from '../assets/icon_photo.png';

const SF_PRO = 'font-[SF_Pro,system-ui,sans-serif]';
const SECTION_LABEL = `m-0 ${SF_PRO} text-[12px] font-bold leading-[16px] text-[#292727]`;

// The request comes from the backend: GET /api/providers/requests/:requestId -> { request: {...} }
//
// Shape of the request:
// {
//   id: 'SR-0000',
//   status: 'new' | 'quoted',
//   customer: {
//     name: 'Dominic Alcantara',
//     address: '123 Maple St QC Manila',
//     distanceKm: 1.2 | null,          // null until the backend can compute it
//     avatarUrl: null,                 // optional profile picture URL
//   },
//   concern: 'Customer narration of the device problem...',
//   photos: [],                        // image URLs uploaded by the customer
//   ai: { diagnosis, confidence, possibleCauses: [] } | null,   // null when the customer skipped the AI step
// }

function ModalShell({ onClose, children }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-5"
      onClick={onClose}
    >
      <div
        className={`relative box-border w-full max-w-[337px] rounded-[10px] bg-white px-[24px] pb-[22px] pt-[20px] ${SF_PRO}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-[18px] top-[16px] flex cursor-pointer border-none bg-transparent p-0"
        >
          <X size={16} color="#000000" />
        </button>
        {children}
      </div>
    </div>
  );
}

const FIELD_BASE =
  'box-border rounded-[6px] border border-[#DAD2D2] bg-[#FFFDFD] px-2 text-[9px] text-[#292727] outline-none placeholder:text-[#B5B0B0]';
const MODAL_BUTTON =
  'box-border mt-3 flex h-[32px] w-full items-center justify-center rounded-[8px] border border-[#DAD2D2] bg-[#FFFDFD] text-[9px] font-bold text-[#292727]';

// "Approve" popup: the provider sends a pre-repair quotation to the customer.
function ApproveQuoteModal({ onClose, onSubmit, isSaving }) {
  const [laborPrice, setLaborPrice] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [notes, setNotes] = useState('');

  const canSend = (laborPrice.trim() !== '' || itemPrice.trim() !== '') && !isSaving;

  return (
    <ModalShell onClose={onClose}>
      <p className="m-0 text-[12px] font-bold leading-[16px] text-[#292727]">
        Service Request Approved
      </p>
      <p className="m-0 mt-3 text-[10px] leading-[14px] text-[#5B5959]">
        Send a pre-repair quotation to the customer.
      </p>

      <div className="mt-2 flex gap-3">
        <label className="flex flex-col gap-[3px]">
          <span className="text-[8px] leading-[10px] text-[#5B5959]">Labor Price</span>
          <input
            type="number"
            min="0"
            inputMode="decimal"
            value={laborPrice}
            onChange={(e) => setLaborPrice(e.target.value)}
            placeholder="0.00"
            className={`${FIELD_BASE} h-[26px] w-[78px]`}
          />
        </label>
        <label className="flex flex-col gap-[3px]">
          <span className="text-[8px] leading-[10px] text-[#5B5959]">Item Price</span>
          <input
            type="number"
            min="0"
            inputMode="decimal"
            value={itemPrice}
            onChange={(e) => setItemPrice(e.target.value)}
            placeholder="0.00"
            className={`${FIELD_BASE} h-[26px] w-[78px]`}
          />
        </label>
      </div>

      <label className="mt-2 flex flex-col gap-[3px]">
        <span className="text-[8px] leading-[10px] text-[#5B5959]">Notes</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Parts needed, timeline ..."
          className={`${FIELD_BASE} h-[48px] w-full resize-none py-[6px]`}
        />
      </label>

      <button
        type="button"
        disabled={!canSend}
        onClick={() =>
          onSubmit({
            laborPrice: Number(laborPrice) || 0,
            itemPrice: Number(itemPrice) || 0,
            notes: notes.trim(),
          })
        }
        className={`${MODAL_BUTTON} ${canSend ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
      >
        {isSaving ? 'Sending…' : 'Send Quote'}
      </button>
    </ModalShell>
  );
}

// "Decline" popup: the provider states why the request is being rejected.
function RejectModal({ onClose, onSubmit, isSaving }) {
  const [reason, setReason] = useState('');
  const canSend = reason.trim() !== '' && !isSaving;

  return (
    <ModalShell onClose={onClose}>
      <p className="m-0 text-[12px] font-bold leading-[16px] text-[#292727]">Reason for Rejection</p>
      <p className="m-0 mt-1 text-[10px] leading-[14px] text-[#5B5959]">
        State a proper reason for rejection.
      </p>

      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Enter your reasons here."
        className={`${FIELD_BASE} mt-3 h-[96px] w-full resize-none py-[6px]`}
      />

      <button
        type="button"
        disabled={!canSend}
        onClick={() => onSubmit({ reason: reason.trim() })}
        className={`${MODAL_BUTTON} ${canSend ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
      >
        {isSaving ? 'Sending…' : 'Send'}
      </button>
    </ModalShell>
  );
}

export default function ServiceRequestDetails() {
  const { user, loading } = useAuth();
  const { requestId } = useParams();
  const navigate = useNavigate();

  const [request, setRequest] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [modal, setModal] = useState(null); // null | 'approve' | 'reject'
  const [isSaving, setIsSaving] = useState(false);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    setIsLoading(true);
    getProviderServiceRequest(requestId)
      .then((data) => {
        if (!cancelled) setRequest(data.request);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message || "Couldn't load this request.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [requestId, user]);

  const goBackToList = () => navigate('/serviceprovider/requests', { replace: true });

  // Approve = send the pre-repair quotation: POST /api/providers/requests/:requestId/quote
  const handleSendQuote = async ({ laborPrice, itemPrice, notes }) => {
    setIsSaving(true);
    setActionError('');
    try {
      await sendQuote(requestId, { laborPrice, itemPrice, notes });
      setModal(null);
      goBackToList();
    } catch (err) {
      setModal(null);
      setActionError(err.message || "Couldn't send the quotation. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Decline: POST /api/providers/requests/:requestId/reject
  const handleReject = async ({ reason }) => {
    setIsSaving(true);
    setActionError('');
    try {
      await rejectServiceRequest(requestId, { reason });
      setModal(null);
      goBackToList();
    } catch (err) {
      setModal(null);
      setActionError(err.message || "Couldn't send your response. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  if (!request) {
    return (
      <ServiceProviderSidebar>
        <div className="box-border px-4 pt-[25px] sm:px-[54px]">
          <p className="m-0 font-[Roboto] text-[14px] font-medium text-[#817C7C]">
            {isLoading ? 'Loading…' : loadError || 'Service request not found.'}
          </p>
          <Link
            to="/serviceprovider/requests"
            className="mt-3 inline-block font-[Roboto] text-[14px] font-medium text-[#005FCA]"
          >
            Back to Incoming Service Requests
          </Link>
        </div>
      </ServiceProviderSidebar>
    );
  }

  const { customer, ai } = request;
  const canRespond = request.status === 'new'; // quoted requests were already answered

  return (
    <ServiceProviderSidebar>
      <div className="box-border px-4 pb-10 pt-[25px] sm:px-[54px]">
        {/* Column is 675px wide in the Figma frame; the buttons sit on its right edge */}
        <div className={`w-full max-w-[675px] ${SF_PRO}`}>
          <h1 className="m-0 flex h-[68px] items-center font-[Quicksand] text-[32px] font-bold leading-[32px] text-[#005FCA] sm:text-[40px] lg:text-[48px]">
            Service Request
          </h1>

          <h2 className="m-0 mt-[30px] text-[20px] font-bold leading-[24px] text-[#292727]">
            Request #{request.id}
          </h2>

          {/* Customer information */}
          <p className={`${SECTION_LABEL} mt-[22px]`}>Customer Information</p>
          <div className="mt-1 flex flex-wrap items-center">
            <img
              src={customer.avatarUrl || ellipseIcon}
              alt=""
              className="h-[70px] w-[70px] flex-none rounded-full object-cover"
            />
            <div className="ml-4 w-[274px] max-w-full sm:ml-[42px]">
              <p className="m-0 text-[11px] font-bold leading-[19px] text-[#292727]">
                {customer.name}
              </p>
              <p className="m-0 pl-[6px] text-[11px] font-normal leading-[19px] text-[#5B5959]">
                {customer.address}
              </p>
            </div>
            {customer.distanceKm != null && (
              <div className="flex items-center gap-[6px]">
                <img src={pinIcon} alt="" className="h-[15px] w-[12px] flex-none object-contain" />
                <span className="text-[10px] font-normal leading-[17px] text-[#5B5959] underline">
                  {customer.distanceKm} km away
                </span>
              </div>
            )}
          </div>

          {/* Customer concern */}
          <p className={`${SECTION_LABEL} mt-[9px]`}>Customer Concern</p>
          <p className="m-0 ml-1 mt-[6px] max-w-[620px] text-[12px] font-normal leading-[20px] text-[#292727]">
            {request.concern}
          </p>

          {request.photos.length > 0 ? (
            <div className="ml-1 mt-[14px] grid max-w-[617px] grid-cols-2 gap-2 sm:grid-cols-3">
              {request.photos.map((src) => (
                <img
                  key={src}
                  src={src}
                  alt="Uploaded by the customer"
                  className="h-[136px] w-full rounded-[4px] object-cover"
                />
              ))}
            </div>
          ) : (
            <div className="ml-1 mt-[14px] flex h-[136px] w-full max-w-[617px] items-center justify-center bg-[#D9D9D9]">
              <img src={photoIcon} alt="No photo uploaded" className="h-[36px] w-[37px]" />
            </div>
          )}

          {/* AI diagnosis */}
          <p className={`${SECTION_LABEL} mt-6`}>AI Diagnosis (Preliminary)</p>
          {ai ? (
            <>
              <div className="mt-[7px] box-border flex h-[34px] w-full max-w-[641px] items-center rounded-[10px] bg-[#262728] pl-[30px]">
                <img src={lightningIcon} alt="" className="h-[13px] w-[10px] flex-none object-contain" />
                <span className="ml-[10px] text-[9px] font-normal leading-[15px] text-white">
                  AI suggests {ai.diagnosis} ({ai.confidence}% confidence)
                </span>
              </div>

              <div className="mt-[19px] text-[9px] leading-[15px] text-[#292727]">
                <p className="m-0 font-normal">Possible causes:</p>
                {ai.possibleCauses.map((cause) => (
                  <p key={cause} className="m-0 font-bold">
                    {cause}
                  </p>
                ))}
              </div>
            </>
          ) : (
            <p className="m-0 mt-[7px] text-[10px] leading-[15px] text-[#5B5959]">
              The customer skipped the AI diagnosis.
            </p>
          )}

          {actionError && (
            <p role="alert" className="m-0 mt-4 text-[11px] text-[#B91C1C]">
              {actionError}
            </p>
          )}

          {/* Decline / Approve */}
          {canRespond && (
            <div className="mt-[77px] flex justify-end gap-[18px]">
              <button
                type="button"
                onClick={() => setModal('reject')}
                className="box-border h-[32px] w-[191px] max-w-[48%] cursor-pointer rounded-[10px] border border-[#B1A8A8] bg-[#FFFDFD] text-[9px] font-bold text-[#292727]"
              >
                Decline
              </button>
              <button
                type="button"
                onClick={() => setModal('approve')}
                className="box-border h-[32px] w-[191px] max-w-[48%] cursor-pointer rounded-[10px] border border-[#B1A8A8] bg-[#577FBB] text-[9px] font-bold text-white"
              >
                Approve
              </button>
            </div>
          )}
        </div>
      </div>

      {modal === 'approve' && (
        <ApproveQuoteModal
          onClose={() => setModal(null)}
          onSubmit={handleSendQuote}
          isSaving={isSaving}
        />
      )}
      {modal === 'reject' && (
        <RejectModal onClose={() => setModal(null)} onSubmit={handleReject} isSaving={isSaving} />
      )}
    </ServiceProviderSidebar>
  );
}