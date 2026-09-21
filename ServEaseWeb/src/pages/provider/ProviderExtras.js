import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPenToSquare,
  faRightFromBracket,
} from "@fortawesome/free-solid-svg-icons";
import { ProviderLayout } from "./ProviderWorkspace";
import { providerApi } from "../../services/providerApi";

export function ProviderMessages() {
  const [text, setText] = useState(""),
    [messages, setMessages] = useState([]);
  useEffect(() => {
    providerApi.get().then((x) => setMessages(x.messages || []));
  }, []);
  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    await providerApi.sendMessage(text.trim());
    setMessages((x) => [...x, { id: Date.now(), text, from: "You" }]);
    setText("");
  };
  return (
    <ProviderLayout>
      <h1>Messages</h1>
      <div className="provider-messages">
        <aside>
          <button className="selected">
            <i /> <b>Nick Duran</b>
            <small>K lang.</small>
          </button>
          <button>
            <i /> <b>Gabriela Lim</b>
            <small>Hi Ma'am, sinend ko na po yung quotation.</small>
          </button>
        </aside>
        <section>
          <header>
            <b>Nick Duran</b>
            <small>Laptop Screen Repair</small>
            <em>Online</em>
          </header>
          <div className="message-thread">
            <p>
              Hi! Matatagalan pa to since sa Manila pa kukuning yung screen.
              <small>Jun 24 9:12 AM</small>
            </p>
            {messages.map((m) => (
              <p key={m.id}>{m.text}</p>
            ))}
          </div>
          <form onSubmit={send}>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type a message..."
            />
          </form>
        </section>
      </div>
    </ProviderLayout>
  );
}

export function ProviderEarnings() {
  return (
    <ProviderLayout>
      <h1>Earnings</h1>
      <div className="provider-stats compact">
        <div>
          <b>₱8,150</b>
          <span>This week</span>
        </div>
        <div>
          <b>₱1,300</b>
          <span>Pending Payment</span>
        </div>
      </div>
      <h3 className="section-label">RECENT TRANSACTIONS</h3>
      <div className="transaction-row">
        Initial payment · SR-0000 <b>₱500</b>
      </div>
      <div className="transaction-row">
        Repair completion · SR-0003 <b>₱2,650</b>
      </div>
      <div className="transaction-row">
        Additional parts · SR-0007 <b>₱1,300</b>
      </div>
    </ProviderLayout>
  );
}

export function ProviderProfile() {
  const go = useNavigate();
  return (
    <ProviderLayout>
      <h1>Profile</h1>
      <section className="provider-profile">
        <i />
        <h2>Sylvia Lee</h2>
        <p>Automotive Repair Service Provider</p>
        <div>
          <mark>✓ &nbsp; Verified</mark>
          <b>92% Positive Feedback</b>
        </div>
        <p>5 years experience</p>
        <strong>Specialties:</strong> IT and Phone Repair
        <br />
        <strong>Location:</strong> Naga City · 2.5 km away
        <br />
        <strong>Available:</strong> Mon–Fri, 8AM–6PM<h4>AI Summary Insights</h4>
        <span>Professional</span>
        <span>Always on Time</span>
      </section>
      <div className="profile-actions">
        <button>
          <FontAwesomeIcon icon={faPenToSquare} /> Edit Profile
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
