import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Brand from "../../components/common/Brand";
import FileUpload from "../../components/common/FileUpload";

function ProviderVerification() {
  const nav = useNavigate();
  const [certify, setCertify] = useState(false);
  const [agree, setAgree] = useState(false);
  const submit = (e) => {
    e.preventDefault();
    localStorage.setItem("servease_account_name", "Jess Garcia");
    nav("/provider/dashboard");
  };
  return (
    <main className="provider-page">
      <Brand large />
      <h1 className="provider-title">Apply as Service Provider</h1>
      <div className="progress">
        <span />
        <span />
        <span className="active" />
      </div>
      <form className="provider-form" onSubmit={submit}>
        <section className="provider-panel verification-panel">
          <h3>Verification Requirements</h3>
          <FileUpload label="UPLOAD VALID ID" hint="Government-issued ID" />
          <FileUpload
            label="SELFIE VERIFICATION"
            hint="A clear photo of yourself"
          />
          <FileUpload
            label="SUPPORTING DOCUMENTS (OPTIONAL)"
            hint="Certificates or proof of experience"
          />
          <label className="terms">
            <input
              type="checkbox"
              checked={certify}
              onChange={(e) => setCertify(e.target.checked)}
            />
            I CERTIFY THAT ALL INFORMATION PROVIDED IS TRUE AND CORRECT.
          </label>
          <label className="terms">
            <input
              type="checkbox"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
            />
            I AGREE TO SERVEASE'S TERMS &amp; CONDITIONS.
          </label>
        </section>
        <button
          className="gradient-button provider-action"
          disabled={!certify || !agree}
        >
          SUBMIT
        </button>
      </form>
    </main>
  );
}
export default ProviderVerification;
