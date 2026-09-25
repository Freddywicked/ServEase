import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Brand from "../../components/common/Brand";
import { registrationApi } from "../../services/registrationApi";

export default function PhoneVerification() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      await registrationApi.verifyPhone(code);
      navigate("/role-select");
    } catch (verificationError) {
      setError(verificationError.message);
    }
  }

  return (
    <main className="role-page">
      <Brand large />
      <h1 className="role-title">Create your account</h1>
      <form className="phone-verification" onSubmit={handleSubmit}>
        <h2>Verify your phone number</h2>
        <p>Demo code: 123456</p>
        <input
          aria-label="Six-digit verification code"
          inputMode="numeric"
          maxLength="6"
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
          placeholder="Enter 6-digit code"
          required
        />
        {error && <p className="form-error">{error}</p>}
        <button className="gradient-button" disabled={code.length !== 6}>
          Verify
        </button>
      </form>
    </main>
  );
}
