import React, { useMemo, useState } from "react";
import AdminLayout from "./AdminLayout";
import "./dashboard.css";
const registrationData = [
  { date: "08 May", users: 440 },
  { date: "09 May", users: 310 },
  { date: "10 May", users: 215 },
  { date: "11 May", users: 40 },
  { date: "12 May", users: 88 },
  { date: "13 May", users: 150 },
  { date: "14 May", users: 500 },
];
function AdminDashboard() {
  const [data, setData] = useState(registrationData);
  const [active, setActive] = useState(null);
  const max = Math.max(...data.map((i) => i.users), 100);
  const coords = useMemo(
    () =>
      data.map((item, index) => ({
        ...item,
        x: 10 + index * (80 / (data.length - 1)),
        y: 86 - (item.users / max) * 70,
      })),
    [data, max],
  );
  const points = coords.map((i) => `${i.x},${i.y}`).join(" ");
  const metrics = [
    { label: "Total Users", value: 1000, tone: "blue" },
    { label: "Active Users", value: 500, tone: "green" },
    { label: "Customers", value: 500, tone: "teal" },
    { label: "Service Providers", value: 500, tone: "navy" },
    { label: "Pending Accounts", value: 1000, tone: "peach" },
  ];
  const addDemoRegistration = () =>
    setData((items) =>
      items.map((item, index) =>
        index === items.length - 1 ? { ...item, users: item.users + 1 } : item,
      ),
    );
  return (
    <AdminLayout>
      <div className="admin-title-row">
        <div>
          <h1>Welcome, Admin!</h1>
          <p>Here's what's happening today.</p>
        </div>
        <button onClick={addDemoRegistration} className="admin-refresh">
          Add demo registration
        </button>
      </div>
      <section className="metric-grid">
        {metrics.map((item) => (
          <article className={`metric-card ${item.tone}`} key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value.toLocaleString()}</strong>
          </article>
        ))}
      </section>
      <section className="trend-card interactive-trend">
        <div className="trend-heading">
          <h2>User Registration Trend</h2>
          <span>
            {active
              ? `${active.users} registrations · ${active.date}`
              : "Hover a point to inspect"}
          </span>
        </div>
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          role="img"
          aria-label="Interactive user registration trend"
        >
          <g className="chart-lines">
            {[16, 34, 52, 70, 88].map((y) => (
              <line key={y} x1="8" x2="92" y1={y} y2={y} />
            ))}
          </g>
          <polyline
            points={points}
            fill="none"
            stroke="#075fbd"
            strokeWidth="1.1"
            vectorEffect="non-scaling-stroke"
          />
          {coords.map((item) => (
            <circle
              key={item.date}
              className={
                active?.date === item.date
                  ? "chart-point selected"
                  : "chart-point"
              }
              cx={item.x}
              cy={item.y}
              r="2.8"
              tabIndex="0"
              onMouseEnter={() => setActive(item)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(item)}
              onBlur={() => setActive(null)}
              onClick={() => setActive(item)}
            />
          ))}
        </svg>
        <div className="chart-days">
          {data.map((item) => (
            <button
              key={item.date}
              onClick={() => setActive(item)}
              className={active?.date === item.date ? "active" : ""}
            >
              {item.date}
            </button>
          ))}
        </div>
      </section>
    </AdminLayout>
  );
}
export default AdminDashboard;
