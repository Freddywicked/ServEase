import React from "react";
import { Link } from "react-router-dom";
import Brand from "../../components/common/Brand";

export default function ProviderPending() {
  return (
    <main className="provider-page">
      <Brand large />
      <section className="provider-panel">
        <h1 className="provider-title">Application submitted</h1>
        <p>
          Your service-provider application is pending admin verification. We
          will notify you when it has been reviewed.
        </p>
        <Link className="gradient-button provider-action" to="/signin">
          Back to sign in
        </Link>
      </section>
    </main>
  );
}
