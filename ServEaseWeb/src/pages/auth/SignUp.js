import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Brand from "../../components/common/Brand";
import FileUpload from "../../components/common/FileUpload";
const Field = ({ label, type = "text", placeholder }) => (
  <div className="form-field">
    <label>{label}</label>
    <input type={type} placeholder={placeholder} required />
  </div>
);
function SignUp() {
  const nav = useNavigate();
  const [ok, setOk] = useState(false);
  return (
    <main className="auth-page">
      <section className="auth-card">
        <Brand />
        <h1 className="auth-title">Create your account</h1>
        <p className="auth-subtitle">
          Start booking trusted service providers near you.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            nav("/role-select");
          }}
        >
          <Field label="FULL NAME" placeholder="Juan Luna" />
          <Field
            label="EMAIL ADDRESS"
            type="email"
            placeholder="juanluna@gmail.com"
          />
          <Field label="PHONE NUMBER" placeholder="+63 912 345 6789" />
          <Field
            label="PASSWORD"
            type="password"
            placeholder="Create a password"
          />
          <Field
            label="CONFIRM PASSWORD"
            type="password"
            placeholder="Confirm password"
          />
          <Field
            label="ADDRESS"
            placeholder="Street, Barangay, Municipality, Province"
          />
          <FileUpload
            label="UPLOAD VALID ID"
            hint="Government-issued ID for account verification"
          />
          <label className="terms">
            <input
              type="checkbox"
              checked={ok}
              onChange={(e) => setOk(e.target.checked)}
            />
            I agree to ServEase's Terms of Service and Privacy Policy
          </label>
          <button className="gradient-button" disabled={!ok}>
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
export default SignUp;
