import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CustomerLayout } from "./CustomerDashboard";
import { customerWorkspaceApi } from "../../services/customerWorkspaceApi";

const requestTabs = ["Sent", "Approved", "On-going", "Declined", "Done"];

function Modal({ children, onClose, variant = "" }) {
  return (
    <div className="customer-modal" onMouseDown={onClose}>
      <section className={`customer-modal__panel ${variant}`.trim()} onMouseDown={(event) => event.stopPropagation()}>
        <button aria-label="Close dialog" className="customer-modal__close" onClick={onClose} type="button">×</button>
        {children}
      </section>
    </div>
  );
}

function Timeline({ steps = [], isComplete = false }) {
  const currentStep = isComplete ? steps.length - 1 : Math.max(0, steps.length - 2);

  return (
    <div className="repair-timeline">
      {steps.map((step, index) => (
        <div className={index < currentStep ? "complete" : index === currentStep ? "current" : "pending"} key={step}>
          <i aria-hidden="true">{index < currentStep ? "✓" : ""}</i>
          <span>
            <b>{step}</b>
            <small>{index === 0 ? "Jun 24 9:12 AM" : index === 1 ? "Jun 24 10:12 AM" : index === currentStep && !isComplete ? "Service provider is now heading to your door step" : index === steps.length - 1 && !isComplete ? "Pending" : "Completed"}</small>
          </span>
        </div>
      ))}
    </div>
  );
}

function RequestCard({ children, className = "", onClick }) {
  return (
    <article
      className={`request-card ${className}`.trim()}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(event) => {
        if (onClick && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onClick();
        }
      }}
    >
      {children}
    </article>
  );
}

export function Requests() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("Sent");
  const [requests, setRequests] = useState([]);
  const [query, setQuery] = useState("");
  const [rejectingRequest, setRejectingRequest] = useState(null);
  const [reason, setReason] = useState("");

  function loadRequests() {
    customerWorkspaceApi.getRequests().then(setRequests);
  }

  useEffect(() => {
    loadRequests();
  }, []);

  const filteredRequests = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return requests.filter((request) => {
      const matchesTab = request.status === activeTab;
      const matchesQuery = [request.id, request.providerName, request.cause]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);

      return matchesTab && matchesQuery;
    });
  }, [activeTab, query, requests]);

  async function openRequest(requestId) {
    await customerWorkspaceApi.selectRequest(requestId);
    navigate("/customer/quote");
  }

  async function rejectRequest() {
    await customerWorkspaceApi.updateRequestStatus(
      rejectingRequest.id,
      "Declined",
      { rejectionReason: reason },
    );
    setRejectingRequest(null);
    setReason("");
    loadRequests();
  }

  return (
    <CustomerLayout>
      <h1 className="customer-title">My Requests</h1>
      <input
        className="customer-search"
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search request details..."
        value={query}
      />
      <div className="filter-pills request-tabs">
        {requestTabs.map((tab) => (
          <button
            className={activeTab === tab ? "active" : ""}
            key={tab}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="request-list">
        {filteredRequests.map((request) => {
          const visualClass = request.schedule
            ? "request-card--schedule"
            : request.additionalPayment
              ? "request-card--payment"
              : request.timeline
                ? "request-card--timeline"
                : request.status === "Approved"
                  ? "request-card--quote"
                  : "request-card--confidence";
          const statusClass = `request-card--status-${request.status.toLowerCase().replace(/[^a-z]+/g, "-")}`;

          return (
            <RequestCard
              className={`${visualClass} ${statusClass}`}
              key={request.id}
              onClick={request.status === "Approved" && !request.schedule ? () => openRequest(request.id) : undefined}
            >
              <b className="request-card-title">Request #{request.id}</b>
              {request.status === "On-going" || request.status === "Done" ? (
                <>
                  <span className="progress-badge">{request.displayStatus || "In progress"}</span>
                  <p>{request.providerName}</p>
                  {request.additionalPayment && (
                    <div className="payment-note">
                      <b>Additional payment needed</b>
                      <strong>₱ {request.additionalPayment.amount.toLocaleString()}</strong>
                      <small>{request.additionalPayment.reason}</small>
                    </div>
                  )}
                  {!request.additionalPayment && <Timeline steps={request.timeline} />}
                  {request.additionalPayment ? (
                    <>
                      <div className="right-buttons payment-decision-actions">
                        <button onClick={() => openRequest(request.id)}>Approve</button>
                        <button onClick={() => setRejectingRequest(request)}>Decline</button>
                      </div>
                      <div className="right-buttons payment-message-actions">
                        <button onClick={() => navigate("/customer/messages")}>Message</button>
                      </div>
                    </>
                  ) : (
                    <div className="right-buttons timeline-actions">
                      {request.status === "Done" && <button onClick={() => openRequest(request.id)}>Proceed to Payment</button>}
                      <button onClick={() => navigate("/customer/messages")}>Message</button>
                    </div>
                  )}
                </>
              ) : request.status === "Approved" && request.schedule ? (
                <>
                  <span className="quote-tag">New Schedule</span>
                  <p>{request.providerName} sent a new schedule.</p>
                  <b className="scheduled-date">{request.schedule.date} {request.schedule.time}</b>
                  <div className="schedule-reason">
                    <b>Reason for New Schedule</b>
                    <small>{request.schedule.reason}</small>
                  </div>
                  <div className="right-buttons">
                    <button onClick={(event) => event.stopPropagation()}>Accept</button>
                    <button onClick={(event) => event.stopPropagation()}>Reject</button>
                  </div>
                </>
              ) : request.status === "Approved" ? (
                <>
                  <span className="quote-tag">Approve Quote?</span>
                  <p>{request.providerName} sent a quotation</p>
                  <div className="request-cost-row"><b>Labor Cost</b><span>{request.quote?.labor?.toFixed(2)}</span></div>
                  <div className="request-cost-row request-cost-row--total"><b>Total</b><span>{request.quote?.total?.toFixed(2)}</span></div>
                </>
              ) : (
                <>
                  <p className="request-provider">{request.status === "Declined" ? "Sent to" : "sent to"} <b>{request.providerName}</b></p>
                  <small className="request-label">Probable Cause</small>
                  <strong className="request-cause">{request.cause || "Awaiting review"}</strong>
                  <div className="confidence" style={{ "--confidence": `${request.confidence || 0}%` }}><i /><b>{request.confidence || 0}%</b></div>
                  <small className="confidence-caption">Confidence based on similar reported cases</small>
                  {request.status === "Declined" && <button className="find-button" onClick={() => navigate("/customer/providers")}>Find Service Provider</button>}
                </>
              )}
            </RequestCard>
          );
        })}
      </div>
      {rejectingRequest && (
        <Modal onClose={() => setRejectingRequest(null)} variant="customer-modal--rejection">
          <h3>Reason for rejection</h3>
          <textarea placeholder="Enter your reason here." value={reason} onChange={(event) => setReason(event.target.value)} />
          <div className="modal-actions"><button disabled={!reason.trim()} onClick={rejectRequest}>Confirm</button></div>
        </Modal>
      )}
    </CustomerLayout>
  );
}

export function Quote() {
  const navigate = useNavigate();
  const [request, setRequest] = useState(null);
  const [modal, setModal] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    customerWorkspaceApi.getSelectedRequest().then(setRequest);
  }, []);

  if (!request) return <CustomerLayout><p>Request not found.</p></CustomerLayout>;

  const amount = request.additionalPayment?.amount || request.quote?.total || 0;
  const labor = request.quote?.labor ?? amount;
  const total = request.quote?.total ?? amount;
  const description = request.quote?.description || request.additionalPayment?.reason || "This quotation covers the service needed for your request.";

  async function approve() {
    await customerWorkspaceApi.updateRequestStatus(request.id, request.status, { quoteApproved: true });
    setModal("approved");
  }

  async function decline() {
    await customerWorkspaceApi.updateRequestStatus(request.id, "Declined", { rejectionReason: reason });
    setModal("");
    navigate("/customer/requests");
  }

  return (
    <CustomerLayout>
      <h1 className="customer-title">My Requests</h1>
      <section className="request-detail-page quote-page">
        <div className="request-detail-header">
          <button aria-label="Back to requests" className="request-back" onClick={() => navigate("/customer/requests")} type="button">‹</button>
          <div>
            <h2>Request #{request.id}</h2>
            <p>{request.providerName} sent a quotation</p>
          </div>
        </div>
        <div className="quote-body">
          <p className="quote-description">{description}</p>
          <div className="quote-table">
            <div className="quote-table-row"><b>Labor</b><span>{labor.toFixed(2)}</span></div>
            <div className="quote-table-row quote-table-row--total"><b>Total</b><span>{total.toFixed(2)}</span></div>
          </div>
          <p className="quote-note">Note: If you accepted the quotation, you are required to pay the initial fee which is the 20% of the total service repair cost.</p>
          <div className="quote-actions">
            <button onClick={approve}>Approve</button>
            <button onClick={() => setModal("decline")}>Decline</button>
          </div>
        </div>
      </section>
      {modal === "approved" && (
        <Modal onClose={() => setModal("")} variant="customer-modal--approval">
          <h3>Service Request Approved</h3>
          <p>You are required to pay the initial fee which is the 20% of the total service repair cost.</p>
          <button onClick={() => navigate("/customer/payment")}>Proceed to Payment</button>
        </Modal>
      )}
      {modal === "decline" && (
        <Modal onClose={() => setModal("")} variant="customer-modal--rejection">
          <h3>Reason for rejection</h3>
          <textarea placeholder="Enter your reason here." value={reason} onChange={(event) => setReason(event.target.value)} />
          <div className="modal-actions"><button disabled={!reason.trim()} onClick={decline}>Confirm</button></div>
        </Modal>
      )}
    </CustomerLayout>
  );
}

export function Payment() {
  const navigate = useNavigate();
  const [request, setRequest] = useState(null);
  const [method, setMethod] = useState("");
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    customerWorkspaceApi.getSelectedRequest().then(setRequest);
  }, []);

  if (!request) return <CustomerLayout><p>Request not found.</p></CustomerLayout>;

  const amount = request.additionalPayment?.amount || request.quote?.total || 0;
  const paymentMethods = [
    { id: "GCash", mark: "G", markClass: "payment-method__mark--gcash", label: "GCash" },
    { id: "QR PH", mark: "QR", markClass: "payment-method__mark--qr", label: "QR PH" },
    { id: "Debit/Credit", mark: "VISA", markClass: "payment-method__mark--card", label: "Debit/Credit" },
  ];

  async function pay() {
    await customerWorkspaceApi.recordPayment(request.id, method, amount);
    setComplete(true);
  }

  return (
    <CustomerLayout>
      <h1 className="customer-title">My Requests</h1>
      <section className="request-detail-page payment-page">
        <div className="request-detail-header">
          <button aria-label="Back to requests" className="request-back" onClick={() => navigate("/customer/requests")} type="button">‹</button>
          <div><h2>Request #{request.id}</h2></div>
        </div>
        <div className="payment">
          <h3>₱{amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
          <b>Select Payment Method</b>
          <div className="payment-methods">
            {paymentMethods.map((paymentMethod) => (
              <label className="payment-method" key={paymentMethod.id}>
                <input checked={method === paymentMethod.id} name="payment" onChange={() => setMethod(paymentMethod.id)} type="radio" />
                <span className={`payment-method__mark ${paymentMethod.markClass}`}>{paymentMethod.mark}</span>
                <span>{paymentMethod.label}</span>
              </label>
            ))}
          </div>
          <button disabled={!method} onClick={pay}>Continue</button>
        </div>
      </section>
      {complete && (
        <Modal onClose={() => setComplete(false)} variant="customer-modal--receipt">
          <h3>Payment Processed</h3>
          <p>The money was sent to the service provider.</p>
          <div className="receipt"><span aria-label="Download receipt" role="img">⇩</span></div>
          <button onClick={() => navigate(request.status === "Done" || request.payment ? "/customer/review" : "/customer/dashboard")}>{request.status === "Done" || request.payment ? "Rate and Review" : "Go to Dashboard"}</button>
        </Modal>
      )}
    </CustomerLayout>
  );
}

export function Messages() {
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState("");
  const [message, setMessage] = useState("");

  function loadConversations() {
    customerWorkspaceApi.getConversations().then((items) => {
      setConversations(items);
      setActiveConversationId((currentId) => currentId || items[0]?.id || "");
    });
  }

  useEffect(() => {
    loadConversations();
  }, []);

  const activeConversation = conversations.find((item) => item.id === activeConversationId);

  async function sendMessage(event) {
    event.preventDefault();
    if (!message.trim() || !activeConversation) return;
    await customerWorkspaceApi.sendMessage(activeConversation.id, message.trim());
    setMessage("");
    loadConversations();
  }

  return (
    <CustomerLayout>
      <h1 className="customer-title">Messages</h1>
      <div className="messages">
        <aside>{conversations.map((conversation) => <button key={conversation.id} onClick={() => setActiveConversationId(conversation.id)}>●　<b>{conversation.participant}</b><br /><small>{conversation.preview}</small></button>)}</aside>
        {activeConversation && <section><h3>{activeConversation.participant} {activeConversation.online && <span className="available">Online</span>}</h3><hr />{activeConversation.messages.map((item) => <p className={item.from === "customer" ? "bubble outgoing" : "bubble"} key={item.id}>{item.text}</p>)}<form onSubmit={sendMessage}><input onChange={(event) => setMessage(event.target.value)} placeholder="Type a message..." value={message} /></form></section>}
      </div>
    </CustomerLayout>
  );
}

export function History() {
  const [activeTab, setActiveTab] = useState("All");
  const [items, setItems] = useState([]);

  useEffect(() => {
    customerWorkspaceApi.getHistory().then(setItems);
  }, []);

  const visibleItems = activeTab === "All" ? items : items.filter((item) => item.type === "Transaction");

  return (
    <CustomerLayout>
      <h1 className="customer-title">History</h1>
      <div className="history-tabs">{["All", "Repair", "Transactions"].map((tab) => <button className={activeTab === tab ? "active" : ""} key={tab} onClick={() => setActiveTab(tab)}>{tab}</button>)}</div>
      <div className="history-list">{visibleItems.map((item) => <article key={item.id}><b>{item.type}</b><span>Request #{item.requestId}</span><span>₱{item.amount?.toFixed(2)}</span></article>)}</div>
    </CustomerLayout>
  );
}

export function RateReview() {
  const navigate = useNavigate();
  const [request, setRequest] = useState(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  useEffect(() => {
    customerWorkspaceApi.getSelectedRequest().then(setRequest);
  }, []);

  async function submitReview() {
    await customerWorkspaceApi.submitReview(request.id, rating, comment);
    navigate("/customer/history");
  }

  if (!request) return <CustomerLayout><p>Request not found.</p></CustomerLayout>;

  return (
    <CustomerLayout>
      <h1 className="customer-title">Rate and Review</h1>
      <section className="review-form">
        <h3>‹　Request #{request.id}</h3>
        <b>Rate</b>
        <div className="rating-stars">{[1, 2, 3, 4, 5].map((star) => <button className={star <= rating ? "selected" : ""} key={star} onClick={() => setRating(star)} type="button">★</button>)}</div>
        <label>Review<textarea onChange={(event) => setComment(event.target.value)} placeholder="Enter your review and sentiments here." value={comment} /></label>
        <button disabled={!rating || !comment.trim()} onClick={submitReview}>Send</button>
      </section>
    </CustomerLayout>
  );
}

export function RequestSent() {
  const navigate = useNavigate();
  return <CustomerLayout><h1 className="customer-title">Creating Service Request</h1><div className="request-progress">{[1, 2, 3, 4].map((item) => <span className="active" key={item} />)}</div><div className="request-sent"><div>✓</div><h3>Sent to the Service Provider!</h3><p>This service provider will review your request and send a pre-repair quotation.<br />You&apos;ll be notified the moment it arrives.</p><button onClick={() => navigate("/customer/requests")}>Done</button></div></CustomerLayout>;
}
