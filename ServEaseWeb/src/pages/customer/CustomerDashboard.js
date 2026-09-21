import React from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import Brand from "../../components/common/Brand";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBars,
  faClockRotateLeft,
  faComments,
  faMagnifyingGlass,
  faRightFromBracket,
  faScrewdriverWrench,
  faTableCellsLarge,
} from "@fortawesome/free-solid-svg-icons";
const nav = [
  [faTableCellsLarge, "Dashboard", "/customer/dashboard"],
  [faMagnifyingGlass, "Find Service Providers", "/customer/providers"],
  [faScrewdriverWrench, "Track Requests", "/customer/requests"],
  [faComments, "Messages", "/customer/messages"],
  [faClockRotateLeft, "History", "/customer/history"],
];
export function CustomerLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const accountName =
    localStorage.getItem("servease_account_name") || "Customer Guest";
  const initials = accountName
    .split(" ")
    .map((x) => x[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="customer-shell">
      <header className="customer-header">
        <Brand />
        <button
          className="profile-button"
          onClick={() => navigate("/customer/profile")}
          aria-label="Open profile"
        >
          {initials} <FontAwesomeIcon icon={faBars} />
        </button>
      </header>
      <aside className="customer-sidebar">
        <nav>
          {nav.map(([icon, name, path]) => (
            <Link
              key={name}
              className={location.pathname.startsWith(path) ? "active" : ""}
              to={path}
            >
              <span>
                <FontAwesomeIcon icon={icon} />
              </span>
              {name}
            </Link>
          ))}
        </nav>
        {!location.pathname.endsWith("/profile") && (
          <button onClick={() => navigate("/signin")} className="logout">
            <FontAwesomeIcon icon={faRightFromBracket} />
            <span>Log Out</span>
          </button>
        )}
      </aside>
      <main className="customer-content">{children}</main>
    </div>
  );
}
export default function CustomerDashboard() {
  const nav = useNavigate();
  return (
    <CustomerLayout>
      <h1 className="customer-title">Welcome, Juan!</h1>
      <h2 className="customer-subtitle">What needs fixing today?</h2>
      <button
        className="request-button"
        onClick={() => nav("/customer/request")}
      >
        Create New Request
      </button>
      <section className="dashboard-section">
        <h3>NOTIFICATIONS</h3>
        <div className="empty-card">No Notifications</div>
      </section>
      <section className="dashboard-section">
        <h3>ACTIVE REPAIR</h3>
        <div className="empty-card repair">No Active Repair</div>
      </section>
    </CustomerLayout>
  );
}
