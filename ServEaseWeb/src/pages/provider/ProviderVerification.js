import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Brand from "../../components/common/Brand";
import FileUpload from "../../components/common/FileUpload";
import { registrationApi } from "../../services/registrationApi";

const initialDocuments = {
  validId: null,
  selfie: null,
  supportingDocument: null,
};

export default function ProviderVerification() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState(initialDocuments);
  const [certify, setCertify] = useState(false);
  const [agree, setAgree] = useState(false);

  function setDocument(key, file) {
    setDocuments((currentDocuments) => ({
      ...currentDocuments,
      [key]: file,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    await registrationApi.submitProviderApplication({
      documents,
      agreements: {
        certify,
        acceptedTerms: agree,
      },
    });

    navigate("/provider/pending");
  }

  const canSubmit = documents.validId && documents.selfie && certify && agree;

  return (
    <main className="provider-page">
      <Brand large />
      <h1 className="provider-title">Apply as Service Provider</h1>
      <div className="progress">
        <span />
        <span className="active" />
      </div>
      <form className="provider-form" onSubmit={handleSubmit}>
        <section className="provider-panel verification-panel">
          <h3>Verification Requirements</h3>
          <FileUpload
            file={documents.validId}
            hint="Government-issued ID"
            label="UPLOAD VALID ID"
            onFileChange={(file) => setDocument("validId", file)}
          />
          <FileUpload
            file={documents.selfie}
            hint="A clear photo of yourself"
            label="SELFIE VERIFICATION"
            onFileChange={(file) => setDocument("selfie", file)}
          />
          <FileUpload
            file={documents.supportingDocument}
            hint="Certificates or proof of experience"
            label="SUPPORTING DOCUMENTS (OPTIONAL)"
            onFileChange={(file) => setDocument("supportingDocument", file)}
          />
          <label className="terms">
            <input
              checked={certify}
              onChange={(event) => setCertify(event.target.checked)}
              type="checkbox"
            />
            I CERTIFY THAT ALL INFORMATION PROVIDED IS TRUE AND CORRECT.
          </label>
          <label className="terms">
            <input
              checked={agree}
              onChange={(event) => setAgree(event.target.checked)}
              type="checkbox"
            />
            I AGREE TO SERVEASE&apos;S TERMS &amp; CONDITIONS.
          </label>
        </section>
        <button
          className="gradient-button provider-action"
          disabled={!canSubmit}
        >
          SUBMIT
        </button>
      </form>
    </main>
  );
}
