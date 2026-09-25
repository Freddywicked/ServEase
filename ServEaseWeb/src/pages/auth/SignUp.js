import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Brand from "../../components/common/Brand";
import { registrationApi } from "../../services/registrationApi";

const initialForm = {
  fullName: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
  address: "",
  birthdate: "",
  gender: "",
};

function FormField({ label, name, onChange, type = "text", value }) {
  return (
    <div className="form-field">
      <label>{label}</label>
      <input
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        required
      />
    </div>
  );
}

export default function SignUp() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState("");

  function updateField(event) {
    const { name, value } = event.target;
    setForm((currentForm) => ({ ...currentForm, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    await registrationApi.startRegistration({
      fullName: form.fullName,
      email: form.email,
      phone: form.phone,
      password: form.password,
      address: form.address,
      birthdate: form.birthdate,
      gender: form.gender,
    });

    navigate("/verify-phone");
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Brand />
        <h1 className="auth-title">Create your account</h1>
        <p className="auth-subtitle">
          Start booking trusted service providers near you.
        </p>
        <form onSubmit={handleSubmit}>
          <FormField
            label="FULL NAME"
            name="fullName"
            value={form.fullName}
            onChange={updateField}
          />
          <FormField
            label="EMAIL ADDRESS"
            name="email"
            type="email"
            value={form.email}
            onChange={updateField}
          />
          <FormField
            label="PHONE NUMBER"
            name="phone"
            value={form.phone}
            onChange={updateField}
          />
          <FormField
            label="PASSWORD"
            name="password"
            type="password"
            value={form.password}
            onChange={updateField}
          />
          <FormField
            label="CONFIRM PASSWORD"
            name="confirmPassword"
            type="password"
            value={form.confirmPassword}
            onChange={updateField}
          />
          <FormField
            label="ADDRESS"
            name="address"
            value={form.address}
            onChange={updateField}
          />
          <FormField
            label="BIRTHDATE"
            name="birthdate"
            type="date"
            value={form.birthdate}
            onChange={updateField}
          />
          <div className="form-field">
            <label>GENDER</label>
            <select name="gender" value={form.gender} onChange={updateField} required>
              <option value="" disabled>Select gender</option>
              <option value="Female">Female</option>
              <option value="Male">Male</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <label className="terms">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(event) => setAcceptedTerms(event.target.checked)}
            />
            I agree to ServEase&apos;s Terms of Service and Privacy Policy
          </label>
          {error && <p className="form-error">{error}</p>}
          <button className="gradient-button" disabled={!acceptedTerms}>
            Next
          </button>
        </form>
        <p className="auth-footer">
          Already have an account? <Link to="/signin">Log in</Link>
        </p>
      </section>
    </main>
  );
}
