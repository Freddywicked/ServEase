import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheckCircle, faStar } from "@fortawesome/free-solid-svg-icons";
import { CustomerLayout } from "./CustomerDashboard";
import { customerFlowApi } from "../../services/customerFlowApi";
import "./service-provider-profile.css";

export default function ServiceProviderProfile() {
  const location = useLocation();
  const navigate = useNavigate();
  const [provider, setProvider] = useState(null);
  const providerId = new URLSearchParams(location.search).get("id");

  useEffect(() => {
    customerFlowApi.getProvider(providerId).then(setProvider);
  }, [providerId]);

  async function chooseProvider() {
    await customerFlowApi.chooseProvider(provider.id);
    navigate("/customer/request/sent");
  }

  if (!provider) {
    return <CustomerLayout><p>Provider not found.</p></CustomerLayout>;
  }

  return (
    <CustomerLayout>
      <section className="service-provider-profile">
        <div className="sp-avatar" />
        <h2>{provider.name}</h2>
        <p>{provider.serviceType} Service Provider</p>
        <div className="sp-badges">
          {provider.verified && <span><FontAwesomeIcon icon={faCheckCircle} /> Verified</span>}
          {provider.available && <span>Available</span>}
          <button onClick={() => navigate("/customer/messages")}>Message</button>
        </div>
        <p>{provider.yearsOfExperience} years experience</p>
        <p><b>Specialties:</b> {provider.specialties.join(", ")}<br /><b>Location:</b> {provider.location} · {provider.distance}<br /><b>Available:</b> {provider.schedule}</p>
        <b>{provider.positiveFeedback}</b>
        <h4>AI Summary Insights</h4>
        <div className="sp-chips">{provider.insights.map((insight) => <span key={insight}>{insight}</span>)}</div>
        <p className="sp-rating"><FontAwesomeIcon icon={faStar} /> {provider.rating}　 {provider.reviewCount} reviews</p>
        {provider.reviews.map((review, index) => (
          <div className="sp-review" key={`${review.author}-${index}`}>
            <b>{review.author}</b><br />★★★★★<br />
            <small>Service Availed: {review.service}<br />{review.comment}</small>
          </div>
        ))}
        <button className="sp-choose" onClick={chooseProvider}>Choose this Service Provider</button>
      </section>
    </CustomerLayout>
  );
}
