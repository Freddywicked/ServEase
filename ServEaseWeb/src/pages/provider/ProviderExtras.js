import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircleCheck,
  faRightFromBracket,
  faUserPen,
} from "@fortawesome/free-solid-svg-icons";
import { ProviderLayout } from "./ProviderWorkspace";
import { providerApi } from "../../services/providerApi";

export function ProviderMessages() {
  const [text, setText] = useState("");
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    providerApi.getConversations().then((items) => {
      setConversations(items);
      setSelectedId(items[0]?.id || "");
    });
  }, []);

  const selectedConversation = conversations.find((conversation) => conversation.id === selectedId);

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim() || !selectedConversation) return;
    await providerApi.sendMessage(selectedConversation.id, text.trim());
    setConversations(await providerApi.getConversations());
    setText("");
  };
  return (
    <ProviderLayout>
      <h1>Messages</h1>
      <div className="provider-messages provider-messages--reference">
        <aside className="provider-conversation-list">
          {conversations.map((conversation) => (
            <button key={conversation.id} className={conversation.id === selectedId ? "selected" : ""} onClick={() => setSelectedId(conversation.id)}>
              <i /> <b>{conversation.customer}</b>
              <small>{conversation.preview}</small>
              {conversation.id === conversations[0]?.id && <span className="provider-unread-dot" aria-label="Unread message" />}
            </button>
          ))}
        </aside>
        {selectedConversation && <section>
          <header>
            <b>{selectedConversation.customer}</b>
            <small>{selectedConversation.service}</small>
            {selectedConversation.online && <em>Online</em>}
          </header>
          <div className="message-thread">
            {selectedConversation.messages.map((message) => (
              <p key={message.id} className={message.from === "provider" ? "sent" : ""}>{message.text}<small>{message.timestamp}</small></p>
            ))}
          </div>
          <form onSubmit={send}>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type a message..."
            />
          </form>
        </section>}
      </div>
    </ProviderLayout>
  );
}

export function ProviderEarnings() {
  const [earnings, setEarnings] = useState(null);
  useEffect(() => { providerApi.getEarnings().then(setEarnings); }, []);
  if (!earnings) return <ProviderLayout><p>Loading earnings…</p></ProviderLayout>;
  return (
    <ProviderLayout>
      <h1>Earnings</h1>
      <div className="provider-stats compact provider-earnings-stats">
        <div>
          <b>₱{earnings.weekly.toLocaleString()}</b>
          <span>This week</span>
        </div>
        <div>
          <b>₱{earnings.pending.toLocaleString()}</b>
          <span>Pending Payment</span>
        </div>
      </div>
      <h3 className="section-label">RECENT TRANSACTIONS</h3>
      {earnings.transactions.map((transaction) => (
        <div className="transaction-row" key={transaction.id}>
          {transaction.customer} · {transaction.requestId} <b>₱{transaction.amount.toLocaleString()} · {transaction.status}</b>
        </div>
      ))}
    </ProviderLayout>
  );
}

export function ProviderProfile() {
  const go = useNavigate();
  const [profile, setProfile] = useState(null);
  useEffect(() => { providerApi.getProfile().then(setProfile); }, []);
  if (!profile) return <ProviderLayout><p>Loading profile…</p></ProviderLayout>;
  return (
    <ProviderLayout>
      <h1>Profile</h1>
      <section className="provider-profile">
        <i />
        <h2>{profile.name}</h2>
        <p>{profile.role}</p>
        <div className="provider-profile-feedback">
          {profile.verified && <mark><FontAwesomeIcon icon={faCircleCheck} /> Verified</mark>}
          <b>{profile.positiveFeedback}</b>
        </div>
        <p>{profile.experience}</p>
        <div className="provider-profile-details">
          <div><strong>Specialties:</strong> {profile.specialties}</div>
          <div><strong>Location:</strong> {profile.location}</div>
          <div><strong>Available:</strong> {profile.availability}</div>
        </div>
        <div className="provider-profile-insights">
          <h4>AI Summary Insights</h4>
          {profile.insights.map((insight) => <span key={insight}>{insight}</span>)}
        </div>
      </section>
      <div className="profile-actions">
        <button>
          <FontAwesomeIcon icon={faUserPen} /> Edit Profile
        </button>
        <button onClick={() => go("/signin")}>
          <FontAwesomeIcon icon={faRightFromBracket} /> Log out
        </button>
      </div>
      <button
        className="login-customer"
        onClick={() => go("/customer/dashboard")}
      >
        Login as Customer
      </button>
    </ProviderLayout>
  );
}

export function ProviderCalendar() {
  const [booked, setBooked] = useState([]);
  const slots = [
    "9:00 AM",
    "10:00 AM",
    "11:00 AM",
    "1:00 PM",
    "2:00 PM",
    "3:00 PM",
  ];
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  return (
    <ProviderLayout>
      <h1>Calendar</h1>
      <h3 className="section-label">SEPTEMBER 2026</h3>
      <div className="provider-calendar">
        <div />
        <>
          {days.map((day) => (
            <b key={day}>{day}</b>
          ))}
        </>
        {slots.map((time) => (
          <React.Fragment key={time}>
            <small>{time}</small>
            {days.map((day) => {
              const id = `${day}-${time}`,
                active = booked.includes(id);
              return (
                <button
                  key={id}
                  className={active ? "booked" : ""}
                  onClick={() =>
                    setBooked((x) =>
                      x.includes(id) ? x.filter((v) => v !== id) : [...x, id],
                    )
                  }
                >
                  {active ? "Appointment" : ""}
                </button>
              );
            })}
          </React.Fragment>
        ))}
      </div>
      <p className="calendar-help">
        Select a time slot to block it on your calendar.
      </p>
    </ProviderLayout>
  );
}
