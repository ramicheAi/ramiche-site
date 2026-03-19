"use client";

import Link from "next/link";

export default function CommandCenterError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0a0a",
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        padding: "2rem",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 480 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
            fontSize: 20,
          }}
        >
          !
        </div>
        <h2
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: "#e5e5e5",
            marginBottom: 8,
          }}
        >
          Command Center Error
        </h2>
        <p
          style={{
            color: "#888888",
            fontSize: 14,
            lineHeight: 1.6,
            marginBottom: 8,
          }}
        >
          Something went wrong loading the Command Center.
        </p>
        <p
          style={{
            color: "#555555",
            fontSize: 12,
            fontFamily: "monospace",
            marginBottom: 20,
            wordBreak: "break-word",
          }}
        >
          {error?.message || "Unknown error"}
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button
            onClick={reset}
            style={{
              background: "rgba(124,58,237,0.15)",
              color: "#a855f7",
              border: "1px solid rgba(124,58,237,0.3)",
              padding: "10px 24px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try Again
          </button>
          <Link
            href="/"
            style={{
              background: "rgba(255,255,255,0.04)",
              color: "#888888",
              border: "1px solid #1e1e1e",
              padding: "10px 24px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
