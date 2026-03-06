"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
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
            marginBottom: "2rem",
          }}
        >
          An unexpected error occurred. This has been logged.
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
