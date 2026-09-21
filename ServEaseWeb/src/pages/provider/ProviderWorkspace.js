import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import Brand from "../../components/common/Brand";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBars,
  faChartLine,
  faComments,
  faRightFromBracket,
  faScrewdriverWrench,
  faTableCellsLarge,
  faWrench,
} from "@fortawesome/free-solid-svg-icons";
import "./provider-workspace.css";
import "./provider-uniform.css";
import "./provider-density.css";
const nav = [
  [faTableCellsLarge, "Dashboard", "/provider/dashboard"],
  [faScrewdriverWrench, "Service Requests", "/provider/requests"],
  [faWrench, "Active Jobs", "/provider/jobs"],
  [faComments, "Messages", "/provider/messages"],
  [faChartLine, "Earnings", "/provider/earnings"],
];
export function ProviderLayout({ children }) {
  const loc = useLocation(),
    go = useNavigate();
  const accountName =
    localStorage.getItem("servease_account_name") || "Jess Garcia";
  const initials = accountName
    .split(" ")
    .map((x) => x[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="customer-shell provider-shell">
      <header className="customer-header">
        <Brand />
        <button
          className="profile-button"
          onClick={() => go("/provider/profile")}
          aria-label="Open profile"
        >
          {initials} <FontAwesomeIcon icon={faBars} />
        </button>
      </header>
      <aside className="customer-sidebar">
        <nav>
          {nav.map(([icon, label, to]) => (
            <Link
              className={loc.pathname.startsWith(to) ? "active" : ""}
              to={to}
              key={to}
            >
              <span>
                <FontAwesomeIcon icon={icon} />
              </span>
              {label}
            </Link>
          ))}
        </nav>
        {!loc.pathname.endsWith("/profile") && (
          <button onClick={() => go("/signin")} className="logout">
            <FontAwesomeIcon icon={faRightFromBracket} />
            <span>Log Out</span>
          </button>
        )}
      </aside>
      <main className="customer-content provider-content">{children}</main>
    </div>
  );
}
const Pills = ({ items, active, setActive }) => (
  <div className="provider-pills">
    {items.map((x) => (
      <button
        className={x === active ? "active" : ""}
        onClick={() => setActive(x)}
        key={x}
      >
        {x}
      </button>
    ))}
  </div>
);
export function ProviderDashboard() {
  const go = useNavigate();
  return (
    <ProviderLayout>
      <h1>Welcome, Jess!</h1>
      <h2>Repair Specialist</h2>
      <div className="provider-stats">
        <div>
          <b>4</b>
          <span>Active jobs</span>
        </div>
        <div>
          <b>44</b>
          <span>This month</span>
        </div>
        <div>
          <b>4.4</b>
          <span>Rating</span>
        </div>
      </div>
      <button
        className="provider-primary"
        onClick={() => go("/provider/calendar")}
      >
        Manage your Calendar
      </button>
      <div className="provider-dashboard-grid">
        <section>
          <h3>PENDING REQUEST</h3>
          <div>None</div>
        </section>
        <section>
          <h3>NOTIFICATIONS</h3>
          <div>No Notifications</div>
        </section>
      </div>
      <section className="provider-empty">
        <h3>ACTIVE REPAIR</h3>
        <div>No Active Repair</div>
      </section>
    </ProviderLayout>
  );
}
export function ProviderRequests() {
  const go = useNavigate(),
    [tab, setTab] = useState("New (1)"),
    [schedule, setSchedule] = useState(false),
    [date, setDate] = useState("2026-09-10"),
    [time, setTime] = useState("10:00 AM");
  const appointment = tab === "Appointment";
  const quote = tab === "Pending Quotation";
  return (
    <ProviderLayout>
      <h1>Incoming Service Requests</h1>
      <Pills
        items={["New (1)", "Pending Quotation", "Appointment", "All"]}
        active={tab}
        setActive={setTab}
      />
      <article className="provider-request-card">
        {appointment ? (
          <>
            <b>Request #SR-0000</b>
            <small>Micco Dominic sent a new schedule.</small>
            <strong className="request-state">Pending Appointment</strong>
            <h3>
              {date.replaceAll("-", "/")} {time}
            </h3>
            <hr />
            <b>Reason for New Schedule</b>
            <small>
              Customer asked for a different date because the original slot is
              unavailable.
            </small>
            <div>
              <button onClick={() => go("/provider/calendar")}>Accept</button>
              <button onClick={() => setSchedule(true)}>
                Suggest new Schedule
              </button>
            </div>
          </>
        ) : quote ? (
          <>
            <b>Request #SR-0000</b>
            <small>Nick Duran | Jun 27</small>
            <strong className="request-state quoted">Quoted</strong>
            <div className="ai-strip">
              ϟ　AI suggests drain panel replacement (91% confidence)
            </div>
            <p>●　1 km away</p>
            <hr />
            <small>Quote sent: ₱800 pesos (Labor), ₱2,000 pesos (Parts)</small>
            <b className="quote-total">TOTAL: ₱2,800</b>
            <button>Message Customer</button>
          </>
        ) : (
          <>
            <b>Request #SR-0000</b>
            <small>Dominic Alcantara | Jun 27</small>
            <div className="ai-strip">
              ϟ　AI suggests capacitor failure (82% confidence)
            </div>
            <p>●　1.2 km away</p>
            <hr />
            <button onClick={() => go("/provider/requests/SR-0000")}>
              View
            </button>
          </>
        )}
      </article>
      {schedule && (
        <div className="provider-modal">
          <section>
            <button onClick={() => setSchedule(false)}>×</button>
            <h3>Suggest new schedule</h3>
            <p>Offer an available appointment to the customer.</p>
            <label>
              Select date
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label>
              Select time
              <select value={time} onChange={(e) => setTime(e.target.value)}>
                <option>10:00 AM</option>
                <option>11:00 AM</option>
                <option>1:00 PM</option>
              </select>
            </label>
            <button onClick={() => setSchedule(false)}>Send schedule</button>
          </section>
        </div>
      )}
    </ProviderLayout>
  );
}
export function RequestDetail() {
  const go = useNavigate(),
    [modal, setModal] = useState(""),
    [reason, setReason] = useState("");
  return (
    <ProviderLayout>
      <h1>Service Request</h1>
      <section className="provider-detail">
        <h2>Request #SR-0000</h2>
        <b>Customer Information</b>
        <div className="customer-mini">
          <i />{" "}
          <span>
            <b>Dominic Alcantara</b>
            <small>123 Maple St QC Manila</small>
          </span>
          <u>●　1.2 km away</u>
        </div>
        <b>Customer Concern</b>
        <p>
          Customer narration about the device's problem and preferred repair
          outcome.
        </p>
        <div className="image-placeholder">▧</div>
        <b>AI Diagnosis (Preliminary)</b>
        <div className="ai-strip">
          ϟ　AI suggests capacitor failure (82% confidence)
        </div>
        <small>
          Possible causes:
          <br />
          <b>
            Dirty air filter
            <br />
            Refrigerant leak
            <br />
            Compressor issue
          </b>
        </small>
        <div className="detail-actions">
          <button onClick={() => setModal("reject")}>Decline</button>
          <button className="approve" onClick={() => setModal("quote")}>
            Approve
          </button>
        </div>
      </section>
      {modal && (
        <div className="provider-modal">
          <section>
            <button onClick={() => setModal("")}>×</button>
            {modal === "reject" ? (
              <>
                <h3>Reason for Rejection</h3>
                <p>State a proper reason for rejection.</p>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Enter your reason here."
                />
                <button
                  disabled={!reason.trim()}
                  onClick={() => {
                    setModal("");
                    go("/provider/requests");
                  }}
                >
                  Send
                </button>
              </>
            ) : (
              <>
                <h3>Service Request Approved</h3>
                <p>Send a pre-repair quotation to the customer.</p>
                <div className="quote-inputs">
                  <input placeholder="Labor (Peso)" type="number" />
                  <input placeholder="Parts (Peso)" type="number" />
                </div>
                <textarea placeholder="Parts needed, timeline..." />
                <button
                  onClick={() => {
                    setModal("");
                    go("/provider/requests");
                  }}
                >
                  Send Quote
                </button>
              </>
            )}
          </section>
        </div>
      )}
    </ProviderLayout>
  );
}
export function ProviderJobs() {
  const go = useNavigate(),
    [view, setView] = useState("list"),
    [stage, setStage] = useState("Repairing"),
    [notes, setNotes] = useState("");
  if (view === "status" || view === "parts")
    return (
      <ProviderLayout>
        <h1>Active Jobs</h1>
        <Pills
          items={["All", "Active", "Pending", "Done"]}
          active="All"
          setActive={() => {}}
        />
        <section className="provider-editor">
          <h2>
            ‹　{view === "status" ? "Update Status" : "Notify Additional Parts"}
          </h2>
          {view === "status" ? (
            <>
              <label>
                Current stage
                <select
                  value={stage}
                  onChange={(e) => setStage(e.target.value)}
                >
                  <option>Repairing</option>
                  <option>On the way</option>
                  <option>Completed</option>
                </select>
              </label>
              <label>
                Notes
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Timeline, update, etc..."
                />
              </label>
              <div className="upload-job">
                ▧<br />
                <small>Upload Image</small>
              </div>
              <button onClick={() => setView("list")}>Push Update</button>
            </>
          ) : (
            <>
              <h3>Explain the unexpected additional parts to the customer.</h3>
              <label>
                Additional Cost (Peso)
                <input type="number" placeholder="0.00" />
              </label>
              <label>
                Notes
                <textarea placeholder="Parts needed, timeline..." />
              </label>
              <button onClick={() => setView("list")}>Send Request</button>
            </>
          )}
        </section>
      </ProviderLayout>
    );
  return (
    <ProviderLayout>
      <h1>Active Jobs</h1>
      <input
        className="provider-search"
        placeholder="Search job and details..."
      />
      <Pills
        items={["All", "Active", "Pending", "Done"]}
        active="All"
        setActive={() => {}}
      />
      <article className="provider-job">
        <b>Request #SR-0000</b>
        <span>In Progress</span>
        <small>Nikki P. | Jun 27</small>
        <div className="ai-strip">
          ϟ　AI suggests LCD problem (96% confidence)
        </div>
        <div className="job-progress">
          <i />
          <i />
          <i />
          <i />
        </div>
        <b>Current Step: Repairing</b>
        <small>Progress Payment 500 already paid by customer</small>
        <div>
          <button onClick={() => setView("status")}>Update Status</button>
          <button onClick={() => setView("parts")}>
            Notify Additional Parts
          </button>
        </div>
      </article>
    </ProviderLayout>
  );
}
