import React, { useId, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faCloudArrowUp } from "@fortawesome/free-solid-svg-icons";

function FileUpload({ label, hint, className = "", file, onFileChange }) {
  const id = useId();
  const [localFile, setLocalFile] = useState(null);
  const selectedFile = file || localFile;

  function handleChange(event) {
    const nextFile = event.target.files?.[0] || null;

    setLocalFile(nextFile);
    onFileChange?.(nextFile);
  }

  return (
    <div className={`upload-section ${className}`}>
      {label && <span className="upload-label">{label}</span>}
      <input
        id={id}
        className="file-input"
        type="file"
        accept="image/*,.pdf"
        onChange={handleChange}
      />
      <label
        htmlFor={id}
        className={`upload-box upload-trigger ${selectedFile ? "has-file" : ""}`}
      >
        <span className="upload-icon">
          <FontAwesomeIcon icon={selectedFile ? faCheck : faCloudArrowUp} />
        </span>
        <span className="upload-copy">
          <strong>{selectedFile ? selectedFile.name : "Tap to upload"}</strong>
          <small>{selectedFile ? "File ready to upload" : hint}</small>
        </span>
      </label>
    </div>
  );
}
export default FileUpload;
