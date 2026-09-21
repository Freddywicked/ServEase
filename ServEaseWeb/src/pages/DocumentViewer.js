import React, { useEffect, useState } from "react";

function DocumentViewer() {
  const [content, setContent] = useState("Loading manuscript...");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/tmp_manuscript.txt")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Manuscript file not found");
        }
        return response.text();
      })
      .then((text) => setContent(text))
      .catch(() => setError("The manuscript file could not be loaded."));
  }, []);

  return (
    <div
      style={{
        maxWidth: "980px",
        margin: "40px auto",
        padding: "24px",
        background: "#f8fafc",
        borderRadius: "12px",
        boxShadow: "0 12px 24px rgba(15, 23, 42, 0.06)",
        color: "#0f172a",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1 style={{ marginBottom: "20px", textAlign: "center" }}>
        ServEase Manuscript
      </h1>

      {error ? (
        <p style={{ color: "#b91c1c", textAlign: "center" }}>{error}</p>
      ) : (
        <pre
          style={{
            whiteSpace: "pre-wrap",
            lineHeight: "1.7",
            fontSize: "15px",
            margin: 0,
          }}
        >
          {content}
        </pre>
      )}
    </div>
  );
}

export default DocumentViewer;
