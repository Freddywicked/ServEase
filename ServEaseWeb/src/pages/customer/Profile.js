import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPenToSquare,
  faRightFromBracket,
  faScrewdriverWrench,
} from "@fortawesome/free-solid-svg-icons";
import { CustomerLayout } from "./CustomerDashboard";
import { registrationApi } from "../../services/registrationApi";
import "./profile.css";

export default function Profile() {
  const nav = useNavigate();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    registrationApi.getRegistration().then((registration) => {
      setProfile(registration?.profile || null);
    });
  }, []);

  const name = profile?.fullName || "Customer";
  const contact = [profile?.email, profile?.phone].filter(Boolean).join(" | ");
  return (
    <CustomerLayout>
      <h1 className="customer-title">Profile</h1>
      <section className="customer-profile">
        <div className="customer-avatar" />
        <h2>{name}</h2>
        <p>{contact || "No contact details available"}</p>
      </section>
      <div className="customer-profile-actions">
        <button>
          <FontAwesomeIcon icon={faPenToSquare} /> Edit Profile
        </button>
        <button onClick={() => nav("/provider/apply")}>
          <FontAwesomeIcon icon={faScrewdriverWrench} /> Apply as Service
          Provider
        </button>
        <button onClick={() => nav("/signin")}>
          <FontAwesomeIcon icon={faRightFromBracket} /> Log out
        </button>
      </div>
    </CustomerLayout>
  );
}
