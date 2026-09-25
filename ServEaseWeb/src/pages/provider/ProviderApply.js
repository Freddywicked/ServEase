import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Brand from "../../components/common/Brand";
import { registrationApi } from "../../services/registrationApi";

const initialPersonalDetails = {
  firstName: "",
  middleName: "",
  lastName: "",
  email: "",
  birthdate: "",
  gender: "",
  phone: "",
  address: "",
};

function ProviderField({ label, name, onChange, type = "text", value }) {
  return (
    <div className="form-field">
      <label>{label}</label>
      <input
        name={name}
        onChange={onChange}
        type={type}
        value={value}
        required={name !== "middleName"}
      />
    </div>
  );
}

export default function ProviderApply() {
  const navigate = useNavigate();
  const [personalDetails, setPersonalDetails] = useState(initialPersonalDetails);

  function updateField(event) {
    const { name, value } = event.target;
    setPersonalDetails((currentDetails) => ({
      ...currentDetails,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    await registrationApi.saveProviderDetails({ personalDetails });
    navigate("/provider/category");
  }

  return (
    <main className="provider-page">
      <Brand large />
      <h1 className="provider-title">Apply as Service Provider</h1>
      <form className="provider-form" onSubmit={handleSubmit}>
        <section className="provider-panel">
          <h3>Personal Details</h3>
          <div className="provider-grid">
            <div>
              <ProviderField
                label="FIRST NAME"
                name="firstName"
                onChange={updateField}
                value={personalDetails.firstName}
              />
              <ProviderField
                label="MIDDLE NAME (OPTIONAL)"
                name="middleName"
                onChange={updateField}
                value={personalDetails.middleName}
              />
              <ProviderField
                label="LAST NAME"
                name="lastName"
                onChange={updateField}
                value={personalDetails.lastName}
              />
              <ProviderField
                label="EMAIL ADDRESS"
                name="email"
                onChange={updateField}
                type="email"
                value={personalDetails.email}
              />
            </div>
            <div>
              <ProviderField
                label="DATE OF BIRTH"
                name="birthdate"
                onChange={updateField}
                type="date"
                value={personalDetails.birthdate}
              />
              <div className="form-field">
                <label>GENDER</label>
                <select
                  name="gender"
                  onChange={updateField}
                  required
                  value={personalDetails.gender}
                >
                  <option value="" disabled>Select gender</option>
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <ProviderField
                label="PHONE NUMBER"
                name="phone"
                onChange={updateField}
                value={personalDetails.phone}
              />
              <ProviderField
                label="ADDRESS"
                name="address"
                onChange={updateField}
                value={personalDetails.address}
              />
            </div>
          </div>
        </section>
        <button className="gradient-button provider-action">NEXT</button>
      </form>
    </main>
  );
}
