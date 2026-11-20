import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, ChevronLeft, ChevronRight, Play, X } from 'lucide-react';
import CustomerSidebar from '../components/CustomerSidebar';
import { getRepairDetails } from '../api/client';

/* =====================================================================================
   VIEW REPAIR DETAILS (customer) — live data
   -------------------------------------------------------------------------------------
   Opened from the "View" button of an On-going card in Track Requests
   (route: /customer/requests/:requestId/repair-details).

   Everything on this screen comes from the backend. Whatever the service provider pushes
   from Active Jobs > Update Status (stage, notes, images / videos) is stored by
   PATCH /api/provider/jobs/:id/status and read back here with:

     GET /api/service-requests/:requestId/repair-details
     -> {
          requestNumber, providerName,
          serviceLocationType: 'home' | 'shop',
          statusLabel,            // e.g. "In progress"
          isPaid,                 // final balance settled
          steps: [{
            key, label,           // already matches the location type (Shop: Assessing /
                                  // Repairing / Quality Checking / Completed, Home: Preparing /
                                  // Service Provider is on the way / Arrived at the Customer's
                                  // location / Completed)
            done,                 // the provider has updated this step
            updatedAt,            // ISO time of the latest update of the step
            updates: [{
              id, updatedAt, notes,
              attachments: [{ id, url, type: 'image' | 'video', name }]
            }]
          }]
        }

   Figma (Track Requests - View Repair Details with / without attachments):
     - A step the provider has updated: blue circle + check. Not updated yet: dark circle.
     - Without notes or attachments the step only reads
       "The repair status was updated at June 24, 2026, 9:12 AM."
     - With notes and / or attachments the step shows the date, "Service Provider’s Note",
       the note and a row of 137 x 176 thumbnails (video = play icon, image = picture).
       Clicking a thumbnail opens it full size.
     - The last step ("Completed") stays dark until the customer has paid the balance.
   The page refreshes itself, so a new provider update shows up without a reload.
   ===================================================================================== */

const POLL_INTERVAL_MS = 15000;

const SF_PRO = { fontFamily: "'SF Pro', 'SF Pro Text', Inter, system-ui, sans-serif" };

// Same pill colours as the Track Requests cards.
const PILL_PROGRESS = '#577FBB';
const PILL_COMPLETED = '#167713';

// "June 24, 2026, 9:12 AM"
const formatLongDateTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const date = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${date}, ${time}`;
};

const VIDEO_EXT = /\.(mp4|mov|m4v|webm|ogg|3gp|avi|mkv)(\?|#|$)/i;

// The backend sends type: 'image' | 'video'; fall back to the mime type / extension if it does not.
const kindOf = (att) => {
  const declared = String(att.type || att.kind || att.mimeType || att.mime_type || '').toLowerCase();
  if (declared.startsWith('video')) return 'video';
  if (declared.startsWith('image')) return 'image';
  return VIDEO_EXT.test(att.url || att.name || '') ? 'video' : 'image';
};

const mapAttachment = (att, index) => ({
  id: att.id ?? `${index}-${att.url}`,
  url: att.url,
  name: att.name || '',
  type: kindOf(att),
});

// Backend payload -> what the page renders.
const mapDetails = (raw) => {
  const locationType = raw.serviceLocationType === 'home' ? 'home' : 'shop';
  const isPaid = Boolean(raw.isPaid);
  const rawSteps = Array.isArray(raw.steps) ? raw.steps : [];

  const steps = rawSteps.map((step, i) => {
    const updates = (Array.isArray(step.updates) ? step.updates : [])
      .map((u) => ({
        id: u.id ?? `${step.key ?? i}-${u.updatedAt}`,
        at: u.updatedAt,
        notes: String(u.notes || '').trim(),
        attachments: (Array.isArray(u.attachments) ? u.attachments : [])
          .filter((a) => a && a.url)
          .map(mapAttachment),
      }))
      .sort((a, b) => new Date(a.at || 0) - new Date(b.at || 0));

    const done = Boolean(step.done) || updates.length > 0;
    const isLast = i === rawSteps.length - 1;
    const lastAt = step.updatedAt || updates[updates.length - 1]?.at || null;

    // The final step is blue only after the customer paid the balance.
    let state = done ? 'done' : 'pending';
    if (isLast && done && !isPaid) state = 'unpaid';

    return {
      key: step.key ?? step.label ?? i,
      label: step.label,
      state,
      updatedAt: lastAt,
      updates,
      // Shop-based jobs show "Payment Pending" on the finished step until the balance is paid.
      paymentPending: isLast && done && !isPaid && locationType === 'shop',
    };
  });

  return {
    requestNumber: raw.requestNumber || raw.requestId || '',
    providerName: raw.providerName || '',
    badge: isPaid ? 'Completed' : raw.statusLabel || 'In progress',
    badgeColor: isPaid ? PILL_COMPLETED : PILL_PROGRESS,
    steps,
  };
};

/* ------------------------------------ small UI parts ------------------------------------ */

function StepDot({ state }) {
  const base = 'flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full';
  if (state === 'done') {
    return (
      <span className={`${base} bg-[#577FBB]`}>
        <Check size={16} strokeWidth={3} color="#FFEFEF" />
      </span>
    );
  }
  return <span className={`${base} bg-[#414141]`} />;
}

// Grey "picture" glyph used when a thumbnail has nothing to show (Figma image tile).
function PictureGlyph() {
  return (
    <svg width="58" height="58" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="2.5" y="3.5" width="19" height="17" rx="2.5" fill="#3F3F3F" />
      <circle cx="8.5" cy="9" r="1.8" fill="#D9D9D9" />
      <path d="M4 18l5-5.5 3.5 3.5 3-3L20.5 17v1.5H4z" fill="#D9D9D9" />
    </svg>
  );
}

// 137 x 176 thumbnail (Figma Rectangle 3524…3529). Image = the photo, video = first frame + play icon.
function Thumbnail({ attachment, onOpen }) {
  const [failed, setFailed] = useState(false);
  const isVideo = attachment.type === 'video';

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={isVideo ? 'Play video' : 'View image'}
      className="relative box-border h-[176px] w-[137px] flex-none cursor-pointer overflow-hidden border-none bg-[#D9D9D9] p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0255AF]"
    >
      {failed ? (
        <span className="flex h-full w-full items-center justify-center">
          {isVideo ? <Play size={49} color="#fff" fill="#fff" /> : <PictureGlyph />}
        </span>
      ) : isVideo ? (
        <>
          <video
            src={attachment.url}
            preload="metadata"
            muted
            playsInline
            onError={() => setFailed(true)}
            className="pointer-events-none h-full w-full object-cover"
          />
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
            <Play size={49} color="#fff" fill="#fff" />
          </span>
        </>
      ) : (
        <img
          src={attachment.url}
          alt={attachment.name || 'Repair photo'}
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      )}
    </button>
  );
}

// Full-size viewer for the thumbnails of one update (arrows / ← → move, Esc closes).
function MediaViewer({ items, startIndex, onClose }) {
  const [index, setIndex] = useState(startIndex);
  const item = items[index];
  const many = items.length > 1;

  const step = useCallback(
    (delta) => setIndex((i) => (i + delta + items.length) % items.length),
    [items.length]
  );

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      else if (many && e.key === 'ArrowLeft') step(-1);
      else if (many && e.key === 'ArrowRight') step(1);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, step, many]);

  if (!item) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Repair attachment"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute right-5 top-5 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border-none bg-white/15 text-white hover:bg-white/30"
      >
        <X size={22} />
      </button>

      {many && (
        <button
          type="button"
          aria-label="Previous"
          onClick={() => step(-1)}
          className="absolute left-4 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border-none bg-white/15 text-white hover:bg-white/30"
        >
          <ChevronLeft size={26} />
        </button>
      )}

      {item.type === 'video' ? (
        <video
          key={item.id}
          src={item.url}
          controls
          autoPlay
          playsInline
          className="max-h-[85vh] max-w-[90vw] bg-black"
        />
      ) : (
        <img
          key={item.id}
          src={item.url}
          alt={item.name || 'Repair photo'}
          className="max-h-[85vh] max-w-[90vw] object-contain"
        />
      )}

      {many && (
        <button
          type="button"
          aria-label="Next"
          onClick={() => step(1)}
          className="absolute right-4 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border-none bg-white/15 text-white hover:bg-white/30"
        >
          <ChevronRight size={26} />
        </button>
      )}

      {many && (
        <p className="absolute bottom-5 m-0 text-[13px] text-white/80">
          {index + 1} / {items.length}
        </p>
      )}
    </div>
  );
}

// One provider update inside a step.
function UpdateEntry({ update, onOpenMedia }) {
  const when = formatLongDateTime(update.at);
  const detailed = Boolean(update.notes) || update.attachments.length > 0;

  if (!detailed) {
    return (
      <p className="m-0 text-[16px] leading-[27px] text-[#292727]">
        The repair status was updated{when ? ` at ${when}.` : '.'}
      </p>
    );
  }

  return (
    <div>
      {when && <p className="m-0 text-[16px] leading-[27px] text-[#292727]">{when}.</p>}

      {update.notes && (
        <div className="mt-[6px]">
          <p className="m-0 text-[16px] font-bold leading-[27px] text-[#5B5959]">Service Provider’s Note</p>
          <p className="m-0 max-w-[705px] whitespace-pre-line break-words text-[16px] leading-[27px] text-[#292727]">
            {update.notes}
          </p>
        </div>
      )}

      {update.attachments.length > 0 && (
        <div className="mt-[14px] flex flex-wrap gap-4 xl:gap-[47px]">
          {update.attachments.map((attachment, i) => (
            <Thumbnail
              key={attachment.id}
              attachment={attachment}
              onOpen={() => onOpenMedia(update.attachments, i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StepRow({ step, onOpenMedia }) {
  return (
    <li className="mb-[34px] flex items-start gap-[16px] last:mb-0">
      <StepDot state={step.state} />
      <div className="min-w-0 flex-1">
        <p className="m-0 text-[17px] font-bold leading-[34px] text-[#191818]">{step.label}</p>

        {step.updates.length > 0 ? (
          <div className="flex flex-col gap-[18px]">
            {step.updates.map((update) => (
              <UpdateEntry key={update.id} update={update} onOpenMedia={onOpenMedia} />
            ))}
            {step.paymentPending && (
              <p className="m-0 text-[16px] leading-[27px] text-[#292727]">Payment Pending</p>
            )}
          </div>
        ) : step.state !== 'pending' ? (
          // The backend marked the step done without a stored update record.
          <p className="m-0 text-[16px] leading-[27px] text-[#292727]">
            {step.paymentPending
              ? 'Payment Pending'
              : `The repair status was updated${step.updatedAt ? ` at ${formatLongDateTime(step.updatedAt)}.` : '.'}`}
          </p>
        ) : null}
      </div>
    </li>
  );
}

/* ------------------------------------ page ------------------------------------ */

export default function ViewRepairDetails() {
  const { requestId } = useParams();

  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewer, setViewer] = useState(null); // { items, index }
  const lastSignature = useRef('');
  const loadSeq = useRef(0);

  // GET /api/service-requests/:requestId/repair-details. `silent` = background refresh (no spinner,
  // keeps the current screen if it fails, and does nothing when nothing changed).
  const load = useCallback(
    async ({ silent = false } = {}) => {
      const seq = ++loadSeq.current;
      try {
        const raw = await getRepairDetails(requestId);
        if (seq !== loadSeq.current) return;
        const signature = JSON.stringify(raw);
        if (signature !== lastSignature.current) {
          lastSignature.current = signature;
          setDetails(mapDetails(raw || {}));
        }
        setError('');
      } catch (err) {
        if (seq !== loadSeq.current || silent) return;
        setError(err.message || 'Could not load the repair details. Please try again.');
      } finally {
        if (seq === loadSeq.current) setLoading(false);
      }
    },
    [requestId]
  );

  useEffect(() => {
    setLoading(true);
    setDetails(null);
    lastSignature.current = '';
    load();
    return () => {
      loadSeq.current += 1;
    };
  }, [load]);

  // New provider updates appear on their own; also refresh when coming back to this tab.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') load({ silent: true });
    };
    const timer = setInterval(refresh, POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [load]);

  const openMedia = useCallback((items, index) => setViewer({ items, index }), []);

  return (
    <CustomerSidebar>
      <div className="min-h-full bg-[#FAFAFA]">
        <div className="box-border px-[42px] pb-12 pt-[25px]">
          <h1 className="m-0 flex h-[68px] items-center font-[Quicksand] text-[48px] font-bold leading-[32px] text-[#005FCA]">
            My Requests
          </h1>

          <div className="pl-[16px] pt-[8px]" style={SF_PRO}>
            {loading ? (
              <p className="m-0 mt-4 text-[14px] text-[#7C7979]">Loading the repair details…</p>
            ) : error && !details ? (
              <p role="alert" className="m-0 mt-4 text-[14px] text-[#B91C1C]">
                {error}
              </p>
            ) : details ? (
              <>
                <div className="flex max-w-[1068px] items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="m-0 text-[20px] font-bold leading-[34px] text-[#292727]">
                      Request #{details.requestNumber}
                    </h2>
                    <p className="m-0 text-[17px] leading-[29px] text-[#5B5959]">{details.providerName}</p>
                  </div>
                  <span
                    className="mt-[6px] box-border inline-flex h-[24px] min-w-[104px] flex-none items-center justify-center whitespace-nowrap rounded-[20px] border border-[#B1A8A8] px-4 font-[Quicksand] text-[14px] font-medium leading-[24px] text-white"
                    style={{ backgroundColor: details.badgeColor }}
                  >
                    {details.badge}
                  </span>
                </div>

                {details.steps.length === 0 ? (
                  <p className="m-0 mt-8 text-[14px] text-[#7C7979]">
                    The service provider has not posted any repair updates yet.
                  </p>
                ) : (
                  <ol className="m-0 mt-[30px] max-w-[1068px] list-none p-0">
                    {details.steps.map((step) => (
                      <StepRow key={step.key} step={step} onOpenMedia={openMedia} />
                    ))}
                  </ol>
                )}
              </>
            ) : null}
          </div>
        </div>
      </div>

      {viewer && (
        <MediaViewer items={viewer.items} startIndex={viewer.index} onClose={() => setViewer(null)} />
      )}
    </CustomerSidebar>
  );
}