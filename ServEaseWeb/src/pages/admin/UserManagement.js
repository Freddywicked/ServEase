import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEye,
  faPenToSquare,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import AdminLayout from "./AdminLayout";
import "./user-management.css";
const initialUsers = [
  ["Juan Dela Cruz", "juan@gmail.com", "Customer", "Active"],
  ["Juan Dela Cruz", "juan@gmail.com", "Service Provider", "Pending"],
  ["Juan Dela Cruz", "juan@gmail.com", "Customer", "Active"],
  ["Juan Dela Cruz", "juan@gmail.com", "Customer", "Active"],
  ["Juan Dela Cruz", "juan@gmail.com", "Customer", "Active"],
  ["Juan Dela Cruz", "juan@gmail.com", "Customer", "Active"],
  ["Juan Dela Cruz", "juan@gmail.com", "Customer", "Active"],
  ["Juan Dela Cruz", "juan@gmail.com", "Service Provider", "Pending"],
].map(([name, email, role, status], index) => ({
  id: index + 1,
  name,
  email,
  role,
  status,
  registered: "MM/DD/YY",
}));
function UserManagement() {
  const [users, setUsers] = useState(initialUsers);
  const [tab, setTab] = useState("All Users");
  const [selected, setSelected] = useState(null);
  const [reason, setReason] = useState("");
  const filtered = users.filter(
    (u) =>
      tab === "All Users" ||
      (tab === "Customers" && u.role === "Customer") ||
      (tab === "Service Providers" && u.role === "Service Provider") ||
      (tab === "Pending" && u.status === "Pending"),
  );
  const close = () => {
    setSelected(null);
    setReason("");
  };
  const changeStatus = (status) => {
    setUsers((all) =>
      all.map((u) => (u.id === selected.id ? { ...u, status } : u)),
    );
    close();
  };
  return (
    <AdminLayout>
      <h1 className="management-title">User Management</h1>
      <div className="user-tabs">
        {["All Users", "Customers", "Service Providers", "Pending"].map(
          (item) => (
            <button
              onClick={() => setTab(item)}
              className={tab === item ? "active" : ""}
              key={item}
            >
              {item}
            </button>
          ),
        )}
      </div>
      <section className="user-table">
        <div className="table-head">
          <span>NAME</span>
          <span>EMAIL</span>
          <span>ROLE</span>
          <span>STATUS</span>
          <span>DATE REGISTERED</span>
          <span>ACTIONS</span>
        </div>
        {filtered.map((user) => (
          <div className="table-row" key={user.id}>
            <span>{user.name}</span>
            <span>{user.email}</span>
            <span className="table-role">{user.role}</span>
            <span>
              <i className={`status ${user.status.toLowerCase()}`}>
                {user.status}
              </i>
            </span>
            <span>{user.registered}</span>
            <span>
              <button
                className="view-action"
                title={`View ${user.name}`}
                aria-label={`View ${user.name}`}
                onClick={() => setSelected({ ...user, mode: "view" })}
              >
                <FontAwesomeIcon icon={faEye} />
              </button>
              <button
                className="edit-action"
                title={`Manage ${user.name}'s account`}
                aria-label={`Manage ${user.name}'s account`}
                onClick={() => setSelected({ ...user, mode: "manage" })}
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
          <button></button>
        </div>
        <span>Showing 1 to {filtered.length} of 12345 users</span>
      </div>
      {selected && (
        <div className="admin-modal-backdrop" onMouseDown={close}>
          <section
            className="admin-modal"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button className="modal-close" onClick={close}>
              <FontAwesomeIcon icon={faXmark} />
            </button>
            <h2>
              {selected.name}{" "}
              <i className={`status ${selected.status.toLowerCase()}`}>
                {selected.status}
              </i>
            </h2>
            <p className="modal-role">
              {selected.mode === "manage" ? "Account controls" : selected.role}
            </p>
            <dl>
              <dt>Email</dt>
              <dd>{selected.email}</dd>
              <dt>Phone</dt>
              <dd>1234567</dd>
              <dt>Birthdate</dt>
              <dd>1/1/1999</dd>
              {selected.role === "Service Provider" && (
                <>
                  <dt>Service Category</dt>
                  <dd>Home Repair</dd>
                  <dt>Years of Experience</dt>
                  <dd>1</dd>
                  <dt>Services Offered</dt>
                  <dd>Plumbing · Home Appliance Renovation · Electrician</dd>
                </>
              )}
            </dl>
            {selected.mode === "view" && (
              <>
                <div className="document-buttons">
                  <button>
                    <FontAwesomeIcon icon={faEye} /> Valid ID
                  </button>
                  {selected.role === "Service Provider" && (
                    <button>
                      <FontAwesomeIcon icon={faEye} /> Supporting Document
                    </button>
                  )}
                  <button>
                    <FontAwesomeIcon icon={faEye} /> Selfie
                  </button>
                </div>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Enter your reason for rejection."
                />
                <div className="modal-actions">
                  <button
                    className="accept"
                    onClick={() => changeStatus("Active")}
                  >
                    Accept
                  </button>
                  <button
                    className="reject"
                    onClick={() => changeStatus("Rejected")}
                  >
                    Reject
                  </button>
                </div>
              </>
            )}
            {selected.mode === "manage" && (
              <div className="modal-actions">
                <button
                  className="reject"
                  onClick={() => changeStatus("Disabled")}
                >
                  Disable account
                </button>
              </div>
            )}
          </section>
        </div>
      )}
    </AdminLayout>
  );
}
export default UserManagement;
