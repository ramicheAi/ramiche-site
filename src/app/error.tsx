"use client";

import { useEffect, useState } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    console.error("[Parallax Error]", error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a0a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, -apple-system, sans-serif",
        padding: "2rem",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 480 }}>
        <h1
          style={{
            fontSize: "1.75rem",
            fontWeight: 800,
            color: "#fff",
            marginBottom: "0.75rem",
            letterSpacing: "-0.02em",
          }}
        >
          Something went wrong
        </h1>

        <p
          style={{
            color: "#94a3b8",
            fontSize: "1rem",
            lineHeight: 1.6,
            marginBottom: "1rem",
          }}
        >
          {error.message || "An unexpected error occurred."}
        </p>

        <button
          onClick={reset}
          style={{
            background: "linear-gradient(135deg, #1a1a5e, #2a2a7e)",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.15)",
            padding: "14px 40px",
            borderRadius: 12,
            fontSize: "1rem",
            fontWeight: 700,
            cursor: "pointer",
            letterSpacing: "0.03em",
          }}
        >
          Try Again
        </button>

        <button
          onClick={() => setShowDetails(!showDetails)}
          style={{
            display: "block",
            margin: "1rem auto 0",
            background: "none",
            border: "none",
            color: "#475569",
            fontSize: "0.8rem",
            cursor: "pointer",
          }}
        >
          {showDetails ? "Hide details" : "Show error details"}
        </button>

        {showDetails && (
          <pre
            style={{
              marginTop: "1rem",
              padding: "1rem",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              color: "#ef4444",
              fontSize: "0.7rem",
              textAlign: "left",
              overflow: "auto",
              maxHeight: 200,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {error.stack || error.message || "No details available"}
            {error.digest && `\nDigest: ${error.digest}`}
          </pre>
        )}
      </div>
    </div>
  );
}
