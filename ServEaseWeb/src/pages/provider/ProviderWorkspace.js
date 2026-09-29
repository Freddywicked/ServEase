import React, { useEffect, useState } from "react";
import { Link, useNavigate, useLocation, useParams } from "react-router-dom";
import Brand from "../../components/common/Brand";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBolt,
  faCaretDown,
  faChartLine,
  faChevronLeft,
  faCirclePlus,
  faComments,
  faGear,
  faImage,
  faLocationDot,
  faRightFromBracket,
  faScrewdriverWrench,
  faTableCellsLarge,
} from "@fortawesome/free-solid-svg-icons";
import "./provider-workspace.css";
import "./provider-uniform.css";
import "./provider-density.css";
import "./provider-reference.css";
import { providerApi } from "../../services/providerApi";
const nav = [
  [faTableCellsLarge, "Dashboard", "/provider/dashboard"],
  [faGear, "Service Requests", "/provider/requests"],
  [faScrewdriverWrench, "Active Jobs", "/provider/jobs"],
  [faComments, "Messages", "/provider/messages"],
  [faChartLine, "Earnings", "/provider/earnings"],
];
export function ProviderLayout({ children }) {
  const loc = useLocation();
  const go = useNavigate();
  const [accountName, setAccountName] = useState(
    localStorage.getItem("servease_account_name") || "Jess Garcia",
  );

  useEffect(() => {
    providerApi.getProfile().then((profile) => {
      if (!localStorage.getItem("servease_account_name")) setAccountName(profile.name);
    });
  }, []);
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
          {initials} <FontAwesomeIcon icon={faCaretDown} />
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
        className={(typeof x === "string" ? x : x.value) === active ? "active" : ""}
        onClick={() => setActive(typeof x === "string" ? x : x.value)}
        key={typeof x === "string" ? x : x.value}
      >
        {typeof x === "string" ? x : x.label}
      </button>
    ))}
  </div>
);

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const timeOptions = ["10:00 AM", "11:00 AM"];

function AvailabilityModal({ onClose }) {
  const [month, setMonth] = useState(new Date(2026, 8, 1));
  const [selectedDate, setSelectedDate] = useState("2026-09-09");
  const [selectedTime, setSelectedTime] = useState("10:00 AM");
  const [unavailableSlots, setUnavailableSlots] = useState([]);

  useEffect(() => {
    providerApi.getCalendar().then((calendar) => setUnavailableSlots(calendar.unavailableSlots));
  }, []);

  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDay = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const slot = `${selectedDate}|${selectedTime}`;
  const isUnavailable = unavailableSlots.includes(slot);

  const changeMonth = (offset) => {
    const next = new Date(year, monthIndex + offset, 1);
    setMonth(next);
    setSelectedDate(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`);
  };

  const toggleSlot = async () => {
    await providerApi.toggleUnavailableSlot(slot);
    const calendar = await providerApi.getCalendar();
    setUnavailableSlots(calendar.unavailableSlots);
  };

  return (
    <div className="provider-modal" role="dialog" aria-modal="true" aria-label="Manage availability">
      <section className="availability-modal">
        <button className="availability-close" onClick={onClose} aria-label="Close calendar">×</button>
        <b>Select Date</b>
        <div className="availability-calendar">
          <div className="availability-calendar-heading">
            <button onClick={() => changeMonth(-1)} aria-label="Previous month">‹</button>
            <select value={monthIndex} onChange={(event) => { const next = new Date(year, Number(event.target.value), 1); setMonth(next); setSelectedDate(`${year}-${String(next.getMonth() + 1).padStart(2, "0")}-01`); }}>
              {monthNames.map((name, index) => <option value={index} key={name}>{name.slice(0, 3)}</option>)}
            </select>
            <select value={year} onChange={(event) => { const nextYear = Number(event.target.value); setMonth(new Date(nextYear, monthIndex, 1)); setSelectedDate(`${nextYear}-${String(monthIndex + 1).padStart(2, "0")}-01`); }}>
              {[2026, 2027, 2028].map((option) => <option value={option} key={option}>{option}</option>)}
            </select>
            <button onClick={() => changeMonth(1)} aria-label="Next month">›</button>
          </div>
          <div className="calendar-weekdays">{["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => <span key={day}>{day}</span>)}</div>
          <div className="calendar-days">
            {Array.from({ length: firstDay }, (_, index) => <span key={`blank-${index}`} />)}
            {Array.from({ length: daysInMonth }, (_, index) => {
              const day = index + 1;
              const value = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const hasUnavailableTime = unavailableSlots.some((item) => item.startsWith(`${value}|`));
              return <button className={`${value === selectedDate ? "selected" : ""} ${hasUnavailableTime ? "partially-unavailable" : ""}`} onClick={() => setSelectedDate(value)} key={value}>{day}</button>;
            })}
          </div>
        </div>
        <b>Select Time</b>
        <div className="availability-times">
          {timeOptions.map((time) => <button className={time === selectedTime ? "selected" : ""} onClick={() => setSelectedTime(time)} key={time}>{time}</button>)}
        </div>
        <button className="availability-submit" onClick={toggleSlot}>{isUnavailable ? "Mark as Available" : "Mark as Unavailable"}</button>
      </section>
    </div>
  );
}

export function ProviderDashboard() {
  const [workspace, setWorkspace] = useState(null);
  const [showCalendar, setShowCalendar] = useState(false);

  useEffect(() => {
    providerApi.get().then(setWorkspace);
  }, []);

  if (!workspace) return <ProviderLayout><p>Loading dashboard…</p></ProviderLayout>;
  const activeJobs = workspace.jobs.filter((job) => job.status === "In Progress").length;
  const pendingRequest = workspace.serviceRequests.find((request) => request.status === "new");
  return (
    <ProviderLayout>
      <h1>Welcome, {workspace.profile.name.split(" ")[0]}!</h1>
      <h2>{workspace.profile.role}</h2>
      <div className="provider-stats provider-dashboard-stats">
        <div>
          <b>{activeJobs}</b>
          <span>Active jobs</span>
        </div>
        <div>
          <b>{workspace.earnings.transactions.length}</b>
          <span>This month</span>
        </div>
        <div>
          <b>4.4</b>
          <span>Rating</span>
        </div>
      </div>
      <button
        className="provider-primary"
        onClick={() => setShowCalendar(true)}
      >
        Manage your Calendar
      </button>
      <div className="provider-dashboard-grid">
        <section>
          <h3>PENDING REQUEST</h3>
          <div>{pendingRequest ? `#${pendingRequest.id} · ${pendingRequest.customer}` : "None"}</div>
        </section>
        <section>
          <h3>NOTIFICATIONS</h3>
          <div>No Notifications</div>
        </section>
      </div>
      <section className="provider-empty provider-active-repair">
        <h3>ACTIVE REPAIR</h3>
        <div>{activeJobs ? `${workspace.jobs[0].id} · ${workspace.jobs[0].stage}` : "No Active Repair"}</div>
      </section>
      {showCalendar && <AvailabilityModal onClose={() => setShowCalendar(false)} />}
    </ProviderLayout>
  );
}
export function ProviderRequests() {
  const go = useNavigate();
  const [tab, setTab] = useState("New");
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    providerApi.getServiceRequests().then(setRequests);
  }, []);

  const visibleRequests = requests.filter((request) => {
    if (tab === "New") return request.status === "new";
    if (tab === "Pending Quotation") return request.status === "quoted";
    return request.status !== "declined";
  });

  return (
    <ProviderLayout>
      <h1>Incoming Service Requests</h1>
      <Pills
        items={[{ value: "New", label: "New (1)" }, "Pending Quotation", "All"]}
        active={tab}
        setActive={setTab}
      />
      {visibleRequests.map((request) => (
        <article className={`provider-request-card provider-request-card--${request.status}`} key={request.id}>
          <header className="provider-request-header">
            <div>
              <b>Request #{request.id}</b>
              <small>{request.customer} | {request.date}</small>
            </div>
            {request.status === "quoted" && <strong className="request-state quoted">Quoted</strong>}
          </header>
          <div className="ai-strip"><FontAwesomeIcon className="ai-bolt" icon={faBolt} /> AI suggests {request.diagnosis.toLowerCase()} ({request.confidence}% confidence)</div>
          <p className="provider-request-distance"><FontAwesomeIcon icon={faLocationDot} /> {request.distance}</p>
          <hr className="provider-request-divider" />
          {request.quote ? (
            <div className="provider-quote-footer">
              <small>Quote sent: ₱{request.quote.labor.toLocaleString()} (Labor), ₱{request.quote.parts.toLocaleString()} (Parts)</small>
              <b className="quote-total">TOTAL: ₱{(request.quote.labor + request.quote.parts).toLocaleString()}</b>
              <button className="provider-message-customer" onClick={() => go("/provider/messages")}>Message Customer</button>
            </div>
          ) : <div className="provider-request-actions"><button onClick={() => go(`/provider/requests/${request.id}`)}>View</button></div>}
        </article>
      ))}
      {!visibleRequests.length && <p className="provider-empty">No requests in this view.</p>}
    </ProviderLayout>
  );
}
export function RequestDetail() {
  const go = useNavigate();
  const { id } = useParams();
  const [modal, setModal] = useState("");
  const [reason, setReason] = useState("");
  const [request, setRequest] = useState(null);
  const [quote, setQuote] = useState({ labor: "", parts: "", notes: "" });

  useEffect(() => {
    providerApi.getRequest(id).then(setRequest);
  }, [id]);

  if (!request) return <ProviderLayout><p>Loading service request…</p></ProviderLayout>;

  const submitQuote = async () => {
    await providerApi.sendQuote(request.id, {
      labor: Number(quote.labor) || 0,
      parts: Number(quote.parts) || 0,
      notes: quote.notes,
    });
    go("/provider/requests");
  };

  const decline = async () => {
    await providerApi.declineRequest(request.id, reason.trim());
    go("/provider/requests");
  };

  return (
    <ProviderLayout>
      <h1>Service Request</h1>
      <section className="provider-detail provider-request-detail">
        <h2>Request #{request.id}</h2>
        <b>Customer Information</b>
        <div className="customer-mini">
          <i />{" "}
          <span>
            <b>{request.customer}</b>
            <small>{request.address}</small>
          </span>
          <u><FontAwesomeIcon icon={faLocationDot} />{request.distance}</u>
        </div>
        <b>Customer Concern</b>
        <p>
          {request.concern}
        </p>
        <div className="image-placeholder"><FontAwesomeIcon icon={faImage} /></div>
        <b>AI Diagnosis (Preliminary)</b>
        <div className="ai-strip">
          <FontAwesomeIcon className="ai-bolt" icon={faBolt} /> AI suggests {request.diagnosis.toLowerCase()} ({request.confidence}% confidence)
        </div>
        <small>
          Possible causes:
          <br />
          <b>
            {request.possibleCauses.map((cause) => <React.Fragment key={cause}>{cause}<br /></React.Fragment>)}
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
          <section className={`provider-modal__panel provider-modal__panel--${modal}`}>
            <button className="provider-modal__close" onClick={() => setModal("")} aria-label="Close dialog">×</button>
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
                  onClick={decline}
                >
                  Send
                </button>
              </>
            ) : (
              <>
                <h3>Service Request Approved</h3>
                <p>Send a pre-repair quotation to the customer.</p>
                <div className="quote-inputs">
                  <label>
                    <span>Labor (Peso)</span>
                    <input aria-label="Labor (Peso)" placeholder="0.00" type="number" value={quote.labor} onChange={(event) => setQuote({ ...quote, labor: event.target.value })} />
                  </label>
                  <label>
                    <span>Parts (Peso)</span>
                    <input aria-label="Parts (Peso)" placeholder="0.00" type="number" value={quote.parts} onChange={(event) => setQuote({ ...quote, parts: event.target.value })} />
                  </label>
                  <FontAwesomeIcon className="quote-add" icon={faCirclePlus} aria-hidden="true" />
                </div>
                <label className="quote-notes">
                  <span>Notes</span>
                  <textarea placeholder="Parts needed, timeline..." value={quote.notes} onChange={(event) => setQuote({ ...quote, notes: event.target.value })} />
                </label>
                <button onClick={submitQuote}>Send Quote</button>
              </>
            )}
          </section>
        </div>
      )}
    </ProviderLayout>
  );
}
export function ProviderJobs() {
  const [view, setView] = useState("list");
  const [stage, setStage] = useState("Repairing");
  const [notes, setNotes] = useState("");
  const [cost, setCost] = useState("");
  const [jobs, setJobs] = useState([]);

  useEffect(() => {
    providerApi.getJobs().then(setJobs);
  }, []);

  const job = jobs[0];
  const returnToJobs = async () => {
    if (!job) return;
    if (view === "status") await providerApi.addJobUpdate(job.id, { stage, notes, createdAt: new Date().toISOString() });
    if (view === "parts") await providerApi.requestAdditionalParts(job.id, { cost: Number(cost) || 0, notes, createdAt: new Date().toISOString() });
    setNotes("");
    setCost("");
    setView("list");
    providerApi.getJobs().then(setJobs);
  };
  if (view === "status" || view === "parts")
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
        <section className={`provider-editor provider-editor--${view}`}>
          <div className="provider-editor-heading">
            <button className="provider-editor-back" type="button" onClick={() => setView("list")} aria-label="Back to active jobs"><FontAwesomeIcon icon={faChevronLeft} /></button>
            <h2>{view === "status" ? "Update Status" : "Notify Additional Parts"}</h2>
          </div>
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
                <FontAwesomeIcon icon={faImage} />
                <small>Upload Image</small>
              </div>
              <button onClick={returnToJobs}>Push Update</button>
            </>
          ) : (
            <>
              <h3>Explain the unexpected additional parts to the customer.</h3>
              <label>
                Additional Cost (Peso)
                <input type="number" placeholder="0.00" value={cost} onChange={(event) => setCost(event.target.value)} />
              </label>
              <label>
                Notes
                <textarea placeholder="Parts needed, timeline..." value={notes} onChange={(event) => setNotes(event.target.value)} />
              </label>
              <button onClick={returnToJobs}>Send Request</button>
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
      {job && <article className="provider-job">
        <div className="provider-job-heading">
          <div>
            <b>Request #{job.id}</b>
            <small>{job.customer} | {job.date}</small>
          </div>
          <span>{job.status}</span>
        </div>
        <div className="ai-strip">
          <FontAwesomeIcon className="ai-bolt" icon={faBolt} /> AI suggests {job.diagnosis} ({job.confidence}% confidence)
        </div>
        <div className="provider-job-divider" />
        <div className="job-progress">
          <i />
          <i />
          <i />
          <i />
        </div>
        <div className="provider-job-footer">
          <div className="provider-job-copy">
            <b>Current Step: {job.stage}</b>
            <small>{job.notes}</small>
          </div>
          <div className="provider-job-actions">
            <button onClick={() => setView("status")}>Update Status</button>
            <button onClick={() => setView("parts")}>
              Notify Additional Parts
            </button>
          </div>
        </div>
      </article>}
    </ProviderLayout>
  );
}
