import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCalendarDays,
  faCheckCircle,
  faStar,
} from "@fortawesome/free-solid-svg-icons";
import { CustomerLayout } from "./CustomerDashboard";
import FileUpload from "../../components/common/FileUpload";
import { customerApi } from "../../services/customerApi";
import "./request-recommendations.css";
const Progress = ({ step }) => (
  <div className="request-progress">
    {[1, 2, 3, 4].map((x) => (
      <span key={x} className={x <= step ? "active" : ""} />
    ))}
  </div>
);
const providers = ["Mark Rivera", "Jason Tatum", "Sylvia Lee", "John Doe"];
function AppointmentPicker({ value, onChange, close }) {
  const [date, setDate] = useState(value.date || "");
  const [time, setTime] = useState(value.time || "");
  return (
    <div className="customer-modal">
      <section className="appointment-modal">
        <button onClick={close}>×</button>
        <h3>Preferred appointment</h3>
        <p>Choose a date and time for your service request.</p>
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
          <div className="time-options">
            {["9:00 AM", "10:00 AM", "11:00 AM", "1:00 PM"].map((x) => (
              <button
                type="button"
                className={time === x ? "selected" : ""}
                onClick={() => setTime(x)}
                key={x}
              >
                {x}
              </button>
            ))}
          </div>
        </label>
        <button
          disabled={!date || !time}
          onClick={() => {
            onChange({ date, time });
            close();
          }}
        >
          Save appointment
        </button>
      </section>
    </div>
  );
}
export default function CreateRequest() {
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    category: "Home Repair",
    problem: "",
    appointment: { date: "", time: "" },
  });
  const [showCalendar, setShowCalendar] = useState(false);
  const [selected, setSelected] = useState(0);
  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const submit = async () => {
    await customerApi.createRequest({ ...form, provider: providers[selected] });
    nav("/customer/request/sent");
  };
  if (step === 4)
    return (
      <CustomerLayout>
        <h1 className="customer-title">Creating Service Request</h1>
        <Progress step={4} />
        <section className="recommendations">
          <h3>Recommended Service Providers</h3>
          <p>
            Matched by specialization, customer satisfaction sentiments, ratings
            and distance from you.
          </p>
          <div>
            {providers.map((name, index) => (
              <button
                className={selected === index ? "selected" : ""}
                onClick={() => setSelected(index)}
                key={name}
              >
                <i />
                <span>
                  <b>{name}</b>
                  <small>Phone Repair</small>
                  <em>
                    <FontAwesomeIcon icon={faStar} /> 4.8　　95 reviews　　5
                    years experience
                  </em>
                  <small>
                    <strong>Specialties:</strong> IT and Phone Repair
                    <br />
                    <strong>Location:</strong> Naga City · 2.5 km away
                    <br />
                    <strong>Available:</strong> Mon–Fri, 8AM–6PM
                  </small>
                </span>
                <mark>
                  <FontAwesomeIcon icon={faCheckCircle} /> Verified
                </mark>
                <mark>Available</mark>
              </button>
            ))}
          </div>
          <button className="submit-service" onClick={submit}>
            Submit Service Request
          </button>
          <button
            className="find-another"
            onClick={() => nav("/customer/providers")}
          >
            Find another Service Provider
          </button>
        </section>
      </CustomerLayout>
    );
  if (step === 2)
    return (
      <CustomerLayout>
        <h1 className="customer-title">Creating Service Request</h1>
        <Progress step={2} />
        <div className="diagnosis-start">
          <h3>
            To enhance your service request details, we offer AI Diagnosis.
          </h3>
          <p>Let AI analyze your problem before booking.</p>
          <button onClick={() => setStep(3)}>Use AI Diagnosis</button>
          <button onClick={() => setStep(4)}>
            Skip AI and Find Service Providers
          </button>
        </div>
      </CustomerLayout>
    );
  if (step === 3)
    return (
      <CustomerLayout>
        <h1 className="customer-title">Creating Service Request</h1>
        <Progress step={3} />
        <div className="diagnosis">
          <div className="spinner">
            ● ●<br />
            ●　●
            <br />
            　●
          </div>
          <p>Reading your description and running AI diagnosis...</p>
          <h3>Here’s what we found</h3>
          <p>
            This is a suggestion — you'll always choose your own service
            provider if you'd rather not use it.
          </p>
          <div className="diagnosis-grid">
            <article>
              <small>Probable Cause</small>
              <h3>Liquid damage to charging circuit</h3>
              <div className="confidence">
                <i />
                <b>82%</b>
              </div>
              <small>Confidence based on similar reported cases</small>
              <div className="chips">
                <button>Power jack</button>
                <button>Motherboard Check</button>
                <button>Safety test</button>
              </div>
            </article>
            <aside>
              <b>Troubleshooting Suggestions</b>
              <div>
                Check your Power Adapter
                <br />
                <small>Try another charger or wall outlet.</small>
              </div>
              <div>
                Disconnect Peripherals
                <br />
                <small>Remove USB devices or other peripherals.</small>
              </div>
            </aside>
          </div>
          <p>Is the problem solved?</p>
          <div className="split-actions">
            <button onClick={() => nav("/customer/dashboard")}>
              Yes, solved
            </button>
            <button onClick={() => setStep(4)}>Find Service Providers</button>
          </div>
        </div>
      </CustomerLayout>
    );
  return (
    <CustomerLayout>
      <h1 className="customer-title">Creating Service Request</h1>
      <Progress step={1} />
      <form
        className="request-form"
        onSubmit={(e) => {
          e.preventDefault();
          setStep(2);
        }}
      >
        <h3>What needs fixing?</h3>
        <p>
          Pick a category and tell us what's going on — the more detail, the
          better the diagnosis.
        </p>
        <b>Category</b>
        <div className="request-categories">
          {[
            "Home Repair",
            "Automotive",
            "IT-Related Devices",
            "Phone Device",
          ].map((x) => (
            <button
              type="button"
              className={form.category === x ? "selected" : ""}
              onClick={() => setForm({ ...form, category: x })}
              key={x}
            >
              {x}
            </button>
          ))}
        </div>
        <div className="request-grid">
          <label>
            Describe the Problem
            <textarea
              required
              name="problem"
              value={form.problem}
              onChange={update}
              placeholder="e.g. Screen cracked"
            />
          </label>
          <FileUpload
            label="Photo (optional)"
            hint="Upload Image"
            className="request-upload"
          />
        </div>
        <button
          type="button"
          className="appointment-button"
          onClick={() => setShowCalendar(true)}
        >
          <FontAwesomeIcon icon={faCalendarDays} />
          <span>
            <b>Preferred appointment</b>
            <small>
              {form.appointment.date
                ? `${form.appointment.date} · ${form.appointment.time}`
                : "Choose a date and time"}
            </small>
          </span>
        </button>
        <div className="map-placeholder">●</div>
        <button className="request-next">Next</button>
      </form>
      {showCalendar && (
        <AppointmentPicker
          value={form.appointment}
          onChange={(appointment) => setForm({ ...form, appointment })}
          close={() => setShowCalendar(false)}
        />
      )}
    </CustomerLayout>
  );
}
