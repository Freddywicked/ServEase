import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCalendarDays,
  faCheckCircle,
  faStar,
} from "@fortawesome/free-solid-svg-icons";
import { CustomerLayout } from "./CustomerDashboard";
import FileUpload from "../../components/common/FileUpload";
import { customerFlowApi } from "../../services/customerFlowApi";
import "./request-recommendations.css";

function Progress({ step }) {
  return (
    <div className="request-progress">
      {[1, 2, 3, 4].map((item) => (
        <span className={item <= step ? "active" : ""} key={item} />
      ))}
    </div>
  );
}

function formatAppointment(appointment) {
  if (!appointment.date || !appointment.time) return "Choose a date and time";

  return `${appointment.date} · ${appointment.time}`;
}

function AppointmentPicker({ value, onChange, onClose }) {
  const today = new Date();
  const [visibleMonth, setVisibleMonth] = useState({
    year: today.getFullYear(),
    month: today.getMonth(),
  });
  const [availability, setAvailability] = useState(null);
  const [selectedDay, setSelectedDay] = useState(
    value.date ? Number(value.date.slice(-2)) : null,
  );
  const [selectedTime, setSelectedTime] = useState(value.time || "");

  useEffect(() => {
    customerFlowApi
      .getAppointmentAvailability(visibleMonth)
      .then(setAvailability);
  }, [visibleMonth]);

  if (!availability) {
    return (
      <div className="customer-modal" onMouseDown={onClose}>
        <section className="appointment-modal">
          <button
            className="appointment-close"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
          <p>Loading available appointment dates…</p>
        </section>
      </div>
    );
  }

  const daysInMonth = new Date(
    availability.year,
    availability.month + 1,
    0,
  ).getDate();
  const firstWeekday = new Date(
    availability.year,
    availability.month,
    1,
  ).getDay();
  const monthName = new Intl.DateTimeFormat("en-US", { month: "long" }).format(
    new Date(availability.year, availability.month),
  );
  const calendarCells = [
    ...Array.from({ length: firstWeekday }),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];
  const canGoBack =
    visibleMonth.year > today.getFullYear() ||
    (visibleMonth.year === today.getFullYear() &&
      visibleMonth.month > today.getMonth());
  const latestBookableMonth = new Date(
    today.getFullYear(),
    today.getMonth() + 3,
    1,
  );
  const canGoForward =
    visibleMonth.year < latestBookableMonth.getFullYear() ||
    (visibleMonth.year === latestBookableMonth.getFullYear() &&
      visibleMonth.month < latestBookableMonth.getMonth());

  function changeMonth(direction) {
    setSelectedDay(null);
    setSelectedTime("");
    setVisibleMonth((currentMonth) => {
      const nextDate = new Date(
        currentMonth.year,
        currentMonth.month + direction,
        1,
      );

      return { year: nextDate.getFullYear(), month: nextDate.getMonth() };
    });
  }

  function confirmAppointment() {
    const date = `${availability.year}-${String(availability.month + 1).padStart(
      2,
      "0",
    )}-${String(selectedDay).padStart(2, "0")}`;
    onChange({ date, time: selectedTime });
    onClose();
  }

  return (
    <div className="customer-modal" onMouseDown={onClose}>
      <section
        className="appointment-modal"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          className="appointment-close"
          onClick={onClose}
          type="button"
        >
          ×
        </button>
        <h3>Preferred appointment</h3>
        <p>Choose a date and time for your service request.</p>
        <div className="appointment-month">
          <button
            aria-label="Previous month"
            disabled={!canGoBack}
            onClick={() => changeMonth(-1)}
            type="button"
          >
            ‹
          </button>
          <strong>
            {monthName} {availability.year}
          </strong>
          <button
            aria-label="Next month"
            disabled={!canGoForward}
            onClick={() => changeMonth(1)}
            type="button"
          >
            ›
          </button>
        </div>
        <div className="appointment-calendar">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <span className="appointment-weekday" key={day}>{day}</span>
          ))}
          {calendarCells.map((day, index) => {
            if (!day) return <span key={`empty-${index}`} />;

            const isAvailable = availability.availableDays.includes(day);
            return (
              <button
                className={selectedDay === day ? "selected" : ""}
                disabled={!isAvailable}
                key={day}
                onClick={() => setSelectedDay(day)}
                type="button"
              >
                {day}
              </button>
            );
          })}
        </div>
        <b className="appointment-time-title">Select time</b>
        <div className="time-options">
          {availability.timeSlots.map((time) => (
            <button
              className={selectedTime === time ? "selected" : ""}
              key={time}
              onClick={() => setSelectedTime(time)}
              type="button"
            >
              {time}
            </button>
          ))}
        </div>
        <button
          className="appointment-confirm"
          disabled={!selectedDay || !selectedTime}
          onClick={confirmAppointment}
          type="button"
        >
          Confirm
        </button>
      </section>
    </div>
  );
}

function ProviderCard({ provider, selected, onSelect }) {
  return (
    <button className={selected ? "selected" : ""} onClick={onSelect} type="button">
      <i />
      <span>
        <b>{provider.name}</b>
        <small>{provider.serviceType}</small>
        <em><FontAwesomeIcon icon={faStar} /> {provider.rating} · {provider.reviewCount} reviews · {provider.yearsOfExperience} years experience</em>
        <small>
          <strong>Specialties:</strong> {provider.specialties.join(", ")}
          <br />
          <strong>Location:</strong> {provider.location} · {provider.distance}
          <br />
          <strong>Available:</strong> {provider.schedule}
        </small>
      </span>
      <mark><FontAwesomeIcon icon={faCheckCircle} /> Verified</mark>
      <mark>Available</mark>
    </button>
  );
}

export default function CreateRequest() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [setup, setSetup] = useState(null);
  const [providers, setProviders] = useState([]);
  const [diagnosis, setDiagnosis] = useState(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedProviderId, setSelectedProviderId] = useState("");
  const [photo, setPhoto] = useState(null);
  const [form, setForm] = useState({
    category: "",
    problem: "",
    appointment: { date: "", time: "" },
  });

  useEffect(() => {
    customerFlowApi.getRequestSetup().then((requestSetup) => {
      setSetup(requestSetup);
      setForm((currentForm) => ({
        ...currentForm,
        category: requestSetup.categories[0],
      }));
    });
  }, []);

  async function saveDraft() {
    await customerFlowApi.saveDraftRequest({
      ...form,
      photo: photo ? { name: photo.name, mimeType: photo.type } : null,
    });
  }

  async function openRecommendations() {
    const recommendedProviders = await customerFlowApi.getProviders({
      category: form.category,
    });
    setProviders(recommendedProviders);
    setSelectedProviderId(recommendedProviders[0]?.id || "");
    setStep(4);
  }

  async function runDiagnosis() {
    await saveDraft();
    const result = await customerFlowApi.getDiagnosis(form);
    setDiagnosis(result);
    setStep(3);
  }

  async function skipDiagnosis() {
    await saveDraft();
    await openRecommendations();
  }

  async function submitRequest() {
    await customerFlowApi.chooseProvider(selectedProviderId);
    navigate("/customer/request/sent");
  }

  if (!setup) {
    return (
      <CustomerLayout>
        <p>Loading request form…</p>
      </CustomerLayout>
    );
  }

  if (step === 4) {
    return (
      <CustomerLayout>
        <h1 className="customer-title">Creating Service Request</h1>
        <Progress step={4} />
        <section className="recommendations">
          <h3>Recommended Service Providers</h3>
          <p>
            Matched by specialization, customer satisfaction sentiments,
            ratings and distance from you.
          </p>
          <div>
            {providers.map((provider) => (
              <ProviderCard
                key={provider.id}
                provider={provider}
                selected={provider.id === selectedProviderId}
                onSelect={() => setSelectedProviderId(provider.id)}
              />
            ))}
          </div>
          <button
            className="submit-service"
            disabled={!selectedProviderId}
            onClick={submitRequest}
          >
            Submit Service Request
          </button>
          <button
            className="find-another"
            onClick={() => navigate("/customer/providers")}
          >
            Find another Service Provider
          </button>
        </section>
      </CustomerLayout>
    );
  }

  if (step === 3 && diagnosis) {
    return (
      <CustomerLayout>
        <h1 className="customer-title">Creating Service Request</h1>
        <Progress step={3} />
        <div className="diagnosis">
          <div className="spinner">
            ● ●
            <br />●　●
            <br />　●
          </div>
          <p>Reading your description and running AI diagnosis…</p>
          <h3>Here’s what we found</h3>
          <p>
            This is a suggestion — you&apos;ll always choose your own service
            provider if you&apos;d rather not use it.
          </p>
          <div className="diagnosis-grid">
            <article>
              <small>Probable Cause</small>
              <h3>{diagnosis.cause}</h3>
              <div className="confidence">
                <i style={{ width: `${diagnosis.confidence}%` }} />
                <b>{diagnosis.confidence}%</b>
              </div>
              <small>Confidence based on similar reported cases</small>
              <div className="chips">
                {diagnosis.checks.map((check) => (
                  <button key={check}>{check}</button>
                ))}
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
            <button onClick={() => navigate("/customer/dashboard")}>
              Yes, solved
            </button>
            <button onClick={openRecommendations}>Find Service Providers</button>
          </div>
        </div>
      </CustomerLayout>
    );
  }

  if (step === 2) {
    return (
      <CustomerLayout>
        <h1 className="customer-title">Creating Service Request</h1>
        <Progress step={2} />
        <div className="diagnosis-start">
          <h3>To enhance your service request details, we offer AI Diagnosis.</h3>
          <p>Let AI analyze your problem before booking.</p>
          <button onClick={runDiagnosis}>Use AI Diagnosis</button>
          <button onClick={skipDiagnosis}>Skip AI and Find Service Providers</button>
        </div>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout>
      <h1 className="customer-title">Creating Service Request</h1>
      <Progress step={1} />
      <form
        className="request-form"
        onSubmit={(event) => {
          event.preventDefault();
          setStep(2);
        }}
      >
        <h3>What needs fixing?</h3>
        <p>
          Pick a category and tell us what&apos;s going on — the more detail, the
          better the diagnosis.
        </p>
        <b>Category</b>
        <div className="request-categories">
          {setup.categories.map((category) => (
            <button
              className={form.category === category ? "selected" : ""}
              key={category}
              onClick={() => setForm({ ...form, category })}
              type="button"
            >
              {category}
            </button>
          ))}
        </div>
        <div className="request-grid">
          <label>
            Describe the Problem
            <textarea
              name="problem"
              onChange={(event) =>
                setForm({ ...form, problem: event.target.value })
              }
              placeholder="e.g. Screen cracked"
              required
              value={form.problem}
            />
          </label>
          <FileUpload
            className="request-upload"
            hint="Upload Image"
            label="Photo"
            onFileChange={setPhoto}
          />
        </div>
        <button
          className="appointment-button"
          onClick={() => setShowCalendar(true)}
          type="button"
        >
          <FontAwesomeIcon icon={faCalendarDays} />
          <span>
            <b>Preferred appointment</b>
            <small>{formatAppointment(form.appointment)}</small>
          </span>
        </button>
        <div className="map-placeholder">●</div>
        <button className="request-next">Next</button>
      </form>
      {showCalendar && (
        <AppointmentPicker
          onChange={(appointment) => setForm({ ...form, appointment })}
          onClose={() => setShowCalendar(false)}
          value={form.appointment}
        />
      )}
    </CustomerLayout>
  );
}
