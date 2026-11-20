import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import ServiceProviderSidebar from '../components/ServiceProviderSidebar.jsx';
import { QuotationModal, ReasonModal, SF_PRO } from '../components/ProviderRequestUI.jsx';
import { useAuth } from '../context/auth_context';
import { getProviderServiceRequest, rejectServiceRequest, sendQuote } from '../api/client';
import lightningIcon from '../assets/icon_lightning.png';
import pinIcon from '../assets/icon_pinloc.png';
import ellipseIcon from '../assets/icon_ellipse.png';
import photoIcon from '../assets/icon_photo.png';

const SECTION_LABEL = `m-0 ${SF_PRO} text-[12px] font-bold leading-[20px] text-[#5B5959]`;
const SECTION_LABEL_SMALL = `m-0 ${SF_PRO} text-[11px] font-bold leading-[19px] text-[#5B5959]`;

// The request comes from the backend: GET /api/providers/requests/:requestId -> { request: {...} }
//
// Shape of the request:
// {
//   id: 'SR-0000',
//   status: 'new' | 'quoted' | 'closed',
//   canApprove: true,                   // false once this provider already answered
//   customer: {
//     name: 'Dominic Alcantara',
//     address: '123 Maple St QC Manila',
//     distanceKm: 1.2 | null,           // null until the backend can compute it
//     avatarUrl: null,                  // optional profile picture URL
//   },
//   concern: 'Customer narration of the device problem...',
//   attachments: [{ url, type: 'image' | 'video', filename }],  // the customer's uploads
//   photos: [],                         // legacy image-only URLs (older servers)
//   ai: { diagnosis, confidence, possibleCauses: [] } | null,   // null when the customer skipped the AI step
//   quote: { labor, parts } | null,     // once a quotation was sent
//   closedBy: 'provider' | 'customer' | null,
//   declinedReason: 'text' | null,
// }

const formatPesos = (n) => Number(n || 0).toLocaleString('en-US');

function PlayGlyph({ size = 49 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="23" fill="rgba(0,0,0,0.45)" />
      <path d="M19 14.5v19l16-9.5-16-9.5z" fill="#fff" />
    </svg>
  );
}

// Full-size viewer for the customer's photos / video (opens when a thumbnail is clicked).
function AttachmentViewer({ attachments, startIndex, onClose }) {
  const [index, setIndex] = useState(startIndex);
  const count = attachments.length;
  const current = attachments[index];

  const prev = useCallback(() => setIndex((i) => (i - 1 + count) % count), [count]);
  const next = useCallback(() => setIndex((i) => (i + 1) % count), [count]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, prev, next]);

  if (!current) return null;

  const navButton =
    'absolute top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-0 bg-white/90 p-0 text-black';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Customer attachment"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-5 top-5 z-10 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-0 bg-white/90 p-0 text-black"
      >
        <X size={20} />
      </button>

      {count > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous attachment"
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
            className={`${navButton} left-4`}
          >
            <ChevronLeft size={22} />
          </button>
          <button
            type="button"
            aria-label="Next attachment"
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            className={`${navButton} right-4`}
          >
            <ChevronRight size={22} />
          </button>
        </>
      )}

      <div className="flex max-h-full max-w-[min(92vw,1000px)] flex-col items-center" onClick={(e) => e.stopPropagation()}>
        {current.type === 'video' ? (
          <video
            key={current.url}
            src={current.url}
            controls
            autoPlay
            playsInline
            className="max-h-[80vh] max-w-full rounded-[6px] bg-black"
          />
        ) : (
          <img
            key={current.url}
            src={current.url}
            alt={current.filename || `Customer upload ${index + 1}`}
            className="max-h-[80vh] max-w-full rounded-[6px] object-contain"
          />
        )}
        <p className={`m-0 mt-3 ${SF_PRO} text-[12px] text-white`}>
          {index + 1} / {count}
          {current.filename ? ` · ${current.filename}` : ''}
        </p>
      </div>
    </div>
  );
}

// One 137 x 176 thumbnail in the Figma attachment row (first tile is the video when there is one).
function AttachmentTile({ attachment, index, onOpen }) {
  const [broken, setBroken] = useState(false);
  const isVideo = attachment.type === 'video';
  const label = attachment.filename || (isVideo ? `Customer video ${index + 1}` : `Customer photo ${index + 1}`);

  return (
    <button
      type="button"
      onClick={() => onOpen(index)}
      aria-label={`View ${label}`}
      className="relative box-border flex h-[176px] w-[137px] cursor-pointer items-center justify-center overflow-hidden border-0 bg-[#D9D9D9] p-0"
    >
      {broken ? (
        <img src={photoIcon} alt="" className="h-[36px] w-[37px]" />
      ) : isVideo ? (
        <>
          <video
            src={attachment.url}
            preload="metadata"
            muted
            playsInline
            onError={() => setBroken(true)}
            className="pointer-events-none h-full w-full bg-[#3F3F3F] object-cover"
          />
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <PlayGlyph />
          </span>
        </>
      ) : (
        <img
          src={attachment.url}
          alt={label}
          loading="lazy"
          onError={() => setBroken(true)}
          className="h-full w-full object-cover"
        />
      )}
    </button>
  );
}

// Decline / Approve buttons (Figma without modal: 190 x 40, red #CF2626 / green #167713, 27px apart).
const ACTION_BUTTON =
  'box-border h-[40px] w-[190px] max-w-[48%] cursor-pointer rounded-[10px] border border-[#B1A8A8] text-[10px] font-bold leading-[17px] text-white';

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
  const [viewerIndex, setViewerIndex] = useState(null);

  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    setIsLoading(true);
    setLoadError('');
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

  const closeModal = () => {
    if (isSaving) return;
    setModal(null);
    setActionError('');
  };

  // Approve = send the pre-repair quotation: POST /api/providers/requests/:requestId/quote
  const handleSendQuote = async ({ laborPrice, itemPrice, notes }) => {
    setIsSaving(true);
    setActionError('');
    try {
      await sendQuote(requestId, { laborPrice, itemPrice, notes });
      setModal(null);
      goBackToList();
    } catch (err) {
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

  const customer = request.customer || {};
  const ai = request.ai;
  const possibleCauses = Array.isArray(ai?.possibleCauses) ? ai.possibleCauses : [];
  // Only a request still waiting on this provider can be approved or declined.
  const canRespond = request.canApprove ?? request.status === 'new';

  // Typed attachments from the backend; fall back to the legacy image-only `photos` field
  // while an older server is deployed.
  const attachments = (
    Array.isArray(request.attachments)
      ? request.attachments
      : (request.photos || []).map((url) => ({ url, type: 'image', filename: null }))
  )
    .filter((a) => a?.url)
    // The video goes first, like in the Figma frame.
    .sort((a, b) => Number(b.type === 'video') - Number(a.type === 'video'));

  const statusNote =
    request.status === 'quoted'
      ? `You already sent a quotation${
          request.quote ? ` (${formatPesos(request.quote.labor)} labor, ${formatPesos(request.quote.parts)} parts)` : ''
        }. Waiting for the customer to answer.`
      : request.status === 'closed'
        ? request.closedBy === 'customer'
          ? 'The customer declined your quotation.'
          : `You declined this request${request.declinedReason ? `: ${request.declinedReason}` : '.'}`
        : '';

  return (
    <ServiceProviderSidebar>
      <div className="box-border px-4 pb-10 pt-[25px] sm:px-[54px]">
        <div className={`w-full max-w-[1070px] ${SF_PRO}`}>
          <h1 className="m-0 flex h-[68px] items-center font-[Quicksand] text-[32px] font-bold leading-[32px] text-[#005FCA] sm:text-[40px] lg:text-[48px]">
            Service Request
          </h1>

          <h2 className="m-0 mt-[30px] text-[20px] font-bold leading-[34px] text-[#292727]">
            Request #{request.id}
          </h2>

          {statusNote && (
            <p className="m-0 mt-2 max-w-[700px] text-[12px] leading-[18px] text-[#5B5959]">{statusNote}</p>
          )}

          {/* Customer information */}
          <p className={`${SECTION_LABEL} mt-[14px]`}>Customer Information</p>
          <div className="mt-[6px] flex flex-wrap items-center">
            <img
              src={customer.avatarUrl || ellipseIcon}
              alt=""
              className="h-[70px] w-[69px] flex-none rounded-full object-cover"
            />
            <div className="ml-4 sm:ml-[34px]">
              <p className="m-0 text-[11px] font-bold leading-[19px] text-[#5B5959]">{customer.name}</p>
              <div className="flex flex-wrap items-center gap-x-[6px]">
                <img src={pinIcon} alt="" className="h-[15px] w-[12px] flex-none object-contain" />
                <span className="text-[11px] font-normal leading-[19px] text-[#5B5959]">
                  {customer.address || 'No address provided'}
                </span>
                {customer.distanceKm != null && (
                  <span className="ml-2 text-[9px] font-normal leading-[15px] text-[#5B5959]">
                    {customer.distanceKm} km away
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Customer concern */}
          <p className={`${SECTION_LABEL} mt-[14px]`}>Customer Concern</p>
          <p className="m-0 mt-[4px] max-w-[760px] whitespace-pre-line text-[14px] font-normal leading-[24px] text-[#292727]">
            {request.concern}
          </p>

          {/* Attachments uploaded by the customer (Figma "with attachments"; hidden when there are none) */}
          {attachments.length > 0 && (
            <div className="mt-[18px] flex flex-wrap gap-x-[47px] gap-y-4 pl-[2px]" aria-label="Customer attachments">
              {attachments.map((attachment, index) => (
                <AttachmentTile
                  key={`${attachment.url}-${index}`}
                  attachment={attachment}
                  index={index}
                  onOpen={setViewerIndex}
                />
              ))}
            </div>
          )}

          {/* AI diagnosis */}
          <p className={`${SECTION_LABEL_SMALL} mt-[26px]`}>AI Diagnosis (Preliminary)</p>
          {ai ? (
            <>
              <div className="mt-[5px] box-border flex h-[34px] w-full max-w-[649px] items-center rounded-[10px] bg-[#262728] pl-[22px]">
                <img src={lightningIcon} alt="" className="h-[15px] w-[11px] flex-none object-contain" />
                <span className="ml-[12px] text-[9px] font-normal leading-[15px] text-white">
                  AI suggests {ai.diagnosis}
                  {ai.confidence != null ? ` (${ai.confidence}% confidence)` : ''}
                </span>
              </div>

              {possibleCauses.length > 0 && (
                <div className="mt-[14px] text-[9px] leading-[15px] text-[#292727]">
                  <p className="m-0 font-normal">Possible causes:</p>
                  {possibleCauses.map((cause) => (
                    <p key={cause} className="m-0 font-bold">
                      {cause}
                    </p>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="m-0 mt-[7px] text-[10px] leading-[15px] text-[#5B5959]">
              The customer skipped the AI diagnosis.
            </p>
          )}

          {/* Decline / Approve */}
          {canRespond && (
            <div className="mt-[56px] flex justify-end gap-[27px]">
              <button
                type="button"
                onClick={() => {
                  setActionError('');
                  setModal('reject');
                }}
                className={`${ACTION_BUTTON} bg-[#CF2626]`}
              >
                Decline
              </button>
              <button
                type="button"
                onClick={() => {
                  setActionError('');
                  setModal('approve');
                }}
                className={`${ACTION_BUTTON} bg-[#167713]`}
              >
                Approve
              </button>
            </div>
          )}
        </div>
      </div>

      {viewerIndex !== null && (
        <AttachmentViewer attachments={attachments} startIndex={viewerIndex} onClose={() => setViewerIndex(null)} />
      )}

      {modal === 'approve' && (
        <QuotationModal onClose={closeModal} onSubmit={handleSendQuote} isSaving={isSaving} error={actionError} />
      )}
      {modal === 'reject' && (
        <ReasonModal onClose={closeModal} onSubmit={handleReject} isSaving={isSaving} error={actionError} />
      )}
    </ServiceProviderSidebar>
  );
}