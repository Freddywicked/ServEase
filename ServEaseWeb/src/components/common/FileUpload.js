import React, { useId, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faCloudArrowUp } from "@fortawesome/free-solid-svg-icons";

function FileUpload({ label, hint, className = "" }) {
  const id = useId();
  const [file, setFile] = useState(null);
  return (
    <div className={`upload-section ${className}`}>
      {label && <span className="upload-label">{label}</span>}
      <input
        id={id}
        className="file-input"
        type="file"
        accept="image/*,.pdf"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />
      <label
        htmlFor={id}
        className={`upload-box upload-trigger ${file ? "has-file" : ""}`}
      >
        <span className="upload-icon">
          <FontAwesomeIcon icon={file ? faCheck : faCloudArrowUp} />
        </span>
        <span className="upload-copy">
          <strong>{file ? file.name : "Tap to upload"}</strong>
          <small>{file ? "File ready to upload" : hint}</small>
        </span>
      </label>
    </div>
  );
}
export default FileUpload;
