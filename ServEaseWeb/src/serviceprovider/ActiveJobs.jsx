import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import ServiceProviderSidebar from '../components/ServiceProviderSidebar.jsx';

// ── HARD-CODED CONTENT: START ─────────────────────────────────────────────
// Filter chips under the search bar. `value` is matched against job.statusGroup.
const FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Pending', value: 'pending' },
  { label: 'Done', value: 'done' },
];

// The repair stages shown in the 4-segment progress bar and in the "Current stage" dropdown.
// TODO (backend-ready): load the allowed stages from the backend (GET /job-stages) so the
// list stays in sync with the server's status flow.
const STAGES = ['Diagnosing', 'Repairing', 'Quality Check', 'Completed'];

// Badge shown at the top-right of each job card.
const STATUS_STYLES = {
  'In Progress': 'bg-[#62BB57]',
  Pending: 'bg-[#817C7C]',
  Done: 'bg-[#0255AF]',
};

// Expected shape of each job once the backend is wired up (adjust to the real contract):
//   {
//     id: string | number,
//     requestNumber: string,               // e.g. 'SR-0000'
//     customerName: string,
//     date: string,                        // ISO date; formatted for display (e.g. 'Jun 27')
//     status: 'In Progress' | 'Pending' | 'Done',
//     statusGroup: 'active' | 'pending' | 'done',
//     aiSuggestion: { problem: string, confidencePercent: number } | null,
//     currentStage: string,                // one of STAGES
//     progressPayment: { amount: number, paid: boolean } | null,
//   }
const MOCK_JOBS = [
  {
    id: 1,
    requestNumber: 'SR-0000',
    customerName: 'Nikki Pie',
    dateLabel: 'Jun 27',
    status: 'In Progress',
    statusGroup: 'active',
    aiSuggestion: { problem: 'LCD', confidencePercent: 96 },
    currentStage: 'Repairing',
    progressPayment: { amount: 500, paid: true },
  },
];
// ── HARD-CODED CONTENT: END ───────────────────────────────────────────────

const POPPINS = 'font-[Poppins,Quicksand,sans-serif]';
const FIELD =
  'box-border w-full rounded-[6px] border border-[#D3CDCD] bg-[#FFFBFB] text-[#292727] outline-none placeholder:text-[#9B9B9B]';
const MODAL_BUTTON =
  'box-border flex h-[39px] w-[163px] cursor-pointer items-center justify-center rounded-[10px] border border-[#B1A8A8] bg-[#FFFDFD] font-[SF_Pro,system-ui,sans-serif] text-[13px] font-bold text-[#414141]';

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

// Shared dark overlay + white dialog used by both modals.
function ModalShell({ title, titleTopClass, onClose, children }) {
  useEffect(() => {
    const onKeyDown = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`relative box-border max-h-[95vh] w-full max-w-[820px] overflow-y-auto rounded-[10px] bg-white px-6 sm:px-[43px] ${POPPINS} text-[#292727]`}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-6 top-[26px] cursor-pointer border-0 bg-transparent p-0 text-black sm:right-[48px]"
        >
          <X size={24} strokeWidth={2.4} />
        </button>
        <h2 className={`m-0 h-[30px] font-[Quicksand] text-[24px] font-medium leading-[30px] ${titleTopClass}`}>
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

function UpdateStatusModal({ job, onClose, onSubmitted }) {
  const [stage, setStage] = useState(job.currentStage);
  const [notes, setNotes] = useState('');
  const [image, setImage] = useState(null);

  const handlePushUpdate = async () => {
    // TODO (backend-ready): push the status update for this job, e.g.
    //
    //   // const formData = new FormData();
    //   // formData.append('stage', stage);
    //   // formData.append('notes', notes);
    //   // if (image) formData.append('image', image);        // optional progress photo
    //   // const updated = await api.updateJobStatus(job.id, formData);   // PATCH /jobs/:id/status
    //   // onSubmitted(updated);                              // refresh the card from the server response
    //
    // The server should also notify the customer (in-app + push/email) about the new stage.
    onSubmitted({ ...job, currentStage: stage });
    onClose();
  };

  return (
    <ModalShell title="Update Status" titleTopClass="mt-[53px]" onClose={onClose}>
      <p className="m-0 mt-6 text-[14px] leading-[18px]">Current stage</p>
      <select
        value={stage}
        onChange={(e) => setStage(e.target.value)}
        className={`${FIELD} mt-[11px] h-[41px] w-[132px] cursor-pointer bg-white px-2 text-[13px]`}
      >
        {STAGES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      <p className="m-0 mt-5 text-[14px] leading-[18px]">Notes</p>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Timeline, update, etc..."
        className={`${FIELD} mt-[14px] block h-[95px] resize-none p-3 text-[13px] ${POPPINS}`}
      />

      <label
        className={`${FIELD} mt-[14px] flex h-[107px] cursor-pointer flex-col items-center justify-center gap-1 bg-white`}
      >
        <ImageGlyph />
        <span className="text-[9px] leading-[11px] text-[#292727]">
          {image ? image.name : 'Upload Image'}
        </span>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => setImage(e.target.files?.[0] ?? null)}
        />
      </label>

      <div className="mb-[34px] mt-6 flex justify-end">
        <button type="button" onClick={handlePushUpdate} className={MODAL_BUTTON}>
          Push Update
        </button>
      </div>
    </ModalShell>
  );
}

function NotifyPartsModal({ job, onClose }) {
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');

  const handleSend = async () => {
    // TODO (backend-ready): send the additional-parts request to the customer, e.g.
    //
    //   // await api.notifyAdditionalParts(job.id, {
    //   //   additionalCost: Number(cost),     // in pesos
    //   //   notes,
    //   // });                                // POST /jobs/:id/additional-parts
    //
    // The server should notify the customer so they can approve or decline the extra cost.
    onClose();
  };

  return (
    <ModalShell title="Notify Additional Parts" titleTopClass="mt-[64px]" onClose={onClose}>
      <p className="m-0 mt-[63px] text-[14px] leading-[18px]">Additional Cost (Peso)</p>
      <input
        type="number"
        min="0"
        inputMode="decimal"
        value={cost}
        onChange={(e) => setCost(e.target.value)}
        placeholder="0.00"
        className={`${FIELD} mt-[10px] h-[41px] px-3 text-[13px] ${POPPINS}`}
      />

      <p className="m-0 mt-3 text-[14px] leading-[18px]">Notes</p>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Timeline, update, etc..."
        className={`${FIELD} mt-[16px] block h-[95px] resize-none p-3 text-[13px] ${POPPINS}`}
      />

      <div className="mb-[47px] mt-[53px] flex justify-end">
        <button type="button" onClick={handleSend} className={MODAL_BUTTON}>
          Send Request
        </button>
      </div>
    </ModalShell>
  );
}

export default function ActiveJobs() {
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [jobs, setJobs] = useState(MOCK_JOBS);
  const [modal, setModal] = useState(null); // null | { type: 'update' | 'notify', jobId }

  // TODO (backend-ready): this tab is for the logged-in service provider. Guard the route the
  // same way as the dashboard (useAuth: redirect to /login when there is no provider user),
  // then replace MOCK_JOBS with the provider's jobs from the database, e.g.
  //
  //   // const [jobs, setJobs] = useState([]);
  //   // const [status, setStatus] = useState('loading'); // 'loading' | 'done' | 'error'
  //   //
  //   // useEffect(() => {
  //   //   let cancelled = false;
  //   //   async function loadJobs() {
  //   //     try {
  //   //       setStatus('loading');
  //   //       // Let the server do the searching/filtering (debounce `search` before calling):
  //   //       const result = await api.getProviderJobs({ search, status: activeFilter }); // GET /provider/jobs
  //   //       if (!cancelled) { setJobs(result); setStatus('done'); }
  //   //     } catch (err) {
  //   //       if (!cancelled) setStatus('error');
  //   //     }
  //   //   }
  //   //   loadJobs();
  //   //   return () => { cancelled = true; };
  //   // }, [search, activeFilter]);
  //
  // Optional: keep the cards fresh (customer payments, approvals) with polling or a websocket.

  // Client-side search + filter for the hard-coded data. Remove once the server filters/searches.
  const visibleJobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return jobs.filter((job) => {
      if (activeFilter !== 'all' && job.statusGroup !== activeFilter) return false;
      if (!q) return true;
      return [job.requestNumber, job.customerName, job.currentStage, job.aiSuggestion?.problem]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(q));
    });
  }, [jobs, search, activeFilter]);

  const activeJob = modal ? jobs.find((j) => j.id === modal.jobId) : null;
  const closeModal = () => setModal(null);

  const handleJobUpdated = (updated) => {
    setJobs((current) => current.map((j) => (j.id === updated.id ? updated : j)));
  };

  return (
    <ServiceProviderSidebar>
      <div className="box-border px-4 py-6 sm:px-[52px]">
        <h1 className="m-0 flex min-h-[68px] items-center font-[Quicksand] text-[32px] font-bold leading-tight text-[#005FCA] sm:text-[40px] lg:text-[48px] lg:leading-[32px]">
          Active Jobs
        </h1>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search job and details..."
          className={`box-border mt-[13px] block h-[45px] w-full max-w-[346px] rounded-[8px] border border-[#1F1D1D]/[0.12] bg-[#EAEAEA] px-[19px] ${POPPINS} text-[14px] font-medium text-[#292727] outline-none placeholder:text-black/[0.34]`}
        />

        <div className="mt-[18px] flex flex-wrap gap-[5px]">
          {FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setActiveFilter(filter.value)}
              className={`box-border h-[31px] w-[98px] cursor-pointer rounded-[20px] border border-[#B1A8A8] p-0 text-center font-[Quicksand] text-[10px] font-medium leading-[17px] ${
                activeFilter === filter.value ? 'bg-[#021E79] text-[#FFFAFA]' : 'bg-[#FFFDFD] text-[#414141]'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="mt-[19px] flex max-w-[1082px] flex-col gap-4 overflow-x-auto">
          {visibleJobs.map((job) => {
            const stageIndex = STAGES.indexOf(job.currentStage);
            return (
              <div
                key={job.id}
                className="relative box-border h-[225px] w-full min-w-[760px] rounded-[10px] border border-[#818080] bg-white font-[SF_Pro,system-ui,sans-serif] text-[#5B5959]"
              >
                <p className="absolute left-[16px] top-[10px] m-0 text-[13px] font-bold leading-[22px] text-[#292727]">
                  Request #{job.requestNumber}
                </p>
                <p className="absolute left-[16px] top-[32px] m-0 text-[9px] leading-[15px]">
                  {job.customerName} | {job.dateLabel}
                </p>

                <span
                  className={`absolute right-[29px] top-[14px] box-border flex h-[22px] w-[96px] items-center justify-center rounded-[20px] border border-[#B1A8A8] font-[Quicksand] text-[10px] font-medium leading-[17px] text-white ${
                    STATUS_STYLES[job.status] ?? 'bg-[#817C7C]'
                  }`}
                >
                  {job.status}
                </span>

                {job.aiSuggestion && (
                  <div className="absolute left-[18px] right-[46px] top-[58px] flex h-[37px] items-center rounded-[10px] bg-[#262728] pl-[19px] text-[9px] leading-[15px] text-white">
                    <BoltIcon />
                    <span className="ml-[8px]">AI suggests {job.aiSuggestion.problem} problem</span>
                    <span className="ml-[4px]">({job.aiSuggestion.confidencePercent}% confidence)</span>
                  </div>
                )}

                <div className="absolute left-[17px] right-[45px] top-[107px] border-t border-black/40" />

                <div className="absolute left-[20px] top-[123px] flex gap-[18px]">
                  {STAGES.map((stage, i) => (
                    <div
                      key={stage}
                      className={`h-2 w-[117px] rounded-[10px] ${
                        i < stageIndex ? 'bg-[#62BB57]' : i === stageIndex ? 'bg-[#577FBB]' : 'bg-[#D9D9D9]'
                      }`}
                    />
                  ))}
                </div>

                <p className="absolute left-[19px] top-[141px] m-0 text-[9px] font-bold leading-[15px]">
                  Current Step: {job.currentStage}
                </p>
                {job.progressPayment && (
                  <p className="absolute left-[19px] top-[159px] m-0 text-[9px] leading-[15px]">
                    Progress Payment ₱{job.progressPayment.amount}{' '}
                    {job.progressPayment.paid ? 'already paid by customer' : 'pending from customer'}
                  </p>
                )}

                <div className="absolute right-[29px] top-[177px] flex gap-[6px]">
                  <button
                    type="button"
                    onClick={() => setModal({ type: 'update', jobId: job.id })}
                    className="box-border h-[29px] w-[137px] cursor-pointer rounded-[10px] border border-[#B1A8A8] bg-[#FFFDFD] p-0 font-[SF_Pro,system-ui,sans-serif] text-[10px] font-bold leading-[17px] text-[#414141]"
                  >
                    Update Status
                  </button>
                  <button
                    type="button"
                    onClick={() => setModal({ type: 'notify', jobId: job.id })}
                    className="box-border h-[29px] w-[178px] cursor-pointer rounded-[10px] border border-[#B1A8A8] bg-[#FFFDFD] p-0 font-[SF_Pro,system-ui,sans-serif] text-[10px] font-bold leading-[17px] text-[#414141]"
                  >
                    Notify Additional Parts
                  </button>
                </div>
              </div>
            );
          })}

          {visibleJobs.length === 0 && (
            <p className="m-0 py-10 text-center font-[Roboto] text-[14px] text-[#817C7C]">No jobs found.</p>
          )}
        </div>
      </div>

      {modal?.type === 'update' && activeJob && (
        <UpdateStatusModal job={activeJob} onClose={closeModal} onSubmitted={handleJobUpdated} />
      )}
      {modal?.type === 'notify' && activeJob && <NotifyPartsModal job={activeJob} onClose={closeModal} />}
    </ServiceProviderSidebar>
  );
}