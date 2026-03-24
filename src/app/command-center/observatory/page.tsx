"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import ParticleField from "@/components/ParticleField";

/* ══════════════════════════════════════════════════════════════════════════════
   THE MULTIVERSE — Strategic Observatory
   Dr. Strange's YOLO Build — Venture probability mapping, scenario trees,
   interactive roadmap. Embedded from multiverse-cmd.vercel.app
   ══════════════════════════════════════════════════════════════════════════════ */

const MULTIVERSE_URL = "https://multiverse-cmd.vercel.app";

export default function ObservatoryPage() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && fullscreen) setFullscreen(false);
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        setFullscreen((f) => !f);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [fullscreen]);

  return (
    <div
      style={{
        position: "relative",
        minHeight: "100vh",
        background: "#000000",
        color: "#e5e5e5",
        overflow: "hidden",
      }}
    >
      {!fullscreen && <ParticleField />}

      {/* Header */}
      {!fullscreen && (
        <div
          style={{
            position: "relative",
            zIndex: 2,
            width: "100%",
            maxWidth: 1400,
            margin: "0 auto",
            padding: "32px 24px 0",
          }}
        >
          <Link
            href="/command-center"
            style={{
              fontSize: 11,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#737373",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 8,
            }}
          >
            <span style={{ fontSize: 14 }}>&larr;</span> COMMAND CENTER
          </Link>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
            }}
          >
            <div>
              <h1
                style={{
                  fontSize: 32,
                  fontWeight: 900,
                  margin: 0,
                  color: "#e5e5e5",
                  textShadow:
                    "0 0 40px rgba(155,93,229,0.3), 0 0 80px rgba(0,245,212,0.15)",
                }}
              >
                THE MULTIVERSE
              </h1>
              <p
                style={{
                  fontSize: 13,
                  color: "#737373",
                  margin: "6px 0 0",
                }}
              >
                DR. STRANGE — Strategic Observatory &middot; Venture Scenarios
                &middot; Probability Mapping
              </p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setFullscreen(true)}
                style={{
                  padding: "7px 14px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 500,
                  border: "1px solid rgba(155,93,229,0.3)",
                  background: "rgba(155,93,229,0.1)",
                  color: "#9b5de5",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span style={{ fontSize: 14 }}>⛶</span> Fullscreen
              </button>
              <a
                href={MULTIVERSE_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: "7px 14px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 500,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.03)",
                  color: "#737373",
                  textDecoration: "none",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span style={{ fontSize: 14 }}>↗</span> Open Standalone
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen close button */}
      {fullscreen && (
        <button
          onClick={() => setFullscreen(false)}
          style={{
            position: "fixed",
            top: 16,
            right: 16,
            zIndex: 1000,
            padding: "8px 14px",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            border: "1px solid rgba(255,255,255,0.2)",
            background: "rgba(0,0,0,0.8)",
            color: "#e5e5e5",
            cursor: "pointer",
            backdropFilter: "blur(10px)",
          }}
        >
          ESC — Exit Fullscreen
        </button>
      )}

      {/* Iframe Container */}
      <div
        style={{
          position: fullscreen ? "fixed" : "relative",
          inset: fullscreen ? 0 : "auto",
          zIndex: fullscreen ? 999 : 2,
          width: fullscreen ? "100vw" : "100%",
          maxWidth: fullscreen ? "none" : 1400,
          height: fullscreen ? "100vh" : "calc(100vh - 140px)",
          margin: fullscreen ? 0 : "0 auto",
          padding: fullscreen ? 0 : "0 24px 24px",
        }}
      >
        {/* Loading state */}
        {!loaded && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              gap: 16,
              zIndex: 5,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                border: "2px solid rgba(155,93,229,0.2)",
                borderTopColor: "#9b5de5",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
              }}
            />
            <span
              style={{
                fontSize: 12,
                color: "#737373",
                letterSpacing: "0.1em",
              }}
            >
              LOADING MULTIVERSE...
            </span>
          </div>
        )}

        <iframe
          ref={iframeRef}
          src={MULTIVERSE_URL}
          onLoad={() => setLoaded(true)}
          style={{
            width: "100%",
            height: "100%",
            border: loaded ? "1px solid rgba(155,93,229,0.15)" : "none",
            borderRadius: fullscreen ? 0 : 12,
            background: "#0a0a0f",
            opacity: loaded ? 1 : 0,
            transition: "opacity 0.4s ease-in-out",
          }}
          allow="fullscreen"
          title="The Multiverse — Strategic Observatory"
        />
      </div>

      <style jsx>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
