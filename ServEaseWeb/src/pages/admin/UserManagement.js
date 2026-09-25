import React, { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEye,
  faPenToSquare,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import AdminLayout from "./AdminLayout";
import { adminUsersApi } from "../../services/adminUsersApi";
import "./user-management.css";

const tabs = ["All Users", "Customers", "Service Providers", "Pending"];

function matchesTab(user, tab) {
  if (tab === "Customers") return user.role === "Customer";
  if (tab === "Service Providers") return user.role === "Service Provider";
  if (tab === "Pending") return user.status === "Pending";

  return true;
}

function StatusBadge({ status }) {
  return <i className={`status ${status.toLowerCase()}`}>{status}</i>;
}

function UserDetails({ user }) {
  const providerProfile = user.providerProfile;

  return (
    <dl>
      <dt>Email</dt>
      <dd>{user.email}</dd>
      <dt>Address</dt>
      <dd>{user.address}</dd>
      <dt>Phone</dt>
      <dd>{user.phone}</dd>
      <dt>Birthdate</dt>
      <dd>{user.birthdate}</dd>
      {providerProfile && (
        <>
          <dt>Service Category</dt>
          <dd>{providerProfile.serviceCategory}</dd>
          <dt>Years of Experience</dt>
          <dd>{providerProfile.yearsOfExperience}</dd>
          <dt>Services Offered</dt>
          <dd>{providerProfile.servicesOffered.join(" · ")}</dd>
        </>
      )}
    </dl>
  );
}

function DocumentButtons({ documents, onOpenDocument }) {
  const documentLabels = [
    ["validId", "Valid ID"],
    ["supportingDocument", "Supporting Document"],
    ["selfie", "Selfie"],
  ];

  return (
    <div className="document-buttons">
      {documentLabels.map(([key, label]) => {
        const document = documents[key];

        return (
          <button
            key={key}
            title={`Preview ${document.name}`}
            type="button"
            onClick={() => onOpenDocument(document, label)}
          >
            <FontAwesomeIcon icon={faEye} /> {label}
          </button>
        );
      })}
    </div>
  );
}

function Modal({ children, className = "", onClose }) {
  return (
    <div className="admin-modal-backdrop" onMouseDown={onClose}>
      <section
        className={`admin-modal ${className}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <FontAwesomeIcon icon={faXmark} />
        </button>
        {children}
      </section>
    </div>
  );
}

function UserModal({
  user,
  reason,
  setReason,
  onApprove,
  onReject,
  onOpenDocument,
  onClose,
}) {
  const isProvider = user.role === "Service Provider";
  const canReviewApplication = isProvider && user.status === "Pending";

  return (
    <Modal onClose={onClose}>
      <h2>
        {user.name} <StatusBadge status={user.status} />
      </h2>
      <p className="modal-role">{user.role}</p>
      <UserDetails user={user} />
      {isProvider && (
        <>
          <DocumentButtons
            documents={user.providerProfile.documents}
            onOpenDocument={onOpenDocument}
          />
          {canReviewApplication && (
            <>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Enter your reason for rejection."
              />
              <div className="modal-actions">
                <button className="accept" onClick={onApprove}>
                  Accept
                </button>
                <button className="reject" onClick={onReject}>
                  Reject
                </button>
              </div>
            </>
          )}
        </>
      )}
    </Modal>
  );
}

function DocumentPreviewModal({ document, label, onClose }) {
  const isPdf = document.mimeType === "application/pdf";

  return (
    <div className="document-preview-backdrop" onMouseDown={onClose}>
      <section
        className="document-preview-modal"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <FontAwesomeIcon icon={faXmark} />
        </button>
        <h2>{label}</h2>
        <p>{document.name}</p>
        {isPdf ? (
          <iframe title={label} src={document.url} />
        ) : (
          <img src={document.url} alt={`${label} preview`} />
        )}
      </section>
    </div>
  );
}

function DisableModal({ user, onConfirm, onClose }) {
  return (
    <Modal onClose={onClose} className="disable-modal">
      <h2>Are you sure you want to disable this account?</h2>
      <div className="disable-user-summary">
        <strong>{user.name}</strong>
        <span>{user.role}</span>
      </div>
      <div className="modal-actions">
        <button className="accept" onClick={onClose}>
          No
        </button>
        <button className="reject" onClick={onConfirm}>
          Disable
        </button>
      </div>
    </Modal>
  );
}

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [activeTab, setActiveTab] = useState("All Users");
  const [selectedUser, setSelectedUser] = useState(null);
  const [userToDisable, setUserToDisable] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [previewDocument, setPreviewDocument] = useState(null);

  useEffect(() => {
    adminUsersApi.getUsers().then(setUsers);
  }, []);

  const filteredUsers = useMemo(
    () => users.filter((user) => matchesTab(user, activeTab)),
    [activeTab, users],
  );

  function closeDetails() {
    setSelectedUser(null);
    setRejectionReason("");
  }

  function openDocument(document, label) {
    setPreviewDocument({ document, label });
  }

  async function updateSelectedUser(status) {
    if (!selectedUser) return;

    const updatedUser = await adminUsersApi.updateUserStatus(
      selectedUser.id,
      status,
      status === "Rejected" ? rejectionReason : "",
    );

    setUsers((currentUsers) =>
      currentUsers.map((user) =>
        user.id === updatedUser.id ? updatedUser : user,
      ),
    );
    closeDetails();
  }

  async function disableUser() {
    if (!userToDisable) return;

    const updatedUser = await adminUsersApi.updateUserStatus(
      userToDisable.id,
      "Disabled",
    );

    setUsers((currentUsers) =>
      currentUsers.map((user) =>
        user.id === updatedUser.id ? updatedUser : user,
      ),
    );
    setUserToDisable(null);
  }

  return (
    <AdminLayout>
      <h1 className="management-title">User Management</h1>
      <div className="user-tabs">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={activeTab === tab ? "active" : ""}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <section className="user-table">
        <div className="table-head">
          <span>Name</span>
          <span>Email</span>
          <span>Role</span>
          <span>Status</span>
          <span>Date Registered</span>
          <span>Actions</span>
        </div>
        {filteredUsers.map((user) => (
          <div className="table-row" key={user.id}>
            <span>{user.name}</span>
            <span>{user.email}</span>
            <span className="table-role">{user.role}</span>
            <span>
              <StatusBadge status={user.status} />
            </span>
            <span>{user.registeredAt}</span>
            <span>
              <button
                className="view-action"
                title={`View ${user.name}`}
                onClick={() => setSelectedUser(user)}
              >
                <FontAwesomeIcon icon={faEye} />
              </button>
              <button
                className="edit-action"
                title={`Disable ${user.name}`}
                onClick={() => setUserToDisable(user)}
              >
                <FontAwesomeIcon icon={faPenToSquare} />
              </button>
            </span>
          </div>
        ))}
      </section>

      <div className="table-footer">
        <div>
          <button className="page-active">1</button>
          <button>2</button>
          <button>3</button>
          <button>…</button>
        </div>
        <span>Showing 1 to {filteredUsers.length} of {users.length} users</span>
      </div>

      {selectedUser && (
        <UserModal
          user={selectedUser}
          reason={rejectionReason}
          setReason={setRejectionReason}
          onApprove={() => updateSelectedUser("Active")}
          onReject={() => updateSelectedUser("Rejected")}
          onOpenDocument={openDocument}
          onClose={closeDetails}
        />
      )}
      {userToDisable && (
        <DisableModal
          user={userToDisable}
          onConfirm={disableUser}
          onClose={() => setUserToDisable(null)}
        />
      )}
      {previewDocument && (
        <DocumentPreviewModal
          document={previewDocument.document}
          label={previewDocument.label}
          onClose={() => setPreviewDocument(null)}
        />
      )}
    </AdminLayout>
  );
}
