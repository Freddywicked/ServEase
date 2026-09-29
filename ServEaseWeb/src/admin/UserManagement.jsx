import { useEffect, useState } from 'react';
import AdminSidebar from '../components/AdminSidebar.jsx';
import eyeIcon from '../assets/icon_eye_view.png';
import editIcon from '../assets/icon_edit.png';
import eyeWhiteIcon from '../assets/icon_eye_view_white.png';

const styles = {
  content: { padding: '24px 36px', boxSizing: 'border-box' },
  heading: {
    fontFamily: "'Quicksand', sans-serif",
    fontWeight: 700,
    fontSize: 25,
    color: '#0255AF',
    margin: '0 0 18px',
  },
  tabsRow: { display: 'flex', gap: 32, marginBottom: 16, borderBottom: '1px solid #E5E7EB' },
  tab: {
    fontFamily: "'Roboto', sans-serif",
    fontSize: 15,
    fontWeight: 600,
    color: '#292727',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '0 0 10px',
    borderBottom: '2px solid transparent',
  },
  tabActive: {
    fontWeight: 800,
    color: '#0255AF',
    borderBottom: '2px solid #0255AF',
  },
  card: {
    backgroundColor: '#CBE4FF',
    border: '1px solid #F3F4F6',
    boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.1), 0px 1px 2px -1px rgba(0, 0, 0, 0.1)',
    borderRadius: 24,
    padding: '20px 24px',
    boxSizing: 'border-box',
    overflowX: 'auto',
  },
  headerRow: {
    display: 'grid',
    gridTemplateColumns: '1.3fr 1.5fr 1.1fr 0.9fr 0.9fr 0.7fr',
    padding: '0 8px 16px',
    minWidth: 760,
  },
  headerCell: {
    fontFamily: "'Inter', sans-serif",
    fontWeight: 700,
    fontSize: 10,
    letterSpacing: '1px',
    textTransform: 'uppercase',
    color: '#99A1AF',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1.3fr 1.5fr 1.1fr 0.9fr 0.9fr 0.7fr',
    alignItems: 'center',
    padding: '11px 8px',
    minWidth: 760,
  },
  cellText: {
    fontFamily: "'Roboto', sans-serif",
    fontWeight: 400,
    fontSize: 12,
    color: '#3F4143',
    margin: 0,
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    padding: '5px 14px',
    fontFamily: "'Roboto', sans-serif",
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.98)',
    width: 'fit-content',
  },
  actionsCell: { display: 'flex', gap: 10 },
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' },
  footerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  pageBtn: {
    width: 24,
    height: 24,
    borderRadius: 5,
    border: '1px solid #DAD2D2',
    backgroundColor: '#FFFFFF',
    fontFamily: "'Roboto', sans-serif",
    fontWeight: 600,
    fontSize: 13,
    color: '#000000',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageBtnActive: { backgroundColor: '#0255AF', borderColor: '#0255AF', color: '#FFFFFF' },
  resultsText: {
    fontFamily: "'Roboto', sans-serif",
    fontWeight: 600,
    fontSize: 13,
    color: '#7C7979',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: '24px 28px',
    width: '100%',
    maxWidth: 420,
    boxSizing: 'border-box',
    fontFamily: "'Roboto', sans-serif",
    position: 'relative',
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 18,
    lineHeight: 1,
    color: '#000000',
  },
  modalNameRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 },
  modalName: { fontFamily: "'Quicksand', sans-serif", fontWeight: 700, fontSize: 18, color: '#000000', margin: 0 },
  modalRole: { fontSize: 12, color: '#7C7979', margin: '0 0 16px' },
  modalFieldLabel: { fontSize: 11, fontWeight: 700, color: '#99A1AF', textTransform: 'uppercase', letterSpacing: '0.5px' },
  modalFieldValue: { fontSize: 13, color: '#292727', margin: '2px 0 12px' },
  modalDocsRow: { display: 'flex', gap: 8, flexWrap: 'wrap', margin: '4px 0 12px' },
  modalDocChip: {
    fontSize: 11,
    fontWeight: 600,
    color: '#0255AF',
    border: '1px solid #0255AF',
    borderRadius: 8,
    padding: '5px 10px',
    background: 'none',
    cursor: 'pointer',
  },
  modalTextarea: {
    width: '100%',
    minHeight: 60,
    borderRadius: 8,
    border: '1px solid #DAD2D2',
    padding: 8,
    fontFamily: "'Roboto', sans-serif",
    fontSize: 12,
    boxSizing: 'border-box',
    marginBottom: 14,
    resize: 'vertical',
  },
  modalActionsRow: { display: 'flex', gap: 10 },
  acceptBtn: {
    flex: 1,
    padding: '10px 0',
    borderRadius: 8,
    border: 'none',
    backgroundColor: '#167713',
    color: '#FFFFFF',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
  },
  rejectBtn: {
    flex: 1,
    padding: '10px 0',
    borderRadius: 8,
    border: 'none',
    backgroundColor: '#B91C1C',
    color: '#FFFFFF',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
  },
  confirmText: { fontSize: 14, color: '#292727', margin: '8px 0 16px' },

  // Service Provider account modal (sizes, fonts and colors from the Figma spec)
  providerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: '69px 33px 17px 35px',
    width: '100%',
    maxWidth: 628,
    maxHeight: 'calc(100vh - 40px)',
    overflowY: 'auto',
    boxSizing: 'border-box',
    fontFamily: "'Roboto', sans-serif",
    position: 'relative',
  },
  providerCloseBtn: {
    position: 'absolute',
    top: 45,
    right: 32,
    width: 15,
    height: 15,
    padding: 0,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
  },
  providerNameRow: { display: 'flex', alignItems: 'center', gap: 17 },
  providerName: { fontWeight: 500, fontSize: 24, lineHeight: '28px', color: '#000000', margin: 0 },
  providerRole: { fontWeight: 500, fontSize: 15, lineHeight: '16px', color: '#484040', margin: '3px 0 36px' },
  providerDetails: { display: 'flex', flexDirection: 'column', gap: 10 },
  providerDetailRow: { display: 'grid', gridTemplateColumns: '188px 1fr', alignItems: 'start' },
  providerLabel: { fontWeight: 500, fontSize: 15, lineHeight: '15px', color: '#484040' },
  providerValue: { fontWeight: 400, fontSize: 15, lineHeight: '15px', color: '#484040' },
  providerServicesGrid: { display: 'grid', gridTemplateColumns: '91px 1fr', rowGap: 11 },
  providerDocsRow: { display: 'flex', alignItems: 'flex-start', gap: 9, marginTop: 28 },
  providerDocBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    boxSizing: 'border-box',
    padding: '0 0 0 10px',
    border: 'none',
    borderRadius: 10,
    color: '#FFFFFF',
    fontFamily: "'Roboto', sans-serif",
    fontWeight: 700,
    fontSize: 15,
    lineHeight: '15px',
    boxShadow: '0px 4px 4px rgba(0, 0, 0, 0.25)',
    cursor: 'pointer',
    flex: 'none',
  },
  providerTextarea: {
    display: 'block',
    width: 561,
    maxWidth: 'calc(100% + 3px)',
    height: 96,
    marginTop: 13,
    marginLeft: -3,
    padding: '13px 12px',
    boxSizing: 'border-box',
    border: '1px solid #383838',
    borderRadius: 10,
    backgroundColor: '#F6F6F6',
    fontFamily: "'Roboto', sans-serif",
    fontSize: 14,
    lineHeight: '15px',
    color: '#000000',
    resize: 'none',
  },
  providerActionsRow: { display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 13, marginRight: -9 },
  providerActionBtn: {
    width: 116,
    height: 33,
    border: 'none',
    borderRadius: 10,
    color: '#FFFFFF',
    fontFamily: "'Roboto', sans-serif",
    fontWeight: 700,
    fontSize: 15,
    boxShadow: '0px 4px 4px rgba(0, 0, 0, 0.25)',
    cursor: 'pointer',
  },
};

const PAGE_SIZE = 5;

// Formats an ISO date string (or Date) from the backend as MM/DD/YY. Falls back to
// an em dash when a user has no registration date yet (e.g. still loading).
function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const yy = String(date.getFullYear()).slice(-2);
  return `${mm}/${dd}/${yy}`;
}

const TABS = [
  { key: 'all', label: 'All Users' },
  { key: 'customers', label: 'Customers' },
  { key: 'providers', label: 'Service Providers' },
  { key: 'pending', label: 'Pending' },
];

const ROLE_COLOR = { Customer: '#04A5A5', 'Service Provider': '#021E79' };

function StatusBadge({ status }) {
  const isActive = status === 'Active';
  return (
    <span
      style={{
        ...styles.badge,
        backgroundColor: isActive ? '#167713' : '#F9C082',
        fontWeight: isActive ? 400 : 700,
      }}
    >
      {status}
    </span>
  );
}

function CustomerDetailsModal({ user, onClose, onAccept, onReject }) {
  const [rejectReason, setRejectReason] = useState('');
  const isPending = user.status === 'Pending';

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <button type="button" style={styles.modalCloseBtn} onClick={onClose} aria-label="Close">✕</button>

        <div style={styles.modalNameRow}>
          <p style={styles.modalName}>{user.name}</p>
          <StatusBadge status={user.status} />
        </div>
        <p style={styles.modalRole}>{user.role}</p>

        <p style={styles.modalFieldLabel}>Email</p>
        <p style={styles.modalFieldValue}>{user.email}</p>
        <p style={styles.modalFieldLabel}>Address</p>
        <p style={styles.modalFieldValue}>{user.address}</p>
        <p style={styles.modalFieldLabel}>Phone</p>
        <p style={styles.modalFieldValue}>{user.phone}</p>
        <p style={styles.modalFieldLabel}>Birthdate</p>
        <p style={styles.modalFieldValue}>{formatDate(user.birthdate)}</p>

        {isPending && (
          <>
            <textarea
              placeholder="Enter your reason for rejection..."
              style={styles.modalTextarea}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div style={styles.modalActionsRow}>
              <button type="button" style={styles.acceptBtn} onClick={() => onAccept(user)}>Accept</button>
              <button type="button" style={styles.rejectBtn} onClick={() => onReject(user, rejectReason)}>Reject</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const DOCUMENT_BUTTONS = [
  { key: 'validId', label: 'Valid ID', width: 116, height: 33, background: '#0E1721' },
  { key: 'supportingDocument', label: 'Supporting Document', width: 203, height: 35, background: '#000000' },
  { key: 'selfie', label: 'Selfie', width: 116, height: 33, background: '#1E1E1E' },
];

function ProviderDetailsModal({ user, onClose, onAccept, onReject }) {
  const [rejectReason, setRejectReason] = useState('');
  const isPending = user.status === 'Pending';

  const detailRows = [
    ['Email', user.email],
    ['Address', user.address],
    ['Phone', user.phone],
    ['Birthdate', formatDate(user.birthdate)],
    ['Service Category', user.serviceCategory],
    ['Years of Experience', user.yearsExperience],
  ];

  // ── BACKEND-READY BLOCK: START ────────────────────────────────────────
  // TODO: once the backend and Supabase Storage are connected and the applicant has
  // uploaded their documents, open the matching file here (e.g. fetch a signed URL for
  // that document and show it in a viewer). Until then these buttons are display-only.
  const handleViewDocument = (docKey) => {
    console.log('View document', docKey, 'for user', user.id);
  };
  // ── BACKEND-READY BLOCK: END ──────────────────────────────────────────

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <style>{'.servease-reject-input::placeholder { color: #AAAAAA; }'}</style>
      <div style={styles.providerCard} onClick={(e) => e.stopPropagation()}>
        <button type="button" style={styles.providerCloseBtn} onClick={onClose} aria-label="Close">
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <path d="M1.5 1.5L13.5 13.5M13.5 1.5L1.5 13.5" stroke="#000000" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </button>

        <div style={styles.providerNameRow}>
          <p style={styles.providerName}>{user.name}</p>
          <StatusBadge status={user.status} />
        </div>
        <p style={styles.providerRole}>{user.role}</p>

        <div style={styles.providerDetails}>
          {detailRows.map(([label, value]) => (
            <div key={label} style={styles.providerDetailRow}>
              <span style={styles.providerLabel}>{label}</span>
              <span style={styles.providerValue}>{value}</span>
            </div>
          ))}
          <div style={styles.providerDetailRow}>
            <span style={styles.providerLabel}>Services Offered</span>
            <div style={styles.providerServicesGrid}>
              {user.servicesOffered?.map((service, i) => (
                <span key={`${service}-${i}`} style={styles.providerValue}>{service}</span>
              ))}
            </div>
          </div>
        </div>

        <div style={styles.providerDocsRow}>
          {DOCUMENT_BUTTONS.map((doc) => (
            <button
              key={doc.key}
              type="button"
              style={{ ...styles.providerDocBtn, width: doc.width, height: doc.height, backgroundColor: doc.background }}
              onClick={() => handleViewDocument(doc.key)}
            >
              <img src={eyeWhiteIcon} alt="" width={20} height={16} />
              {doc.label}
            </button>
          ))}
        </div>

        {isPending && (
          <>
            <textarea
              className="servease-reject-input"
              placeholder="Enter your reason for rejection."
              style={styles.providerTextarea}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div style={styles.providerActionsRow}>
              <button
                type="button"
                style={{ ...styles.providerActionBtn, backgroundColor: '#167713' }}
                onClick={() => onAccept(user)}
              >
                Accept
              </button>
              <button
                type="button"
                style={{ ...styles.providerActionBtn, backgroundColor: '#771F13' }}
                onClick={() => onReject(user, rejectReason)}
              >
                Reject
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function UserDetailsModal(props) {
  return props.user.role === 'Service Provider' ? (
    <ProviderDetailsModal {...props} />
  ) : (
    <CustomerDetailsModal {...props} />
  );
}

function DisableAccountModal({ user, onClose, onConfirm }) {
  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <button type="button" style={styles.modalCloseBtn} onClick={onClose} aria-label="Close">✕</button>
        <p style={styles.confirmText}>Are you sure you want to disable this account?</p>
        <div style={styles.modalNameRow}>
          <p style={styles.modalName}>{user.name}</p>
        </div>
        <p style={styles.modalRole}>{user.role}</p>
        <div style={styles.modalActionsRow}>
          <button type="button" style={styles.acceptBtn} onClick={onClose}>No</button>
          <button type="button" style={styles.rejectBtn} onClick={() => onConfirm(user)}>Disable</button>
        </div>
      </div>
    </div>
  );
}

export default function UserManagement() {
  const [activeTab, setActiveTab] = useState('all');
  const [viewingUser, setViewingUser] = useState(null);
  const [disablingUser, setDisablingUser] = useState(null);

  // TODO: replace with data fetched from the backend (e.g. GET /api/admin/users,
  // paginated and filtered server-side by activeTab and currentPage). Each user is
  // expected to look like: { id, name, email, role, status, dateRegistered (ISO string),
  // phone, address, birthdate, and — for Service Providers — serviceCategory,
  // yearsExperience, servicesOffered }.
  const [users, setUsers] = useState([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    // TODO: fetch the users for `activeTab` / `currentPage`, then call
    // setUsers([...]) and setTotalUsers(<total matching count from the backend>)
  }, [activeTab, currentPage]);

  // Reset to page 1 whenever the tab changes, since a filtered list has its own page count.
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  const filteredUsers = users.filter((u) => {
    if (activeTab === 'customers') return u.role === 'Customer';
    if (activeTab === 'providers') return u.role === 'Service Provider';
    if (activeTab === 'pending') return u.status === 'Pending';
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(totalUsers / PAGE_SIZE));
  const rangeStart = totalUsers === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, totalUsers);
  const resultsText = `Showing ${rangeStart} to ${rangeEnd} of ${totalUsers} users`;

  const handleAccept = (user) => {
    // TODO: call PATCH /api/admin/users/:id/approve once the backend is set up
    console.log('Accept', user.id);
    setViewingUser(null);
  };

  const handleReject = (user, reason) => {
    // TODO: call PATCH /api/admin/users/:id/reject with { reason } once the backend is set up
    console.log('Reject', user.id, reason);
    setViewingUser(null);
  };

  const handleDisable = (user) => {
    // TODO: call PATCH /api/admin/users/:id/disable once the backend is set up
    console.log('Disable', user.id);
    setDisablingUser(null);
  };

  return (
    <AdminSidebar>
      <div style={styles.content}>
        <h1 style={styles.heading}>User Management</h1>

        <div style={styles.tabsRow}>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              style={{ ...styles.tab, ...(activeTab === tab.key ? styles.tabActive : null) }}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={styles.card}>
          <div style={styles.headerRow}>
            <span style={styles.headerCell}>Name</span>
            <span style={styles.headerCell}>Email</span>
            <span style={styles.headerCell}>Role</span>
            <span style={styles.headerCell}>Status</span>
            <span style={styles.headerCell}>Date Registered</span>
            <span style={styles.headerCell}>Actions</span>
          </div>

          {filteredUsers.map((user) => (
            <div key={user.id} style={styles.row}>
              <p style={styles.cellText}>{user.name}</p>
              <p style={styles.cellText}>{user.email}</p>
              <p style={{ ...styles.cellText, color: ROLE_COLOR[user.role] }}>{user.role}</p>
              <StatusBadge status={user.status} />
              <p style={styles.cellText}>{formatDate(user.dateRegistered)}</p>
              <div style={styles.actionsCell}>
                <button type="button" style={styles.iconBtn} onClick={() => setViewingUser(user)} aria-label="View user">
                  <img src={eyeIcon} alt="" width={18} height={18} />
                </button>
                <button type="button" style={styles.iconBtn} onClick={() => setDisablingUser(user)} aria-label="Disable user">
                  <img src={editIcon} alt="" width={18} height={18} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div style={styles.footerRow}>
          <div style={{ display: 'flex', gap: 6 }}>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                type="button"
                style={{ ...styles.pageBtn, ...(page === currentPage ? styles.pageBtnActive : null) }}
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </button>
            ))}
          </div>
          <span style={styles.resultsText}>{resultsText}</span>
        </div>
      </div>

      {viewingUser && (
        <UserDetailsModal
          user={viewingUser}
          onClose={() => setViewingUser(null)}
          onAccept={handleAccept}
          onReject={handleReject}
        />
      )}

      {disablingUser && (
        <DisableAccountModal
          user={disablingUser}
          onClose={() => setDisablingUser(null)}
          onConfirm={handleDisable}
        />
      )}
    </AdminSidebar>
  );
}