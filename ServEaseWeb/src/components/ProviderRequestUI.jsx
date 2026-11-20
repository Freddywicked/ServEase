// Shared building blocks for the service provider's request screens:
//   IncomingServiceRequest.jsx, ServiceRequestDetails.jsx and ActiveJobs.jsx.
// Everything here is presentation only: all data and every action is passed in by the screens,
// which get it from the backend (api/client.js).
import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';

export const SF_PRO = 'font-[SF_Pro,system-ui,sans-serif]';
export const INTER = 'font-[Inter,system-ui,sans-serif]';
export const GRADIENT = 'bg-gradient-to-r from-[#0255AF] to-[#04A5A5]';

const FIELD =
  'box-border rounded-[6px] border border-[#B1A8A8] bg-[#FFFDFD] text-[#292727] outline-none placeholder:text-[#B7B7B7]';

// ---------------------------------------------------------------------------------------------
// Search bar + dropdown (Figma: 699x49 search, 173x49 dropdowns, 14px radius, #7E7A7A border)
// ---------------------------------------------------------------------------------------------

export function SearchField({ value, onChange, placeholder }) {
  return (
    <label
      className={`relative box-border block h-[49px] min-w-[240px] flex-1 basis-[300px] max-w-[699px] ${INTER}`}
    >
      <Search
        size={19}
        strokeWidth={2.2}
        color="#393939"
        aria-hidden="true"
        className="pointer-events-none absolute left-[22px] top-1/2 -translate-y-1/2"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="box-border h-full w-full rounded-[14px] border border-[#7E7A7A] bg-white pl-[67px] pr-4 text-[16px] font-medium leading-[24px] tracking-[-0.3125px] text-[#292727] outline-none placeholder:text-[#718096]"
      />
    </label>
  );
}

function Chevron({ open }) {
  return (
    <svg
      width="14"
      height="8"
      viewBox="0 0 14 8"
      aria-hidden="true"
      className={`flex-none transition-transform ${open ? 'rotate-180' : ''}`}
    >
      <path d="M1 1l6 6 6-6" fill="none" stroke="#000" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

// options: [{ value, label }]. `placeholder` is what the closed button shows while `emptyValue`
// is selected (Figma shows "Categories" until a category is picked).
export function FilterDropdown({
  options,
  value,
  onChange,
  placeholder,
  emptyValue = 'all',
  ariaLabel,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);
  const buttonLabel = placeholder && value === emptyValue ? placeholder : selected?.label ?? placeholder ?? '';

  return (
    <div ref={rootRef} className={`relative h-[49px] w-[173px] flex-none ${INTER}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        className="relative z-20 box-border flex h-[49px] w-full cursor-pointer items-center justify-between rounded-[14px] border border-[#7E7A7A] bg-white pl-5 pr-[18px] text-left"
      >
        <span className="truncate text-[14px] font-semibold leading-[24px] tracking-[-0.3125px] text-[#484040]">
          {buttonLabel}
        </span>
        <Chevron open={open} />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute left-0 top-[36px] z-10 m-0 box-border max-h-[320px] w-full list-none overflow-y-auto rounded-b-[14px] rounded-t-[1px] border border-[#B4A9A9] bg-white px-0 pb-[14px] pt-[26px]"
        >
          {options.map((option) => (
            <li key={option.value} role="presentation" className="mt-[7px] first:mt-0">
              <button
                type="button"
                role="option"
                aria-selected={option.value === value}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`box-border block w-full cursor-pointer border-0 bg-transparent px-5 py-0 text-left text-[14px] leading-[24px] tracking-[-0.3125px] text-[#484040] hover:bg-[#F3F6FB] ${
                  option.value === value ? 'font-semibold' : 'font-medium'
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

// ---------------------------------------------------------------------------------------------
// Modals (Figma: white 10px-radius card, #818080 border, rgba(0,0,0,.35) backdrop, 15px X)
// ---------------------------------------------------------------------------------------------

export function ModalShell({ title, onClose, widthClass = 'max-w-[500px]', closeLabel = 'Close', children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/35 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`relative box-border w-full ${widthClass} rounded-[10px] border border-[#818080] bg-white ${SF_PRO} text-[#414141]`}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className="absolute right-[27px] top-[15px] flex cursor-pointer border-0 bg-transparent p-0 text-black"
        >
          <X size={17} strokeWidth={2.4} />
        </button>
        {children}
      </div>
    </div>
  );
}

function ModalError({ message }) {
  if (!message) return null;
  return (
    <p role="alert" className="m-0 mt-2 text-[11px] leading-[15px] text-[#B91C1C]">
      {message}
    </p>
  );
}

const SUBMIT_BUTTON = `box-border flex h-[40px] w-full max-w-[265px] items-center justify-center rounded-[10px] border border-[#B1A8A8] ${GRADIENT} font-bold text-white`;

// "Service Request Approved" popup: the provider sends the pre-repair quotation (500 x 375).
export function QuotationModal({ onClose, onSubmit, isSaving, error }) {
  const [labor, setLabor] = useState('');
  const [parts, setParts] = useState('');
  const [notes, setNotes] = useState('');

  const laborValue = Number(labor) || 0;
  const partsValue = Number(parts) || 0;
  const valid = laborValue >= 0 && partsValue >= 0 && laborValue + partsValue > 0;
  const canSend = valid && !isSaving;

  return (
    <ModalShell title="Service Request Approved" onClose={onClose}>
      <div className="box-border px-[19px] pb-[27px] pt-[25px]">
        <h2 className="m-0 text-[15px] font-bold leading-[26px] text-[#414141]">Service Request Approved</h2>
        <p className="m-0 mt-[9px] text-[12px] font-normal leading-[20px] text-[#5B5959]">
          Send a pre-repair quotation to the customer.
        </p>

        <div className="mt-4 flex flex-wrap gap-x-[45px] gap-y-2">
          <label className="block">
            <span className="block text-[8px] leading-[14px] text-[#5B5959]">Labor (Peso)</span>
            <input
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={labor}
              onChange={(e) => setLabor(e.target.value)}
              placeholder="0.00"
              className={`${FIELD} mt-[3px] h-[36px] w-[100px] px-3 text-[10px] leading-[17px]`}
            />
          </label>
          <label className="block">
            <span className="block text-[8px] leading-[14px] text-[#5B5959]">Parts (Peso)</span>
            <input
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={parts}
              onChange={(e) => setParts(e.target.value)}
              placeholder="0.00"
              className={`${FIELD} mt-[3px] h-[36px] w-[101px] px-3 text-[10px] leading-[17px]`}
            />
          </label>
        </div>

        <label className="mt-[18px] block">
          <span className="block text-[8px] leading-[14px] text-[#5B5959]">Notes</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Parts needed, timeline....."
            className={`${FIELD} mt-[6px] block h-[93px] w-full resize-none p-3 text-[10px] leading-[17px]`}
          />
        </label>

        <ModalError message={error} />

        <div className="mt-[26px] flex justify-center">
          <button
            type="button"
            disabled={!canSend}
            onClick={() => onSubmit({ laborPrice: laborValue, itemPrice: partsValue, notes: notes.trim() })}
            className={`${SUBMIT_BUTTON} text-[10px] leading-[17px] ${
              canSend ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
            }`}
          >
            {isSaving ? 'Sending…' : 'Send Quotation'}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// "Reason for Rejection" popup (500 x 350). Used for declining a request and for rejecting a
// customer's price negotiation.
export function ReasonModal({
  onClose,
  onSubmit,
  isSaving,
  error,
  title = 'Reason for Rejection',
  subtitle = 'State a proper reason for rejection.',
  placeholder = 'Enter your reason here.',
  submitLabel = 'Send',
}) {
  const [reason, setReason] = useState('');
  const canSend = reason.trim() !== '' && !isSaving;

  return (
    <ModalShell title={title} onClose={onClose}>
      <div className="box-border px-3 pb-[36px] pt-[17px]">
        <h2 className="m-0 pl-[3px] text-[15px] font-bold leading-[26px] text-[#414141]">{title}</h2>
        <p className="m-0 mt-[10px] pl-[3px] text-[11px] font-normal leading-[19px] text-[#5B5959]">{subtitle}</p>

        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={placeholder}
          maxLength={500}
          className={`${FIELD} mt-[13px] block h-[150px] w-full resize-none p-3 text-[12px] leading-[20px]`}
        />

        <ModalError message={error} />

        <div className="mt-[38px] flex justify-center">
          <button
            type="button"
            disabled={!canSend}
            onClick={() => onSubmit({ reason: reason.trim() })}
            className={`${SUBMIT_BUTTON} text-[12px] leading-[20px] ${
              canSend ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
            }`}
          >
            {isSaving ? 'Sending…' : submitLabel}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// Small confirmation popup (345 x 230), e.g. "Price Negotiated".
export function NoticeModal({ title, message, buttonLabel = 'Confirm', onConfirm }) {
  return (
    <ModalShell title={title} onClose={onConfirm} widthClass="max-w-[345px]">
      <div className="box-border px-4 pb-[32px] pt-[40px] text-center">
        <h2 className="m-0 text-[13px] font-bold leading-[22px] text-[#414141]">{title}</h2>
        <p className="m-0 mt-[14px] text-[13px] font-normal leading-[22px] text-[#414141]">{message}</p>
        <div className="mt-[40px] flex justify-center">
          <button
            type="button"
            onClick={onConfirm}
            className={`${SUBMIT_BUTTON} h-[44px] cursor-pointer text-[12px] leading-[20px]`}
          >
            {buttonLabel}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}