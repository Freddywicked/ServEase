import React from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheckCircle, faStar } from "@fortawesome/free-solid-svg-icons";
import { CustomerLayout } from "./CustomerDashboard";
import "./service-provider-profile.css";

export default function ServiceProviderProfile() {
  const nav = useNavigate();
  return (
    <CustomerLayout>
      <section className="service-provider-profile">
        <div className="sp-avatar" />
        <h2>Sylvia Lee</h2>
        <p>Automotive Repair Service Provider</p>
        <div className="sp-badges">
          <span>
            <FontAwesomeIcon icon={faCheckCircle} /> Verified
          </span>
          <span>Available</span>
          <button onClick={() => nav("/customer/messages")}>Message</button>
        </div>
        <p>5 years experience</p>
        <p>
          <b>Specialties:</b> IT and Phone Repair
          <br />
          <b>Location:</b> Naga City · 2.5 km away
          <br />
          <b>Available:</b> Mon–Fri, 8AM–6PM
        </p>
        <b>92% Positive Feedback</b>
        <h4>AI Summary Insights</h4>
        <div className="sp-chips">
          <span>Professional</span>
          <span>Always on Time</span>
        </div>
        <p className="sp-rating">
          <FontAwesomeIcon icon={faStar} /> 4.8　 95 reviews
        </p>
        <div className="sp-review">
          <b>N**** O*ea</b>
          <br />
          ★★★★★
          <br />
          <small>
            Service Availed: Engine Repair
            <br />
            The technician was on time. They did a great job at providing their
            service.
          </small>
        </div>
        <div className="sp-review">
          <b>N**** O*ea</b>
          <br />
          ★★★★★
          <br />
          <small>
            Service Availed: Engine Repair
            <br />
            The technician was on time. They did a great job at providing their
            service.
          </small>
        </div>
        <button
          className="sp-choose"
          onClick={() => nav("/customer/request/sent")}
        >
          Choose this Service Provider
        </button>
      </section>
    </CustomerLayout>
  );
}
