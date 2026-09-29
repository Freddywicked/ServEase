import React, { useState } from "react";
import { Link } from "react-router-dom";
import Brand from "../../components/common/Brand";
import "./provider-pending-reference.css";

export default function ProviderPending() {
  const [showConfirmation, setShowConfirmation] = useState(true);

  return (
    <main className="provider-page provider-pending-page">
      <Brand large />
      <h1 className="provider-title">Apply as Service Provider</h1>
      <div className="progress provider-pending-progress" aria-hidden="true">
        <span />
        <span className="active" />
      </div>
      <section className="provider-panel verification-panel pending-verification-surface">
        <h3>Verification Requirements</h3>
        <div className="pending-upload-section">
          <span>UPLOAD VALID ID</span>
          <div className="pending-upload-box">⌑ <b>Tap to upload</b></div>
        </div>
        <div className="pending-upload-section">
          <span>SELFIE VERIFICATION</span>
          <div className="pending-upload-box">⌑ <b>Tap to upload</b></div>
        </div>
        <div className="pending-upload-section">
          <span>SUPPORTING DOCUMENTS (OPTIONAL)</span>
          <div className="pending-upload-box">⌑ <b>Tap to upload</b></div>
        </div>
        <div className="pending-agreements">
          <span>□ &nbsp; I CERTIFY THAT ALL INFORMATION PROVIDED IS TRUE AND CORRECT.</span>
          <span>□ &nbsp; I AGREE TO SERVEASE&apos;S TERMS &amp; CONDITIONS.</span>
        </div>
      </section>
      <div className="gradient-button provider-action pending-submit" aria-hidden="true">
        SUBMIT
      </div>

      {showConfirmation && (
        <div className="provider-pending-overlay">
          <section
            className="provider-pending-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pending-application-title"
          >
            <button
              type="button"
              className="provider-pending-close"
              onClick={() => setShowConfirmation(false)}
              aria-label="Close confirmation"
            >
              ×
            </button>
            <h2 id="pending-application-title">Application sent!</h2>
            <p>Please wait for your role approval.</p>
            <Link to="/customer/dashboard">Go to Customer Dashboard</Link>
          </section>
        </div>
      )}
    </main>
  );
}
