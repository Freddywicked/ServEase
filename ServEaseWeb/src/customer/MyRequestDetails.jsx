import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, X } from 'lucide-react';
import CustomerSidebar from '../components/CustomerSidebar';
// import { api } from '../api/client'; // BACKEND: use whichever request helper ../api/client exports

/* =====================================================================================
   BACKEND INTEGRATION (READY) — My Requests > quotation details (customer)
   Route: /customer/requests/:requestId
   -------------------------------------------------------------------------------------
   Everything is hard-coded (MOCK_REQUEST below). Replace it with the API response and
   swap the TODO lines inside the handlers.

   1) Load the quotation
      GET /api/customer/requests/:requestId
      -> { id, providerName, quotation: { reason, items: [{ label, amount }], total } }
         (same shape as MOCK_REQUEST)

      const { requestId } = useParams();
      const [request, setRequest] = useState(null);
      useEffect(() => {
        let cancelled = false;
        api.get(`/customer/requests/${requestId}`)
          .then((res) => { if (!cancelled) setRequest(res.data); })
          .catch((err) => console.error('Failed to load request', err));
        return () => { cancelled = true; };
      }, [requestId]);

   2) Approve
      POST /api/customer/requests/:requestId/quotation/approve
      -> { amountDue }   // the 20% initial fee, passed to the Payment screen

   3) Decline
      POST /api/customer/requests/:requestId/quotation/decline    body: { reason }
   ===================================================================================== */

const INITIAL_FEE_RATE = 0.2; // initial fee = 20% of the quotation total

// HARD-CODED DATA — replace with the API response.
const MOCK_REQUEST = {
  id: 'SR-0001',
  providerName: 'Micco Dominic',
  quotation: {
    reason: 'This sentence states the reason to justify the labor.',
    items: [{ label: 'Labor', amount: 850 }],
    total: 850,
  },
};

const formatAmount = (n) =>
  n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ------------------------------------ small UI parts ------------------------------------ */

function SmallButton({ children, onClick, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-[26px] cursor-pointer rounded-[8px] border border-[#B1A8A8] bg-[#FFFDFD] px-4 font-[Inter] text-[11px] font-bold text-[#414141] hover:bg-[#F3F3F3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0255AF] ${className}`}
    >
      {children}
    </button>
  );
}

function OutlineButton({ children, onClick, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-[46px] w-[150px] cursor-pointer rounded-[10px] border border-[#B1A8A8] bg-[#FFFDFD] font-[Inter] text-[15px] font-bold text-[#414141] hover:bg-[#F3F3F3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0255AF] ${className}`}
    >
      {children}
    </button>
  );
}

/* ------------------------------------ modals ------------------------------------ */

function Modal({ onClose, titleId, widthClass, children }) {
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative box-border w-full rounded-[8px] bg-white shadow-[0_4px_16px_rgba(0,0,0,0.2)] ${widthClass}`}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 flex cursor-pointer items-center justify-center border-none bg-transparent p-0"
        >
          <X size={20} color="#000" />
        </button>
        {children}
      </div>
    </div>
  );
}

function ApproveModal({ onClose, onProceed }) {
  return (
    <Modal onClose={onClose} titleId="approve-title" widthClass="max-w-[344px]">
      <div className="flex flex-col items-center px-8 pb-6 pt-9 text-center">
        <h2
          id="approve-title"
          className="m-0 font-[Inter] text-[15px] font-bold leading-[20px] text-[#292727]"
        >
          Service Request Approved
        </h2>
        <p className="m-0 mt-3 font-[Inter] text-[12px] leading-[18px] text-[#5B5959]">
          You are required to pay the initial fee which is 20% of the total service repair cost.
        </p>
        <SmallButton className="mt-5" onClick={onProceed}>
          Proceed to Payment
        </SmallButton>
      </div>
    </Modal>
  );
}

function DeclineModal({ reason, onReasonChange, onClose, onConfirm }) {
  const canConfirm = reason.trim().length > 0;
  return (
    <Modal onClose={onClose} titleId="decline-title" widthClass="max-w-[425px]">
      <div className="px-[34px] pb-6 pt-[46px]">
        <label
          id="decline-title"
          htmlFor="reject-reason"
          className="font-[Inter] text-[15px] font-bold leading-[20px] text-[#292727]"
        >
          Reason for rejection
        </label>
        <textarea
          id="reject-reason"
          autoFocus
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          className="mt-3 box-border block h-[236px] w-full resize-none rounded-[4px] border border-[#818080] bg-white p-3 font-[Inter] text-[14px] text-[#292727] outline-none focus:border-[#0255AF]"
        />
        <div className="mt-4 flex justify-end">
          <SmallButton
            onClick={canConfirm ? onConfirm : undefined}
            className={canConfirm ? '' : 'cursor-not-allowed opacity-50 hover:bg-[#FFFDFD]'}
          >
            Confirm
          </SmallButton>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------ page ------------------------------------ */

export default function MyRequestDetails() {
  const navigate = useNavigate();
  const { requestId } = useParams();

  // BACKEND: replace with the fetched request (see block at the top).
  const request = { ...MOCK_REQUEST, id: requestId || MOCK_REQUEST.id };
  const { quotation } = request;

  const [modal, setModal] = useState(null); // null | 'approve' | 'decline'
  const [rejectReason, setRejectReason] = useState('');

  const handleBack = () => navigate('/customer/requests');

  const handleApprove = async () => {
    // TODO: const { data } = await api.post(`/customer/requests/${request.id}/quotation/approve`);
    setModal('approve');
  };

  const handleProceedToPayment = () => {
    const initialFee = quotation.total * INITIAL_FEE_RATE; // BACKEND: use data.amountDue
    setModal(null);
    navigate(`/customer/requests/${request.id}/payment`, {
      state: { requestId: request.id, amount: initialFee, paymentType: 'initial' },
    });
  };

  const handleOpenDecline = () => {
    setRejectReason('');
    setModal('decline');
  };

  const handleConfirmDecline = async () => {
    // TODO: await api.post(`/customer/requests/${request.id}/quotation/decline`, { reason: rejectReason });
    console.log('Quotation declined', request.id, rejectReason);
    setModal(null);
    navigate('/customer/requests');
  };

  return (
    <CustomerSidebar>
      <div className="box-border px-[42px] pb-10 pt-[25px]">
        <h1 className="m-0 flex h-[68px] items-center font-[Quicksand] text-[48px] font-bold leading-[32px] text-[#005FCA]">
          My Requests
        </h1>

        <div className="mt-[25px] max-w-[876px]">
          <div className="-ml-2 flex items-center gap-5">
            <button
              type="button"
              onClick={handleBack}
              aria-label="Back to My Requests"
              className="flex cursor-pointer items-center justify-center border-none bg-transparent p-0"
            >
              <ChevronLeft size={32} strokeWidth={2.5} color="#000" />
            </button>
            <h2 className="m-0 font-[Inter] text-[20px] font-bold leading-[34px] text-[#292727]">
              Request #{request.id}
            </h2>
          </div>

          <div className="mt-2 pl-[2px]">
            <p className="m-0 font-[Inter] text-[15px] leading-[22px] text-[#484040]">
              {request.providerName} sent a quotation
            </p>
            <p className="m-0 font-[Inter] text-[15px] leading-[22px] text-[#5B5959]">
              {quotation.reason}
            </p>

            <div className="mt-5 font-[Inter] text-[15px] text-[#484040]">
              {quotation.items.map((item) => (
                <div
                  key={item.label}
                  className="flex justify-between border-b border-[#292727] px-1 pb-[6px] pt-[6px]"
                >
                  <span>{item.label}</span>
                  <span>{formatAmount(item.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between border-b-2 border-[#292727] px-1 pb-[6px] pt-[6px] font-bold text-[#292727]">
                <span>Total</span>
                <span>{formatAmount(quotation.total)}</span>
              </div>
            </div>

            <p className="m-0 mt-4 max-w-[790px] font-[Inter] text-[13px] leading-[22px] text-[#5B5959]">
              Note: If you accepted the quotation, you are required to pay the initial fee which is
              the 20% of the total service repair cost.
            </p>

            <div className="mt-5 flex justify-end gap-3">
              <OutlineButton onClick={handleApprove}>Approve</OutlineButton>
              <OutlineButton onClick={handleOpenDecline}>Decline</OutlineButton>
            </div>
          </div>
        </div>
      </div>

      {modal === 'approve' && (
        <ApproveModal onClose={() => navigate('/customer/requests')} onProceed={handleProceedToPayment} />
      )}
      {modal === 'decline' && (
        <DeclineModal
          reason={rejectReason}
          onReasonChange={setRejectReason}
          onClose={() => setModal(null)}
          onConfirm={handleConfirmDecline}
        />
      )}
    </CustomerSidebar>
  );
}