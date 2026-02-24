"use client";

import { useEffect } from "react";

export default function ApexAthleteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[METTLE Error]", error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a1a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, -apple-system, sans-serif",
        padding: "2rem",
      }}
    >
      <div
        style={{
          textAlign: "center",
          maxWidth: 480,
        }}
      >
        {/* METTLE Icon */}
        <div style={{ marginBottom: "2rem" }}>
          <img
            src="/mettle-brand/v5/mettle-icon.svg"
            alt="METTLE"
            style={{ width: 80, height: 80, opacity: 0.8 }}
          />
        </div>

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
            marginBottom: "2rem",
          }}
        >
          METTLE hit an unexpected error. This has been logged automatically.
        </p>

        <button
          onClick={reset}
          style={{
            background: "linear-gradient(135deg, #c9a227, #daa520, #b8860b)",
            color: "#0a0a1a",
            border: "none",
            padding: "14px 40px",
            borderRadius: 12,
            fontSize: "1rem",
            fontWeight: 800,
            cursor: "pointer",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          Try Again
        </button>

        <p
          style={{
            color: "#475569",
            fontSize: "0.8rem",
            marginTop: "2rem",
          }}
        >
          If this keeps happening, clear your browser cache and reload.
        </p>
      </div>
    </div>
  );
}
