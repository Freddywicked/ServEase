import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CustomerLayout } from "./CustomerDashboard";
import { customerApi } from "../../services/customerApi";
const tabs = ["Sent", "Approved", "On-going", "Declined", "Done"];
const Timeline = () => (
  <div className="repair-timeline">
    <div className="complete">
      ✓
      <span>
        <b>Request received</b>
        <small>Jun 24 9:12 AM</small>
      </span>
    </div>
    <div className="complete">
      ✓
      <span>
        <b>Quotation approved</b>
        <small>Jun 24 10:12 AM</small>
      </span>
    </div>
    <div className="current">
      ●
      <span>
        <b>Service Provider is on the way</b>
        <small>Provider is heading to your doorstep</small>
      </span>
    </div>
    <div>
      ●
      <span>
        <b>Completed</b>
        <small>Pending</small>
      </span>
    </div>
  </div>
);
function Dialog({ kind, close, onSchedule }) {
  const [reason, setReason] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  return (
    <div className="customer-modal">
      <section>
        <button onClick={close}>×</button>
        {kind === "reason" ? (
          <>
            <h3>Reason for rejection</h3>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Tell the service provider why you declined."
            />
            <button disabled={!reason.trim()} onClick={close}>
              Confirm
            </button>
          </>
        ) : (
          <>
            <h3>Choose appointment</h3>
            <p>
              Select an appointment date and available time with your service
              provider.
            </p>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <div className="time-options">
              {["10:00 AM", "11:00 AM"].map((x) => (
                <button
                  className={time === x ? "selected" : ""}
                  onClick={() => setTime(x)}
                  key={x}
                >
                  {x}
                </button>
              ))}
            </div>
            <button
              disabled={!date || !time}
              onClick={() => onSchedule(date, time)}
            >
              Confirm appointment
            </button>
          </>
        )}
      </section>
    </div>
  );
}
export function Requests() {
  const [t, setT] = useState("Sent");
  const [items, setItems] = useState([]);
  const [dialog, setDialog] = useState("");
  const [appointment, setAppointment] = useState(null);
  const nav = useNavigate();
  useEffect(() => {
    customerApi.getRequests().then(setItems);
  }, []);
  const schedule = (date, time) => {
    setAppointment({ date, time });
    setDialog("");
  };
  const Card = ({ children }) => (
    <article className="request-card">{children}</article>
  );
  return (
    <CustomerLayout>
      <h1 className="customer-title">My Requests</h1>
      <input
        className="customer-search"
        placeholder="Search request details...."
      />
      <div className="filter-pills request-tabs">
        {tabs.map((x) => (
          <button
            className={t === x ? "active" : ""}
            onClick={() => setT(x)}
            key={x}
          >
            {x}
          </button>
        ))}
      </div>
      {t === "Sent" &&
        items
          .filter((x) => x.status === "sent")
          .map((r) => (
            <Card key={r.id}>
              <b>Request #{r.id}</b>
              <p>
                sent to <b>{r.provider || "A service provider"}</b>
                <br />
                Probable Cause
                <br />
                <strong>{r.problem || "Awaiting review"}</strong>
              </p>
              <div className="confidence">
                <i />
                <b>{r.confidence || 82}%</b>
              </div>
            </Card>
          ))}
      {t === "Approved" && (
        <>
          <Card>
            <b>Request #SR-0001</b>
            <span className="quote-tag">Initial payment</span>
            <p>Micco Dominic sent a quotation</p>
            <b>Labor Cost</b>
            <span className="price">₱850.00</span>
            <hr />
            <b>Total</b>
            <span className="price">₱850.00</span>
            <div className="right-buttons">
              <button onClick={() => setDialog("schedule")}>
                Accept &amp; schedule
              </button>
              <button onClick={() => setDialog("reason")}>Decline</button>
            </div>
          </Card>
          {appointment && (
            <Card>
              <b>Request #SR-0001</b>
              <span className="progress-badge">Appointment set</span>
              <p>Micco Dominic</p>
              <strong>
                {appointment.date} · {appointment.time}
              </strong>
              <p>
                <small>
                  Your appointment is part of this service request. Complete the
                  initial payment to confirm it.
                </small>
              </p>
              <div className="right-buttons">
                <button onClick={() => nav("/customer/payment")}>
                  Proceed to payment
                </button>
                <button onClick={() => setDialog("schedule")}>
                  Change schedule
                </button>
              </div>
            </Card>
          )}
        </>
      )}
      {t === "On-going" && (
        <>
          <Card>
            <b>Request #SR-0000</b>
            <span className="progress-badge">In progress</span>
            <p>Jose Rodolfo</p>
            <div className="payment-note">
              <b>Additional payment needed</b>
              <strong>₱3,000</strong>
              <br />
              <small>
                Provider has requested payment for additional approved parts.
              </small>
            </div>
            <div className="right-buttons">
              <button onClick={() => nav("/customer/payment")}>Approve</button>
              <button onClick={() => setDialog("reason")}>Decline</button>
              <button onClick={() => nav("/customer/messages")}>Message</button>
            </div>
          </Card>
          <Card>
            <b>Request #SR-0000</b>
            <span className="progress-badge">In progress</span>
            <p>Jose Rodolfo</p>
            <Timeline />
            <div className="right-buttons">
              <button onClick={() => nav("/customer/messages")}>Message</button>
            </div>
          </Card>
        </>
      )}
      {t === "Declined" && (
        <Card>
          <b>Request #SR-0000</b>
          <p>
            sent to <b>Mark Rivera</b>
            <br />
            Probable Cause
            <br />
            <strong>Liquid damage to charging circuit</strong>
          </p>
          <div className="confidence">
            <i />
            <b>82%</b>
          </div>
          <button
            className="find-button"
            onClick={() => nav("/customer/providers")}
          >
            Find Service Provider
          </button>
        </Card>
      )}
      {t === "Done" && (
        <Card>
          <b>#SR-0000</b>
          <span className="progress-badge">Completed</span>
          <p>Jose Rodolfo</p>
          <Timeline />
          <div className="right-buttons">
            <button onClick={() => nav("/customer/payment")}>
              Proceed to Payment
            </button>
            <button onClick={() => nav("/customer/messages")}>Message</button>
          </div>
        </Card>
      )}
      {dialog && (
        <Dialog
          kind={dialog}
          close={() => setDialog("")}
          onSchedule={schedule}
        />
      )}
    </CustomerLayout>
  );
}
export function Quote() {
  return <Requests />;
}
export function Payment() {
  const [method, setMethod] = useState("");
  const [done, setDone] = useState(false);
  const nav = useNavigate();
  return (
    <CustomerLayout>
      <h1 className="customer-title">My Requests</h1>
      <div className="payment">
        <h3>₱170.00</h3>
        <b>Select Payment Method</b>
        {["GCash", "QR PH", "Debit/Credit"].map((x) => (
          <label key={x}>
            <input
              type="radio"
              name="pay"
              checked={method === x}
              onChange={() => setMethod(x)}
            />
            　{x}
          </label>
        ))}
        <button disabled={!method} onClick={() => setDone(true)}>
          Continue
        </button>
      </div>
      {done && (
        <div className="customer-modal">
          <section>
            <button onClick={() => setDone(false)}>×</button>
            <h3>Payment Processed</h3>
            <p>The money was sent to the service provider.</p>
            <div className="receipt">⇩</div>
            <button onClick={() => nav("/customer/requests")}>
              Rate and Review
            </button>
          </section>
        </div>
      )}
    </CustomerLayout>
  );
}
export function Messages() {
  const [msg, setMsg] = useState("");
  const [messages, setMessages] = useState([]);
  useEffect(() => {
    customerApi.getMessages().then(setMessages);
  }, []);
  const send = async (e) => {
    e.preventDefault();
    if (!msg.trim()) return;
    const item = await customerApi.sendMessage(msg);
    setMessages([...messages, item]);
    setMsg("");
  };
  return (
    <CustomerLayout>
      <h1 className="customer-title">Messages</h1>
      <div className="messages">
        <aside>
          {["Nick Duran", "Gabriela Lim"].map((x) => (
            <button key={x}>
              ●　<b>{x}</b>
              <br />
              <small>Hi Ma’am, send ko na po yung quotation.</small>
            </button>
          ))}
        </aside>
        <section>
          <h3>
            Nick Duran <span className="available">Online</span>
          </h3>
          <hr />
          {messages.map((m) => (
            <p key={m.id} className="bubble outgoing">
              {m.text}
            </p>
          ))}
          <form onSubmit={send}>
            <input
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              placeholder="Type a message..."
            />
          </form>
        </section>
      </div>
    </CustomerLayout>
  );
}
export function History() {
  const [t, setT] = useState("All");
  return (
    <CustomerLayout>
      <h1 className="customer-title">History</h1>
      <div className="history-tabs">
        {["All", "Repair", "Transactions"].map((x) => (
          <button
            className={t === x ? "active" : ""}
            onClick={() => setT(x)}
            key={x}
          >
            {x}
          </button>
        ))}
      </div>
    </CustomerLayout>
  );
}
export function RequestSent() {
  const nav = useNavigate();
  return (
    <CustomerLayout>
      <h1 className="customer-title">Creating Service Request</h1>
      <div className="request-progress">
        {[1, 2, 3, 4].map((x) => (
          <span className="active" key={x} />
        ))}
      </div>
      <div className="request-sent">
        <div>✓</div>
        <h3>Sent to the Service Provider!</h3>
        <p>
          This service provider will review your request and send a pre-repair
          quotation.
          <br />
          You'll be notified the moment it arrives.
        </p>
        <button onClick={() => nav("/customer/requests")}>Done</button>
      </div>
    </CustomerLayout>
  );
}
