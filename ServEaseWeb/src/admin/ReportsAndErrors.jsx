import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Eye, Search, X } from 'lucide-react';
import AdminSidebar from '../components/AdminSidebar';
import { getAdminReports, getAdminReport, updateAdminReportStatus } from '../api/client';

/*
 * Admin > Reports and Errors
 *
 * NOTHING on this screen is hard-coded. Everything shown comes from the backend:
 *   GET   /api/admin/reports?tab=all|user|system|resolved&search=&page=&pageSize=  -> list (table rows)
 *   GET   /api/admin/reports/:id                                  -> one report (modal + images)
 *   PATCH /api/admin/reports/:id/status  { status, admin_note }   -> Mark as Resolved / Dismissed
 * (the client.js wrappers are getAdminReports, getAdminReport, updateAdminReportStatus)
 *
 * If your backend uses different field names, change them ONLY in normalizeReport() below.
 */

const PAGE_SIZE = 5; // Figma: "Showing 1 to 5 of ..."

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'user', label: 'User Reports' },
  { key: 'system', label: 'System Reports' },
  { key: 'resolved', label: 'Resolved' },
];

const STATUS_STYLES = {
  pending: { label: 'Pending', bg: '#CAB94B' },
  dismissed: { label: 'Dismissed', bg: '#771F13' },
  resolved: { label: 'Resolved', bg: '#167713' },
};

/* ------------------------------ helpers ------------------------------ */

const formatDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });
};

const roleLabel = (role = '') => {
  const r = String(role).toLowerCase();
  if (!r) return '';
  if (r.includes('provider')) return 'Service Provider';
  if (r === 'customer') return 'Customer';
  if (r === 'admin') return 'Admin';
  return r.charAt(0).toUpperCase() + r.slice(1);
};

// "Ana Marie Chan" + "customer" -> "Ana Marie Chan (Customer)"
const personLabel = (name, role) => {
  if (!name) return '';
  const label = roleLabel(role);
  return label ? `${name} (${label})` : name;
};

// R-0001 for user reports, B-0001 for system error reports. A backend-provided code wins.
const formatCode = (type, id, backendCode) => {
  if (backendCode) return backendCode;
  const prefix = type === 'system' ? 'B' : 'R';
  const str = String(id ?? '');
  const body = /^\d+$/.test(str) ? str.padStart(4, '0') : str.replace(/-/g, '').slice(0, 4).toUpperCase();
  return `${prefix}-${body}`;
};

const toImageList = (raw) => {
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.map((item) => (typeof item === 'string' ? item : item?.url || item?.image_url || '')).filter(Boolean);
};

// Single place that maps the backend row -> what the screen uses.
const normalizeReport = (r = {}) => {
  const rawType = String(r.report_type || r.type || '').toLowerCase();
  const type = rawType.includes('system') ? 'system' : 'user';
  const status = String(r.status || 'pending').toLowerCase();
  return {
    id: r.id,
    type,
    code: formatCode(type, r.id, r.report_code),
    status: STATUS_STYLES[status] ? status : 'pending',
    reporter: personLabel(
      r.reporter?.name ?? r.reporter_name ?? r.reporterName,
      r.reporter?.role ?? r.reporter_role ?? r.reporterRole ?? r.reported_from ?? r.reportedFrom,
    ),
    reportedUser: personLabel(
      r.reported_user?.name ?? r.reported_user_name ?? r.reportedUserName,
      r.reported_user?.role ?? r.reported_user_role ?? r.reportedUserRole,
    ),
    subject: r.subject ?? '',
    details: r.details ?? r.description ?? '',
    adminNote: r.admin_note ?? r.adminNote ?? '',
    createdAt: r.created_at ?? r.createdAt ?? null,
    images: toImageList(r.images ?? r.image_urls ?? r.attachments ?? r.image_url),
  };
};

// [1, 2, 3, '…', 9]
const getPageList = (current, total) => {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push('…');
  for (let p = start; p <= end; p += 1) pages.push(p);
  if (end < total - 1) pages.push('…');
  pages.push(total);
  return pages;
};

const errorMessage = (err, fallback) =>
  err?.response?.data?.message || err?.response?.data?.error || err?.message || fallback;

/* ------------------------------ small pieces ------------------------------ */

function StatusBadge({ status, className = '' }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.pending;
  return (
    <span
      className={`inline-flex h-[24px] min-w-[76px] items-center justify-center rounded-[10px] px-3 font-[Roboto] text-[12px] font-bold leading-[15px] text-white/[0.98] ${className}`}
      style={{ backgroundColor: s.bg }}
    >
      {s.label}
    </span>
  );
}

function DetailRow({ label, children }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-x-4 font-[Roboto] text-[15px] leading-[20px] text-[#484040] sm:grid-cols-[187px_1fr]">
      <span className="font-medium">{label}</span>
      <span className="break-words font-normal">{children}</span>
    </div>
  );
}

/* ------------------------------ image viewer ------------------------------ */

function ImageViewer({ images, onClose }) {
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const count = images.length;

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
      if (e.key === 'ArrowRight' && count > 1) setIndex((i) => (i + 1) % count);
      if (e.key === 'ArrowLeft' && count > 1) setIndex((i) => (i - 1 + count) % count);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [count, onClose]);

  useEffect(() => setFailed(false), [index]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Uploaded image"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close image"
        className="absolute right-5 top-5 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border-none bg-white/90"
      >
        <X size={22} color="#000000" />
      </button>

      {count > 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIndex((i) => (i - 1 + count) % count);
          }}
          aria-label="Previous image"
          className="absolute left-4 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border-none bg-white/90"
        >
          <ChevronLeft size={22} color="#000000" />
        </button>
      )}

      <div className="flex max-h-full max-w-full flex-col items-center" onClick={(e) => e.stopPropagation()}>
        {failed ? (
          <p className="rounded-[10px] bg-white px-6 py-4 font-[Roboto] text-[15px] text-[#484040]">
            This image could not be loaded.
          </p>
        ) : (
          <img
            src={images[index]}
            alt={`Uploaded by the reporter (${index + 1} of ${count})`}
            onError={() => setFailed(true)}
            className="max-h-[85vh] max-w-[92vw] rounded-[10px] bg-white object-contain"
          />
        )}
        {count > 1 && (
          <span className="mt-3 font-[Roboto] text-[14px] font-medium text-white">
            {index + 1} / {count}
          </span>
        )}
      </div>

      {count > 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIndex((i) => (i + 1) % count);
          }}
          aria-label="Next image"
          className="absolute right-4 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border-none bg-white/90"
        >
          <ChevronRight size={22} color="#000000" />
        </button>
      )}
    </div>
  );
}

/* ------------------------------ report modal ------------------------------ */

// One modal for both designs: "User Report" (has an Against row) and "System Error Report".
function ReportModal({ reportId, onClose, onUpdated }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [viewerOpen, setViewerOpen] = useState(false);

  // Load the full report (fresh image links) every time the modal opens.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError('');
    getAdminReport(reportId)
      .then((res) => {
        if (cancelled) return;
        const body = res?.data ?? res;
        const data = normalizeReport(body?.report ?? body);
        setReport(data);
        setNote(data.adminNote);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(errorMessage(err, 'Could not load this report.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reportId]);

  // Escape closes the modal (the image viewer handles its own Escape first).
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !viewerOpen && !saving) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, viewerOpen, saving]);

  const isSystem = report?.type === 'system';
  const isPending = report?.status === 'pending';
  const hasImages = (report?.images?.length || 0) > 0;

  const submit = async (status) => {
    if (saving) return;
    setSaving(true);
    setSaveError('');
    try {
      await updateAdminReportStatus(reportId, { status, admin_note: note.trim() });
      onUpdated();
    } catch (err) {
      setSaveError(errorMessage(err, 'Could not update this report. Please try again.'));
      setSaving(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/35 p-4"
        onClick={() => !saving && onClose()}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Report details"
          onClick={(e) => e.stopPropagation()}
          className="relative my-auto box-border w-full max-w-[630px] rounded-[10px] bg-white px-6 pb-8 pt-8 sm:px-8"
        >
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="absolute right-5 top-5 flex h-8 w-8 cursor-pointer items-center justify-center border-none bg-transparent p-0"
          >
            <X size={24} color="#000000" />
          </button>

          {loading && (
            <p className="py-24 text-center font-[Roboto] text-[15px] text-[#484040]">Loading report...</p>
          )}

          {!loading && loadError && (
            <div className="py-20 text-center font-[Roboto]">
              <p className="m-0 mb-4 text-[15px] text-[#771F13]">{loadError}</p>
              <button
                type="button"
                onClick={onClose}
                className="cursor-pointer rounded-[10px] border-none bg-[#0E1721] px-5 py-2 text-[15px] font-medium text-white"
              >
                Close
              </button>
            </div>
          )}

          {!loading && !loadError && report && (
            <>
              {/* Title + status */}
              <div className="pr-10">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="m-0 font-[Roboto] text-[24px] font-medium leading-[28px] text-black">
                    Report {report.code}
                  </h2>
                  <StatusBadge status={report.status} />
                </div>
                <p className="m-0 mt-1 font-[Roboto] text-[15px] font-medium leading-[18px] text-[#484040]">
                  {isSystem ? 'System Error Report' : 'User Report'}
                </p>
              </div>

              {/* Details */}
              <div className="mt-8 flex flex-col gap-[5px]">
                <DetailRow label="Reported by">{report.reporter}</DetailRow>
                {!isSystem && <DetailRow label="Against">{report.reportedUser}</DetailRow>}
                <DetailRow label="Subject">{report.subject}</DetailRow>
                <DetailRow label="Date">{formatDate(report.createdAt)}</DetailRow>
                <DetailRow label="Details">{report.details}</DetailRow>
              </div>

              {/* View uploaded image */}
              <button
                type="button"
                onClick={() => setViewerOpen(true)}
                disabled={!hasImages}
                title={hasImages ? undefined : 'The reporter did not upload an image'}
                className="mt-6 flex h-[33px] cursor-pointer items-center gap-2 rounded-[10px] border-none bg-[#0E1721] px-2 pr-4 font-[Roboto] text-[15px] font-medium text-white shadow-[0_4px_4px_rgba(0,0,0,0.25)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Eye size={20} color="#FFFFFF" />
                {hasImages ? 'View Image' : 'No Image'}
              </button>

              {/* Admin note */}
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                readOnly={!isPending}
                placeholder="Add an admin note or action taken."
                aria-label="Admin note"
                className="mt-4 box-border h-[95px] w-full resize-none rounded-[10px] border border-[#383838] bg-[#F6F6F6] px-[10px] py-3 font-[Roboto] text-[14px] leading-[18px] text-[#484040] outline-none placeholder:text-[#AAAAAA]"
              />

              {saveError && (
                <p role="alert" className="m-0 mt-3 font-[Roboto] text-[14px] text-[#771F13]">
                  {saveError}
                </p>
              )}

              {/* Actions (only while the report is still pending) */}
              {isPending && (
                <div className="mt-8 flex flex-wrap justify-end gap-[21px]">
                  <button
                    type="button"
                    onClick={() => submit('dismissed')}
                    disabled={saving}
                    className="h-[40px] min-w-[150px] cursor-pointer rounded-[10px] border-none bg-[#771F13] px-4 font-[Roboto] text-[15px] font-bold text-white shadow-[0_4px_4px_rgba(0,0,0,0.25)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? 'Saving...' : 'Mark as Dismissed'}
                  </button>
                  <button
                    type="button"
                    onClick={() => submit('resolved')}
                    disabled={saving}
                    className="h-[40px] min-w-[140px] cursor-pointer rounded-[10px] border-none bg-[#167713] px-4 font-[Roboto] text-[15px] font-bold text-white shadow-[0_4px_4px_rgba(0,0,0,0.25)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? 'Saving...' : 'Mark as Resolved'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {viewerOpen && hasImages && <ImageViewer images={report.images} onClose={() => setViewerOpen(false)} />}
    </>
  );
}

/* ------------------------------ page ------------------------------ */

export default function ReportsAndErrors() {
  const [tab, setTab] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState(''); // debounced
  const [page, setPage] = useState(1);
  const [reports, setReports] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const requestId = useRef(0);

  // Wait for the admin to stop typing before asking the backend.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchText.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  const loadReports = useCallback(async () => {
    const current = ++requestId.current;
    setLoading(true);
    setError('');
    try {
      const res = await getAdminReports({ tab, search, page, pageSize: PAGE_SIZE });
      if (current !== requestId.current) return; // a newer request replaced this one
      const body = res?.data ?? res;
      const rows = Array.isArray(body) ? body : body?.reports || [];
      setReports(rows.map(normalizeReport));
      setTotal(Number(body?.total ?? rows.length) || 0);
    } catch (err) {
      if (current !== requestId.current) return;
      setReports([]);
      setTotal(0);
      setError(errorMessage(err, 'Could not load reports.'));
    } finally {
      if (current === requestId.current) setLoading(false);
    }
  }, [tab, search, page]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const changeTab = (key) => {
    setTab(key);
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  const handleUpdated = () => {
    setSelectedId(null);
    loadReports();
  };

  return (
    <AdminSidebar>
      <div className="box-border w-full px-5 pb-10 pt-8 sm:px-9">
        <h1 className="m-0 font-[Quicksand] text-[25px] font-bold leading-[31px] text-[#0255AF]">
          Reports and Errors
        </h1>

        {/* Search */}
        <div className="mt-8 flex h-[49px] items-center gap-4 rounded-[14px] border border-[#7E7A7A] bg-white px-5">
          <Search size={20} color="#393939" className="flex-none" />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search report details..."
            aria-label="Search report details"
            className="h-full min-w-0 flex-1 border-none bg-transparent font-[Inter] text-[16px] font-medium tracking-[-0.3125px] text-[#1A202C] outline-none placeholder:text-[#718096]"
          />
        </div>

        {/* Tabs */}
        <div role="tablist" className="mt-5 flex flex-wrap gap-x-8 gap-y-2 px-2">
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => changeTab(t.key)}
                className={`cursor-pointer border-x-0 border-b-2 border-t-0 border-solid bg-transparent px-1 pb-[5px] font-[Roboto] text-[15px] leading-[15px] ${
                  active
                    ? 'border-b-[#0255AF] font-extrabold text-[#0255AF]'
                    : 'border-b-transparent font-semibold text-[#292727]'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Table */}
        <div className="mt-3 box-border min-h-[512px] overflow-x-auto rounded-[24px] border border-[#F3F4F6] bg-[#CBE4FF] shadow-[0_1px_3px_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)]">
          <div className="min-w-[720px]">
            <div className="grid grid-cols-[1fr_1.3fr_1.5fr_1.1fr_1fr_0.8fr] items-center px-8 py-4 text-center font-[Inter] text-[10px] font-bold uppercase leading-[15px] tracking-[1px] text-[#99A1AF]">
              <span>ID</span>
              <span>Report Type</span>
              <span>Reported By</span>
              <span>Status</span>
              <span>Date</span>
              <span>Actions</span>
            </div>

            {loading && (
              <p className="m-0 py-16 text-center font-[Roboto] text-[14px] text-[#3F4143]">Loading reports...</p>
            )}

            {!loading && error && (
              <div className="py-16 text-center font-[Roboto] text-[14px] text-[#771F13]">
                <p className="m-0 mb-3">{error}</p>
                <button
                  type="button"
                  onClick={loadReports}
                  className="cursor-pointer rounded-[10px] border-none bg-[#0255AF] px-4 py-2 font-[Roboto] text-[14px] font-bold text-white"
                >
                  Try again
                </button>
              </div>
            )}

            {!loading && !error && reports.length === 0 && (
              <p className="m-0 py-16 text-center font-[Roboto] text-[14px] text-[#3F4143]">No reports found.</p>
            )}

            {!loading &&
              !error &&
              reports.map((r) => (
                <div
                  key={r.id}
                  className="grid min-h-[45px] grid-cols-[1fr_1.3fr_1.5fr_1.1fr_1fr_0.8fr] items-center px-8 py-[10px] text-center font-[Roboto] text-[12px] leading-[15px] text-[#3F4143]"
                >
                  <span className="truncate">{r.code}</span>
                  <span className="truncate">{r.type === 'system' ? 'System Report' : 'User Report'}</span>
                  <span className="truncate px-2">{r.reporter}</span>
                  <span className="flex justify-center">
                    <StatusBadge status={r.status} />
                  </span>
                  <span>{formatDate(r.createdAt)}</span>
                  <span className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => setSelectedId(r.id)}
                      aria-label={`View report ${r.code}`}
                      className="flex h-8 w-8 cursor-pointer items-center justify-center border-none bg-transparent p-0"
                    >
                      <Eye size={20} color="#1E1E1E" />
                    </button>
                  </span>
                </div>
              ))}
          </div>
        </div>

        {/* Pagination */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 px-2">
          <div className="flex items-center gap-[5px]">
            {getPageList(page, totalPages).map((p, i) =>
              p === '…' ? (
                <span key={`gap-${i}`} className="px-1 font-[Roboto] text-[15px] font-semibold text-black">
                  …
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  aria-label={`Page ${p}`}
                  aria-current={p === page ? 'page' : undefined}
                  className={`box-border h-[24px] min-w-[24px] cursor-pointer rounded-[5px] border border-solid px-1 font-[Roboto] text-[15px] font-semibold leading-[15px] ${
                    p === page
                      ? 'border-[#0255AF] bg-[#0255AF] text-white'
                      : 'border-[#DAD2D2] bg-white text-black'
                  }`}
                >
                  {p}
                </button>
              ),
            )}
          </div>

          <span className="font-[Roboto] text-[15px] font-semibold leading-[15px] text-[#7C7979]">
            Showing {from} to {to} of {total} reports
          </span>
        </div>
      </div>

      {selectedId !== null && (
        <ReportModal reportId={selectedId} onClose={() => setSelectedId(null)} onUpdated={handleUpdated} />
      )}
    </AdminSidebar>
  );
}