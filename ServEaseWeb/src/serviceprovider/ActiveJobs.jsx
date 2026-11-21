import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import ServiceProviderSidebar from '../components/ServiceProviderSidebar.jsx';
import {
  FilterDropdown,
  GRADIENT,
  ModalShell,
  NoticeModal,
  ReasonModal,
  SearchField,
  SF_PRO,
} from '../components/ProviderRequestUI.jsx';
import { useAuth } from '../context/auth_context';
import {
  acceptJobNegotiation,
  getProviderJobQuotations,
  getProviderJobs,
  getServiceCategories,
  notifyAdditionalParts,
  rejectJobNegotiation,
  updateProviderJobStatus,
} from '../api/client';
import pinIcon from '../assets/icon_pinloc.png';

// ----------------------------------------------------------------------------------------------
// Data (all of it comes from the backend)
//
// GET /api/provider/jobs -> { jobs: [{ id, requestNumber, customerName, createdAt, category,
//   status: 'Active' | 'Pending' | 'Done', aiSuggestion, aiConfidence,
//   stages: ['Assessing', ...], stageOptions: [{ value, label }], serviceLocationType: 'home' | 'shop',
//   currentStepLabel, paidTotal }] }
//   The stage list depends on the request: Shop-based = Assessing / Repairing / Quality Checking /
//   Completed, Home-based = Preparing / Service Provider is on the way / Arrived at the Customer's
//   location / Completed. The backend sends both the stored value and the label to show.
//
// GET /api/provider/jobs/quotations -> { quotations: [{ paymentRequestId, jobId, requestNumber,
//   customerName, createdAt, category, distanceKm, originalAmount, proposedAmount,
//   customerMessage, providerNotes }] }
//   = price negotiations: the customer answered an "additional parts" request with a counter-offer.
//
// POST /api/provider/jobs/:jobId/payment-requests/:id/negotiation/accept
// POST /api/provider/jobs/:jobId/payment-requests/:id/negotiation/reject   { reason }
//
// PATCH /api/provider/jobs/:jobId/status  (multipart/form-data)  — Update Status modal
//   fields: stage, notes, attachments (0..5 files, images and / or videos)
//   The backend saves the update (stage + notes + files) and notifies the customer. The customer
//   sees it right away in Track Requests (the step turns blue) and in View Repair Details
//   (GET /api/service-requests/:requestId/repair-details) with the notes and the images / videos.
// ----------------------------------------------------------------------------------------------

const POLL_INTERVAL_MS = 15000;

const TABS = [
  { key: 'ongoing', label: 'On-Going' },
  { key: 'quotation', label: 'Quotation' },
];

// Status dropdown (the default view is "Active", like the Figma frame).
const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  
];

// Button colours of the job card (Figma "Request - Active Jobs").
const UPDATE_BUTTON_BG = 'bg-[#577FBB]';
const NOTIFY_BUTTON_BG = 'bg-[#BBAE57]';

// Update Status attachments (Figma customer view shows up to 5 thumbnails per update).
const MAX_ATTACHMENTS = 5;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const formatMb = (bytes) => `${Math.round(bytes / (1024 * 1024))} MB`;

const sameText = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
const formatPesos = (n) => Number(n || 0).toLocaleString('en-US');

const formatDateLabel = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const toJobCard = (j) => {
  const stages = Array.isArray(j.stages) ? j.stages : [];
  const stageOptions =
    Array.isArray(j.stageOptions) && j.stageOptions.length
      ? j.stageOptions
      : stages.map((value) => ({ value, label: value }));
  const done = j.status === 'Done';
  const currentStage = j.currentStepLabel && j.currentStepLabel !== 'Not started' ? j.currentStepLabel : null;
  return {
    id: j.id,
    requestNumber: j.requestNumber || j.id,
    customerName: j.customerName,
    dateLabel: formatDateLabel(j.createdAt),
    category: j.category || '',
    done,
    awaitingCustomer: j.status === 'Pending', // quotation not accepted yet -> still under Incoming Requests
    stages: stageOptions.map((o) => o.value),
    stageOptions,
    currentStage, // stored value, e.g. "Quality Check"
    aiSuggestion: j.aiSuggestion
      ? { problem: j.aiSuggestion, confidencePercent: j.aiConfidence ?? null }
      : null,
    paidTotal: Number(j.paidTotal) > 0 ? Number(j.paidTotal) : 0,
  };
};

const labelOfStage = (job, stage) => job.stageOptions.find((o) => o.value === stage)?.label || stage;

const toQuotationCard = (q) => ({
  paymentRequestId: q.paymentRequestId,
  jobId: q.jobId || q.requestNumber,
  requestNumber: q.requestNumber || q.jobId,
  customerName: q.customerName,
  dateLabel: formatDateLabel(q.createdAt),
  category: q.category || '',
  distanceKm: q.distanceKm ?? null,
  originalAmount: q.originalAmount ?? null,
  proposedAmount: q.proposedAmount ?? null,
  customerMessage: q.customerMessage || '',
});

// ----------------------------------------------------------------------------------------------
// Small pieces
// ----------------------------------------------------------------------------------------------

function BoltIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <path d="M13 2L5 13.5h5.5L9 22l9-12.5h-5.7L13 2z" fill="#577FBB" />
    </svg>
  );
}

function ImageGlyph() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="2.5" y="3.5" width="19" height="17" rx="2.5" fill="#262728" />
      <circle cx="8.5" cy="9" r="1.8" fill="#fff" />
      <path d="M4 18l5-5.5 3.5 3.5 3-3L20.5 17v1.5H4z" fill="#fff" />
    </svg>
  );
}

const FIELD =
  'box-border rounded-[10px] border border-[#B1A8A8] bg-[#FFFDFD] text-[#292727] outline-none placeholder:text-[#B7B7B7]';
const MODAL_SUBMIT = `box-border flex h-[40px] w-full max-w-[300px] items-center justify-center rounded-[10px] border border-[#B1A8A8] ${GRADIENT} text-[15px] font-bold leading-[20px] text-white`;

// "Current stage" dropdown of the Update Status modal (185 x 40, list opens underneath).
function StageSelect({ value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={rootRef} className="relative w-[200px] max-w-full">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`${FIELD} relative z-20 flex h-[40px] w-full cursor-pointer items-center justify-between pl-[16px] pr-3 text-left text-[13px] leading-[20px]`}
      >
        <span className="truncate">{selected?.label || 'Select stage'}</span>
        <svg width="12" height="7" viewBox="0 0 14 8" aria-hidden="true" className="flex-none">
          <path d="M1 1l6 6 6-6" fill="none" stroke="#000" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute left-0 top-[32px] z-10 m-0 box-border w-full list-none rounded-b-[10px] border border-[#B1A8A8] bg-white px-0 pb-[8px] pt-[14px]"
        >
          {options.map((option) => (
            <li key={option.value} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={option.value === value}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`box-border block w-full cursor-pointer border-0 bg-transparent px-4 py-[5px] text-left text-[13px] leading-[20px] text-black hover:bg-[#F3F6FB] ${
                  option.value === value ? 'font-semibold' : 'font-normal'
                }`}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------------------------
// Modals
// ----------------------------------------------------------------------------------------------

// Upload area of the Update Status modal (Figma: 110px tall box with the picture glyph and
// "Upload Image"). Accepts images and videos; the chosen files show as thumbnails you can remove.
function AttachmentPicker({ files, onChange, onProblem, disabled }) {
  const inputRef = useRef(null);
  const [previews, setPreviews] = useState([]);

  useEffect(() => {
    const next = files.map((file) => ({
      file,
      url: URL.createObjectURL(file),
      isVideo: file.type.startsWith('video/'),
    }));
    setPreviews(next);
    return () => next.forEach((p) => URL.revokeObjectURL(p.url));
  }, [files]);

  const handlePick = (e) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = '';
    if (!picked.length) return;

    const accepted = [];
    let problem = '';
    for (const file of picked) {
      const isVideo = file.type.startsWith('video/');
      const isImage = file.type.startsWith('image/');
      if (!isImage && !isVideo) {
        problem = `${file.name} is not an image or a video.`;
        continue;
      }
      const limit = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
      if (file.size > limit) {
        problem = `${file.name} is too large. ${isVideo ? 'Videos' : 'Photos'} must be ${formatMb(limit)} or smaller.`;
        continue;
      }
      if (files.length + accepted.length >= MAX_ATTACHMENTS) {
        problem = `You can attach up to ${MAX_ATTACHMENTS} files per update.`;
        break;
      }
      accepted.push(file);
    }
    onProblem(problem);
    if (accepted.length) onChange([...files, ...accepted]);
  };

  const removeAt = (index) => {
    onProblem('');
    onChange(files.filter((_, i) => i !== index));
  };

  const openPicker = () => {
    if (!disabled) inputRef.current?.click();
  };

  return (
    <div className={`${FIELD} mt-[20px] box-border flex min-h-[110px] w-full items-center justify-center overflow-hidden`}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={handlePick}
      />

      {previews.length === 0 ? (
        <button
          type="button"
          onClick={openPicker}
          disabled={disabled}
          className="flex h-[110px] w-full cursor-pointer flex-col items-center justify-center gap-1 border-0 bg-transparent p-0"
        >
          <ImageGlyph />
          <span className="text-[8px] leading-[14px] text-[#292727]">Upload Image or Video</span>
        </button>
      ) : (
        <div className="flex w-full flex-wrap items-center gap-3 p-3">
          {previews.map((p, i) => (
            <div
              key={`${p.file.name}-${p.file.size}-${i}`}
              className="relative h-[84px] w-[84px] flex-none overflow-hidden rounded-[8px] border border-[#B1A8A8] bg-[#D9D9D9]"
            >
              {p.isVideo ? (
                <>
                  <video src={p.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25">
                    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M8 5v14l11-7z" fill="#fff" />
                    </svg>
                  </span>
                </>
              ) : (
                <img src={p.url} alt={p.file.name} className="h-full w-full object-cover" />
              )}
              <button
                type="button"
                aria-label={`Remove ${p.file.name}`}
                onClick={() => removeAt(i)}
                disabled={disabled}
                className="absolute right-[3px] top-[3px] flex h-[18px] w-[18px] cursor-pointer items-center justify-center rounded-full border-0 bg-black/70 p-0 text-[12px] leading-none text-white"
              >
                ×
              </button>
            </div>
          ))}
          {previews.length < MAX_ATTACHMENTS && (
            <button
              type="button"
              onClick={openPicker}
              disabled={disabled}
              className="flex h-[84px] w-[84px] flex-none cursor-pointer flex-col items-center justify-center gap-1 rounded-[8px] border border-dashed border-[#B1A8A8] bg-transparent p-0"
            >
              <ImageGlyph />
              <span className="text-[8px] leading-[10px] text-[#292727]">Add more</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Figma "Active Jobs - Update Status" (835 x 600).
function UpdateStatusModal({ job, onClose, onSubmitted }) {
  // Start on the step after the current one: that is what the provider is usually pushing.
  const initialStage = useMemo(() => {
    const index = job.currentStage ? job.stages.indexOf(job.currentStage) : -1;
    return job.stages[Math.min(index + 1, job.stages.length - 1)] ?? job.stages[0] ?? '';
  }, [job]);

  const [stage, setStage] = useState(initialStage);
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // PATCH /api/provider/jobs/:id/status (multipart: stage, notes, attachments[]).
  // The backend saves the update with its files and notifies the customer; the customer's
  // Track Requests and View Repair Details then show the new status, the note and the media.
  const handlePushUpdate = async () => {
    if (saving || !stage) return;
    setSaving(true);
    setError('');
    try {
      await updateProviderJobStatus(job.id, { stage, notes: notes.trim(), files });
      onSubmitted(stage);
      onClose();
    } catch (err) {
      setError(err.message || 'Could not push the update. Please try again.');
      setSaving(false);
    }
  };

  return (
    <ModalShell title="Update Status" onClose={saving ? () => {} : onClose} widthClass="max-w-[835px]">
      <div className="box-border px-6 pb-[39px] pt-[43px] sm:px-[45px]">
        <h2 className="m-0 text-[24px] font-bold leading-[32px] text-[#292727]">Update Status</h2>

        <p className="m-0 mt-[14px] text-[14px] font-normal leading-[20px] text-[#292727]">Current stage</p>
        <div className="mt-[13px]">
          <StageSelect value={stage} options={job.stageOptions} onChange={setStage} />
        </div>

        <p className="m-0 mt-[19px] text-[14px] font-normal leading-[20px] text-[#292727]">Notes</p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={1000}
          placeholder="Timeline, update, etc..."
          className={`${FIELD} mt-[11px] block h-[120px] w-full resize-none p-3 text-[12px] leading-[20px]`}
        />

        <AttachmentPicker files={files} onChange={setFiles} onProblem={setError} disabled={saving} />

        {error && (
          <p role="alert" className="m-0 mt-3 text-[12px] text-[#B91C1C]">
            {error}
          </p>
        )}

        <div className="mt-[43px] flex justify-center">
          <button
            type="button"
            onClick={handlePushUpdate}
            disabled={saving || !stage}
            className={`${MODAL_SUBMIT} ${saving ? 'cursor-wait opacity-70' : 'cursor-pointer'}`}
          >
            {saving ? (files.length ? 'Uploading…' : 'Sending…') : 'Push Update'}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// Figma "Active Jobs - Notify Additional Parts" (835 x 500).
function NotifyPartsModal({ job, onClose, onSent }) {
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // POST /api/provider/jobs/:id/additional-parts — the backend creates a payment
  // request and notifies the customer, who approves, declines or negotiates it in Track Requests.
  const handleSend = async () => {
    const additionalCost = Number(cost);
    if (saving) return;
    if (!Number.isFinite(additionalCost) || additionalCost <= 0) {
      setError('Enter a valid cost first.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await notifyAdditionalParts(job.id, { additionalCost, notes: notes.trim() });
      onSent();
      onClose();
    } catch (err) {
      setError(err.message || 'Could not send the request. Please try again.');
      setSaving(false);
    }
  };

  return (
    <ModalShell title="Notify Additional Parts" onClose={saving ? () => {} : onClose} widthClass="max-w-[835px]">
      <div className="box-border px-6 pb-[33px] pt-[26px] sm:px-[43px]">
        <h2 className="m-0 text-[24px] font-bold leading-[32px] text-[#292727]">Notify Additional Parts</h2>
        <p className="m-0 mt-[25px] text-[15px] font-bold leading-[22px] text-[#292727]">
          Explain the unexpected additional parts to the customer.
        </p>

        <p className="m-0 mt-[22px] text-[14px] font-normal leading-[20px] text-[#292727]">Additional Cost (Peso)</p>
        <input
          type="number"
          min="0"
          step="any"
          inputMode="decimal"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          placeholder="0.00"
          className={`${FIELD} mt-[15px] block h-[50px] w-[180px] max-w-full px-4 text-[12px] leading-[20px]`}
        />

        <p className="m-0 mt-[16px] text-[14px] font-normal leading-[20px] text-[#292727]">Notes</p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Timeline, update, etc..."
          className={`${FIELD} mt-[16px] block h-[110px] w-full resize-none p-3 text-[12px] leading-[20px]`}
        />

        {error && (
          <p role="alert" className="m-0 mt-3 text-[12px] text-[#B91C1C]">
            {error}
          </p>
        )}

        <div className="mt-[53px] flex justify-center">
          <button
            type="button"
            onClick={handleSend}
            disabled={saving}
            className={`${MODAL_SUBMIT} ${saving ? 'cursor-wait opacity-70' : 'cursor-pointer'}`}
          >
            {saving ? 'Sending…' : 'Send Request'}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// ----------------------------------------------------------------------------------------------
// Cards
// ----------------------------------------------------------------------------------------------

const CARD_BASE = `relative box-border w-full max-w-[1070px] rounded-[10px] border border-[#818080] bg-white ${SF_PRO} text-[#5B5959]`;

function JobCard({ job, onUpdate, onNotify }) {
  const stageIndex = job.done ? job.stages.length : job.currentStage ? job.stages.indexOf(job.currentStage) : -1;
  const badge = job.done ? { label: 'Completed', bg: 'bg-[#0255AF]' } : { label: 'In Progress', bg: 'bg-[#62BB57]' };

  return (
    <article className={`${CARD_BASE} pb-[30px] pt-[10px]`}>
      <span
        className={`absolute right-[18px] top-[15px] box-border flex h-[22px] w-[96px] items-center justify-center rounded-full border border-[#B1A8A8] font-[Quicksand] text-[10px] font-medium leading-[17px] text-white ${badge.bg}`}
      >
        {badge.label}
      </span>

      <div className="px-[19px]">
        <p className="m-0 text-[13px] font-bold leading-[22px] text-[#292727]">Request #{job.requestNumber}</p>
        <p className="m-0 text-[9px] font-normal leading-[15px]">
          {job.customerName} | {job.dateLabel}
        </p>
      </div>

      {job.aiSuggestion && (
        <div className="mx-[19px] mt-[12px] box-border flex h-[37px] items-center rounded-[10px] bg-[#262728] pl-[19px] text-[9px] font-normal leading-[15px] text-white">
          <BoltIcon />
          <span className="ml-[8px]">
            AI suggests {job.aiSuggestion.problem}
            {job.aiSuggestion.confidencePercent != null ? ` (${job.aiSuggestion.confidencePercent}% confidence)` : ''}
          </span>
        </div>
      )}

      <hr className="mx-[18px] mb-0 mt-[12px] border-0 border-t border-black/40" />

      <div className="mt-[15px] flex gap-[17px] px-[21px]">
        {job.stageOptions.map((option, i) => (
          <div
            key={option.value}
            title={option.label}
            className={`h-2 max-w-[119px] flex-1 rounded-[10px] ${
              i < stageIndex ? 'bg-[#62BB57]' : i === stageIndex ? 'bg-[#577FBB]' : 'bg-[#D9D9D9]'
            }`}
          />
        ))}
      </div>

      <p className="m-0 mt-[10px] px-[19px] text-[9px] font-bold leading-[15px]">
        Current Step: {job.currentStage ? labelOfStage(job, job.currentStage) : 'Not started'}
      </p>
      {job.paidTotal > 0 && (
        <p className="m-0 mt-[3px] px-[19px] text-[9px] font-normal leading-[15px]">
          Progress Payment ₱{formatPesos(job.paidTotal)} already paid by customer
        </p>
      )}

      {!job.done && (
        <div className="mt-[13px] flex flex-wrap justify-end gap-[37px] px-[34px]">
          <button
            type="button"
            onClick={() => onUpdate(job)}
            className={`box-border h-[40px] w-[160px] cursor-pointer rounded-[10px] border border-[#B1A8A8] ${UPDATE_BUTTON_BG} p-0 text-[10px] font-bold leading-[17px] text-white`}
          >
            Update Status
          </button>
          <button
            type="button"
            onClick={() => onNotify(job)}
            className={`box-border h-[40px] w-[160px] cursor-pointer rounded-[10px] border border-[#B1A8A8] ${NOTIFY_BUTTON_BG} p-0 text-[10px] font-bold leading-[17px] text-white`}
          >
            Notify Additional Parts
          </button>
        </div>
      )}
    </article>
  );
}

// Quotations section: the customer's counter-offer on an additional-parts request.
function NegotiationCard({ quotation, busy, onAccept, onDecline }) {
  const amount = quotation.proposedAmount ?? quotation.originalAmount;
  return (
    <article className={`${CARD_BASE} pb-[20px] pt-[10px]`}>
      <span className="absolute right-[25px] top-[11px] box-border flex h-[20px] w-[114px] items-center justify-center rounded-full border border-[#B1A8A8] bg-[#BB8157] font-[Quicksand] text-[10px] font-medium leading-[17px] text-white">
        Price Negotiation
      </span>

      <div className="px-[22px]">
        <p className="m-0 text-[13px] font-bold leading-[22px] text-[#292727]">Request #{quotation.requestNumber}</p>
        <p className="m-0 text-[9px] font-normal leading-[15px]">
          {quotation.customerName} | {quotation.dateLabel}
        </p>
        {quotation.distanceKm != null && (
          <div className="mt-[5px] flex items-center gap-[6px]">
            <img src={pinIcon} alt="" className="h-[13px] w-[10px] flex-none object-contain" />
            <span className="text-[9px] font-normal leading-[15px]">{quotation.distanceKm} km away</span>
          </div>
        )}
      </div>

      <div className="mt-[7px] flex items-end justify-between gap-3 px-[22px]">
        <p className="m-0 text-[9px] font-bold leading-[15px]">
          The customer wants to revise the price with a suggested amount:
        </p>
        {quotation.originalAmount != null && (
          <p className="m-0 mr-[13px] text-[9px] font-normal leading-[15px]">
            Original request: ₱{formatPesos(quotation.originalAmount)}
          </p>
        )}
      </div>

      <div className="mx-[19px] mt-[2px] box-border flex min-h-[58px] items-center justify-between gap-4 rounded-[10px] border border-[#B1A8A8] bg-[#FFFED3] px-[18px] py-2">
        <div className="min-w-0">
          <p className="m-0 text-[10px] font-bold leading-[17px] text-[#BB8157]">Customer Message</p>
          <p className="m-0 break-words text-[9px] font-normal leading-[15px] text-[#5B5959]">
            {quotation.customerMessage || 'The customer did not leave a message.'}
          </p>
        </div>
        <div className="flex-none text-right">
          <p className="m-0 text-[13px] font-bold leading-[20px] text-[#292727]">₱ {formatPesos(amount)}</p>
          <p className="m-0 text-[9px] font-normal leading-[15px]">due for approval</p>
        </div>
      </div>

      <hr className="mx-[23px] mb-0 mt-[19px] border-0 border-t border-black/40" />

      <div className="mt-[17px] flex flex-wrap justify-end gap-[22px] px-[23px]">
        <Link
          to="/serviceprovider/messages"
          state={{ requestId: quotation.requestNumber }}
          className="box-border flex h-[40px] w-[110px] items-center justify-center rounded-[10px] border border-[#B1A8A8] bg-[#FFFDFD] text-[12px] font-bold leading-[20px] text-[#414141] no-underline"
        >
          Message
        </Link>
        <button
          type="button"
          disabled={busy}
          onClick={() => onDecline(quotation)}
          className={`box-border h-[40px] w-[110px] rounded-[10px] border border-[#B1A8A8] bg-[#C62828] p-0 text-[12px] font-bold leading-[20px] text-white ${
            busy ? 'cursor-wait opacity-60' : 'cursor-pointer'
          }`}
        >
          Decline
        </button>
        <button
          type="button"
          disabled={busy || quotation.proposedAmount == null}
          onClick={() => onAccept(quotation)}
          className={`box-border h-[40px] w-[110px] rounded-[10px] border border-[#B1A8A8] bg-[#167713] p-0 text-[12px] font-bold leading-[20px] text-white ${
            busy ? 'cursor-wait opacity-60' : 'cursor-pointer'
          }`}
        >
          {busy ? 'Saving…' : 'Accept'}
        </button>
      </div>
    </article>
  );
}

// ----------------------------------------------------------------------------------------------
// Screen
// ----------------------------------------------------------------------------------------------

export default function ActiveJobs() {
  const { user, loading: authLoading } = useAuth();

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');
  const [tab, setTab] = useState('ongoing');

  const [jobs, setJobs] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [backendCategories, setBackendCategories] = useState([]);
  const [loadState, setLoadState] = useState('loading'); // 'loading' | 'done' | 'error'

  const [modal, setModal] = useState(null); // { type: 'update' | 'notify', jobId } | { type: 'decline', quotation } | { type: 'accepted' }
  const [busyId, setBusyId] = useState(null);
  const [decisionSaving, setDecisionSaving] = useState(false);
  const [decisionError, setDecisionError] = useState('');
  const [pageError, setPageError] = useState('');
  const [notice, setNotice] = useState('');
  const noticeTimer = useRef(null);
  const modalOpenRef = useRef(false);
  modalOpenRef.current = Boolean(modal);

  // Jobs (GET /api/provider/jobs) + price negotiations (GET /api/provider/jobs/quotations).
  // The quotations call is allowed to fail on its own so the jobs still show.
  const loadAll = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoadState('loading');
    const [jobsResult, quotationsResult] = await Promise.allSettled([
      getProviderJobs(),
      getProviderJobQuotations(),
    ]);
    if (jobsResult.status === 'fulfilled') {
      setJobs((jobsResult.value?.jobs ?? []).map(toJobCard));
      setLoadState('done');
    } else if (!silent) {
      console.error('Failed to load jobs', jobsResult.reason);
      setLoadState('error');
    }
    if (quotationsResult.status === 'fulfilled') {
      setQuotations((quotationsResult.value?.quotations ?? []).map(toQuotationCard));
    } else if (!silent) {
      console.error('Failed to load price negotiations', quotationsResult.reason);
    }
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    loadAll();
    // New negotiations from customers appear without a page refresh.
    const timer = setInterval(() => {
      if (!modalOpenRef.current) loadAll({ silent: true });
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [user, loadAll]);

  // Category choices come from the backend (GET /api/categories).
  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    getServiceCategories()
      .then((data) => {
        if (!cancelled) setBackendCategories((data?.categories || []).map((c) => c.label));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => () => clearTimeout(noticeTimer.current), []);

  const categoryOptions = useMemo(() => {
    const labels = [...backendCategories];
    [...jobs, ...quotations].forEach((item) => {
      if (item.category && !labels.some((l) => sameText(l, item.category))) labels.push(item.category);
    });
    return [{ value: 'all', label: 'All' }, ...labels.map((label) => ({ value: label, label }))];
  }, [backendCategories, jobs, quotations]);

  const matchesSearch = useCallback(
    (values) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return values.filter(Boolean).some((value) => String(value).toLowerCase().includes(q));
    },
    [search]
  );

  const visibleJobs = useMemo(
    () =>
      jobs.filter((job) => {
        if (job.awaitingCustomer) return false; // not a repair yet: the customer has not accepted the quotation
        if (statusFilter === 'active' && job.done) return false;
        if (statusFilter === 'completed' && !job.done) return false;
        if (category !== 'all' && !sameText(job.category, category)) return false;
        return matchesSearch([
          job.requestNumber,
          job.customerName,
          job.category,
          job.aiSuggestion?.problem,
          job.currentStage ? labelOfStage(job, job.currentStage) : '',
        ]);
      }),
    [jobs, statusFilter, category, matchesSearch]
  );

  const visibleQuotations = useMemo(
    () =>
      quotations.filter((q) => {
        if (category !== 'all' && !sameText(q.category, category)) return false;
        return matchesSearch([q.requestNumber, q.customerName, q.category, q.customerMessage]);
      }),
    [quotations, category, matchesSearch]
  );

  const activeJob = modal && (modal.type === 'update' || modal.type === 'notify')
    ? jobs.find((j) => j.id === modal.jobId)
    : null;
  const closeModal = () => setModal(null);

  const flash = (message) => {
    setNotice(message);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(''), 6000);
  };

  // Accept the customer's suggested amount: the additional payment becomes that amount.
  const handleAccept = async (quotation) => {
    setBusyId(quotation.paymentRequestId);
    setPageError('');
    try {
      await acceptJobNegotiation(quotation.jobId, quotation.paymentRequestId);
      setModal({ type: 'accepted' });
      await loadAll({ silent: true });
    } catch (err) {
      setPageError(err.message || "Couldn't accept the negotiated amount. Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  // Decline the customer's suggestion with a reason (the original amount stays up to the customer).
  const handleDecline = async ({ reason }) => {
    const quotation = modal?.quotation;
    if (!quotation) return;
    setDecisionSaving(true);
    setDecisionError('');
    try {
      await rejectJobNegotiation(quotation.jobId, quotation.paymentRequestId, { reason });
      setModal(null);
      flash(`You declined the suggested amount for Request #${quotation.requestNumber}.`);
      await loadAll({ silent: true });
    } catch (err) {
      setDecisionError(err.message || "Couldn't send your response. Please try again.");
    } finally {
      setDecisionSaving(false);
    }
  };

  // Wait while the saved login is being restored, then require a logged-in provider.
  if (authLoading) return null;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <ServiceProviderSidebar>
      <div className="box-border px-4 pb-10 pt-[25px] sm:px-[52px]">
        <h1 className="m-0 flex h-[68px] items-center font-[Quicksand] text-[32px] font-bold leading-[32px] text-[#005FCA] sm:text-[40px] lg:text-[48px]">
          Active Jobs
        </h1>

        {/* Search + Categories + Status (Figma: 699px search, two 173px dropdowns) */}
        <div className="relative z-30 mt-[17px] flex max-w-[1070px] flex-wrap items-start gap-x-[15px] gap-y-3">
          <SearchField value={search} onChange={setSearch} placeholder="Search job details" />
          <div className="flex flex-wrap gap-2">
            <FilterDropdown
              ariaLabel="Filter by category"
              options={categoryOptions}
              value={category}
              onChange={setCategory}
            />
            <FilterDropdown
              ariaLabel="Filter by status"
              options={STATUS_OPTIONS}
              value={statusFilter}
              onChange={setStatusFilter}
            />
          </div>
        </div>

        {/* On-going | Quotation */}
        <div className="mt-[18px] flex max-w-[1070px]" role="tablist">
          {TABS.map((item) => {
            const isActive = tab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setTab(item.key)}
                className="flex flex-1 cursor-pointer flex-col items-stretch border-0 bg-transparent p-0"
              >
                <span
                  className={`flex h-[29px] items-center justify-center gap-2 font-[Quicksand] text-[17px] leading-[29px] text-[#292727] ${
                    isActive ? 'font-bold' : 'font-medium'
                  }`}
                >
                  {item.label}
                  {item.key === 'quotation' && quotations.length > 0 && (
                    <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#BB8157] px-[5px] text-[10px] font-bold leading-none text-white">
                      {quotations.length}
                    </span>
                  )}
                </span>
                <span
                  className={`mt-[10px] block h-[3px] w-full rounded-[10px] ${isActive ? 'bg-[#18315B]' : 'bg-[#D9D9D9]'}`}
                />
              </button>
            );
          })}
        </div>

        {notice && (
          <p role="status" className="m-0 mt-4 font-[Roboto] text-[14px] font-medium text-[#167713]">
            {notice}
          </p>
        )}
        {pageError && (
          <p role="alert" className="m-0 mt-4 font-[Roboto] text-[14px] font-medium text-[#B91C1C]">
            {pageError}
          </p>
        )}

        <div className="relative z-0 mt-[27px] flex flex-col gap-4">
          {loadState === 'loading' && (
            <p className="m-0 py-10 font-[Roboto] text-[14px] text-[#817C7C]">Loading your jobs…</p>
          )}
          {loadState === 'error' && (
            <p role="alert" className="m-0 py-10 font-[Roboto] text-[14px] text-[#B91C1C]">
              Could not load your jobs. Please try again.
            </p>
          )}

          {loadState === 'done' && tab === 'ongoing' && (
            <>
              {visibleJobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onUpdate={(j) => setModal({ type: 'update', jobId: j.id })}
                  onNotify={(j) => setModal({ type: 'notify', jobId: j.id })}
                />
              ))}
              {visibleJobs.length === 0 && (
                <p className="m-0 py-10 font-[Roboto] text-[14px] text-[#817C7C]">No jobs found.</p>
              )}
            </>
          )}

          {loadState === 'done' && tab === 'quotation' && (
            <>
              {visibleQuotations.map((quotation) => (
                <NegotiationCard
                  key={quotation.paymentRequestId}
                  quotation={quotation}
                  busy={busyId === quotation.paymentRequestId}
                  onAccept={handleAccept}
                  onDecline={(q) => {
                    setDecisionError('');
                    setModal({ type: 'decline', quotation: q });
                  }}
                />
              ))}
              {visibleQuotations.length === 0 && (
                <p className="m-0 py-10 font-[Roboto] text-[14px] text-[#817C7C]">
                  No price negotiations from customers yet.
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {modal?.type === 'update' && activeJob && (
        <UpdateStatusModal
          job={activeJob}
          onClose={closeModal}
          onSubmitted={(stage) => {
            flash(
              `Request #${activeJob.requestNumber} was updated to ${labelOfStage(activeJob, stage)}. The customer can now see it.`
            );
            loadAll({ silent: true });
          }}
        />
      )}
      {modal?.type === 'notify' && activeJob && (
        <NotifyPartsModal
          job={activeJob}
          onClose={closeModal}
          onSent={() => flash(`Your additional parts request for Request #${activeJob.requestNumber} was sent.`)}
        />
      )}
      {modal?.type === 'decline' && (
        <ReasonModal
          onClose={() => !decisionSaving && closeModal()}
          onSubmit={handleDecline}
          isSaving={decisionSaving}
          error={decisionError}
        />
      )}
      {modal?.type === 'accepted' && (
        <NoticeModal
          title="Price Negotiated"
          message="Your additional payment request has been updated."
          onConfirm={closeModal}
        />
      )}
    </ServiceProviderSidebar>
  );
}