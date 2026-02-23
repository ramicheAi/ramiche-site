"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { validateInviteToken, recordInviteUse, type Invite } from "../invites";
import { getSession, getRedirectForRole } from "../auth";

/* ══════════════════════════════════════════════════════════════
   APEX ATHLETE — Join Page
   Handles invite link landing: validates token → routes to
   the correct portal registration/login for the invited role.
   ══════════════════════════════════════════════════════════════ */

const ROLE_CONFIG = {
  coach: {
    title: "Coach",
    accent: "#00f0ff",
    icon: (
      <svg width={48} height={48} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8" r="4" stroke="#00f0ff" strokeWidth="1.5" fill="rgba(0,240,255,0.1)" />
        <path d="M4 20c0-4.418 3.582-8 8-8s8 3.582 8 8" stroke="#00f0ff" strokeWidth="1.5" strokeLinecap="round" fill="rgba(0,240,255,0.03)" />
        <path d="M15 3l2 2-2 2" stroke="#00f0ff" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M13 5h4" stroke="#00f0ff" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
    loginPath: "/apex-athlete/login",
    portalPath: "/apex-athlete",
  },
  athlete: {
    title: "Athlete",
    accent: "#a855f7",
    icon: (
      <svg width={48} height={48} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke="#a855f7" strokeWidth="1.5" fill="rgba(168,85,247,0.1)" />
        <path d="M8 14c0-2.21 1.79-4 4-4s4 1.79 4 4" stroke="#a855f7" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="12" cy="9" r="2" stroke="#a855f7" strokeWidth="1.3" fill="rgba(168,85,247,0.15)" />
      </svg>
    ),
    loginPath: "/apex-athlete/athlete",
    portalPath: "/apex-athlete/athlete",
  },
  parent: {
    title: "Parent",
    accent: "#f59e0b",
    icon: (
      <svg width={48} height={48} viewBox="0 0 24 24" fill="none">
        <circle cx="9" cy="7" r="3.5" stroke="#f59e0b" strokeWidth="1.5" fill="rgba(245,158,11,0.1)" />
        <path d="M3 19c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" fill="rgba(245,158,11,0.03)" />
        <circle cx="17" cy="9" r="2.5" stroke="#f59e0b" strokeWidth="1.3" fill="rgba(245,158,11,0.08)" />
        <path d="M14 19c0-2.21 1.343-4 3-4s3 1.79 3 4" stroke="#f59e0b" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
    loginPath: "/apex-athlete/login",
    portalPath: "/apex-athlete/parent",
  },
} as const;

function JoinContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [status, setStatus] = useState<"loading" | "valid" | "error">("loading");
  const [invite, setInvite] = useState<Invite | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setError("No invite token provided.");
      return;
    }

    // Check if already logged in
    const session = getSession();
    if (session) {
      window.location.href = getRedirectForRole(session.role);
      return;
    }

    validateInviteToken(token).then((result) => {
      if (result.valid && result.invite) {
        setInvite(result.invite);
        setStatus("valid");
      } else {
        setStatus("error");
        setError(result.error || "Invalid invite.");
      }
    });
  }, [token]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[#06020f] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-[#00f0ff]/30 border-t-[#00f0ff] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/30 text-sm font-mono">Validating invite...</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen bg-[#06020f] flex items-center justify-center px-5">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
            <svg width={32} height={32} viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="#ef4444" strokeWidth="1.5" fill="rgba(239,68,68,0.1)" />
              <path d="M15 9l-6 6M9 9l6 6" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Invite Not Valid</h2>
          <p className="text-red-400/70 text-sm mb-8">{error}</p>
          <Link
            href="/apex-athlete/login"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-white/60 text-sm hover:bg-white/10 transition-all"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  if (!invite) return null;

  const config = ROLE_CONFIG[invite.role];

  const handleContinue = () => {
    // Record the use
    recordInviteUse(token);
    // Store token in sessionStorage so the login/portal page knows this user came from an invite
    sessionStorage.setItem("apex-invite-token", token);
    sessionStorage.setItem("apex-invite-role", invite.role);
    // Route to the appropriate portal/login
    window.location.href = config.loginPath;
  };

  return (
    <div className="min-h-screen bg-[#06020f] relative overflow-hidden flex items-center justify-center px-5 py-8">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full"
          style={{ background: `radial-gradient(circle, ${config.accent}08, transparent 60%)` }}
        />
        <div
          className="absolute bottom-[-15%] right-[-5%] w-[500px] h-[500px] rounded-full"
          style={{ background: `radial-gradient(circle, ${config.accent}05, transparent 60%)` }}
        />
      </div>

      <div className="relative z-10 w-full max-w-sm text-center">
        {/* Welcome icon */}
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6"
          style={{
            background: `radial-gradient(circle at 30% 30%, ${config.accent}15, ${config.accent}05)`,
            border: `2px solid ${config.accent}25`,
          }}
        >
          {config.icon}
        </div>

        {/* Invite badge */}
        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6"
          style={{
            background: `${config.accent}08`,
            border: `1px solid ${config.accent}20`,
          }}
        >
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: config.accent }} />
          <span className="text-xs font-mono tracking-wider" style={{ color: `${config.accent}90` }}>
            {config.title.toUpperCase()} INVITE
          </span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-black text-white mb-3">
          You&apos;re Invited
        </h1>

        <p className="text-white/30 text-sm mb-2">
          You&apos;ve been invited to join as a <strong className="text-white/50">{config.title}</strong>
        </p>
        <p className="text-white/20 text-xs font-mono mb-8">{invite.label}</p>

        {/* CTA */}
        <button
          onClick={handleContinue}
          className="w-full py-4 rounded-xl font-bold text-base tracking-wider uppercase transition-all active:scale-[0.97] min-h-[52px] border"
          style={{
            background: `linear-gradient(to right, ${config.accent}20, ${config.accent}10)`,
            borderColor: `${config.accent}30`,
            color: config.accent,
          }}
        >
          Get Started
        </button>

        <p className="text-white/10 text-[10px] font-mono mt-8">
          APEX ATHLETE // Secure Invite System
        </p>
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#06020f] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#00f0ff]/30 border-t-[#00f0ff] rounded-full animate-spin" />
        </div>
      }
    >
      <JoinContent />
    </Suspense>
  );
}
