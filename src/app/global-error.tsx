"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          minHeight: "100vh",
          margin: 0,
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
            The app hit an unexpected error. Please try again.
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
            }}
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
