import React from "react";
import { useNavigate } from "react-router-dom";
import { CustomerLayout } from "./CustomerDashboard";
const providers = ["Sylvia Lee", "Mickey Mouse", "Coco Mangusin"];
export default function Providers() {
  const nav = useNavigate();
  return (
    <CustomerLayout>
      <h1 className="customer-title">Service Providers</h1>
      <input
        className="customer-search"
        placeholder="Search services or service providers..."
      />
      <div className="filter-pills">
        {[
          "Available",
          "Top rated",
          "Automotive",
          "IT and Phone",
          "Home Repair",
        ].map((x, i) => (
          <button className={i === 2 ? "active" : ""} key={x}>
            {x}
          </button>
        ))}
      </div>
      <div className="provider-list">
        {providers.map((name) => (
          <article key={name}>
            <div>
              <h3>{name}</h3>
              <p>⌖ Panganiban Drive, Naga City</p>
              <u>Reviews (4.1)</u>
            </div>
            <div>
              <span className="verified">✓ Verified</span>
              <span className="available">Available</span>
            </div>
            <button onClick={() => nav("/customer/providers/profile")}>
              View Profile
            </button>
          </article>
        ))}
      </div>
    </CustomerLayout>
  );
}
