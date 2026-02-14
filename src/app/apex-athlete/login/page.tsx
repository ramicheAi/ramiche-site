"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  loginWithPin,
  loginCoach,
  loginParent,
  getSession,
  getRedirectForRole,
  registerCoach,
  registerParent,
  type AuthRole,
} from "../auth";

/* ══════════════════════════════════════════════════════════════
   APEX ATHLETE — Login Page
   Unified authentication: Coach (email+pw), Parent (email+code),
   Admin (PIN or email+pw). Dark sci-fi game HUD aesthetic.
   ══════════════════════════════════════════════════════════════ */

// ── SVG Icons ───────────────────────────────────────────────

const SvgShield = ({ size = 48, color = "#00f0ff" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2l8 4v5c0 5.5-3.8 10-8 11.5C7.8 21 4 16.5 4 11V6l8-4z" stroke={color} strokeWidth="1.5" strokeLinejoin="round" fill={`${color}10`} />
    <rect x="9" y="11" width="6" height="5" rx="1" stroke={color} strokeWidth="1.3" fill={`${color}15`} />
    <path d="M10 11v-2a2 2 0 014 0v2" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

const SvgCoach = ({ size = 28, color = "#00f0ff" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="8" r="4" stroke={color} strokeWidth="1.5" fill={`${color}10`} />
    <path d="M4 20c0-4.418 3.582-8 8-8s8 3.582 8 8" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill={`${color}05`} />
    <path d="M15 3l2 2-2 2" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M13 5h4" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

const SvgParent = ({ size = 28, color = "#f59e0b" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="9" cy="7" r="3.5" stroke={color} strokeWidth="1.5" fill={`${color}10`} />
    <path d="M3 19c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill={`${color}05`} />
    <circle cx="17" cy="9" r="2.5" stroke={color} strokeWidth="1.3" fill={`${color}08`} />
    <path d="M14 19c0-2.21 1.343-4 3-4s3 1.79 3 4" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

const SvgKey = ({ size = 28, color = "#a855f7" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="8" cy="15" r="5" stroke={color} strokeWidth="1.5" fill={`${color}10`} />
    <circle cx="8" cy="15" r="2" stroke={color} strokeWidth="1" fill={`${color}20`} />
    <path d="M12 11l7-7" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <path d="M17 4l3 3" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <path d="M15 6l2 2" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

const SvgMail = ({ size = 20, color = "#94a3b8" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="5" width="18" height="14" rx="2" stroke={color} strokeWidth="1.5" fill={`${color}08`} />
    <path d="M3 7l9 6 9-6" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SvgLock = ({ size = 20, color = "#94a3b8" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="5" y="11" width="14" height="10" rx="2" stroke={color} strokeWidth="1.5" fill={`${color}08`} />
    <path d="M8 11V7a4 4 0 018 0v4" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="12" cy="16" r="1.5" fill={color} />
  </svg>
);

const SvgHash = ({ size = 20, color = "#94a3b8" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 3L8 21M16 3l-2 18M3 8h18M3 16h18" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const SvgArrowLeft = ({ size = 16, color = "#94a3b8" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M19 12H5M12 5l-7 7 7 7" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SvgUserPlus = ({ size = 20, color = "#94a3b8" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="10" cy="8" r="4" stroke={color} strokeWidth="1.5" fill={`${color}08`} />
    <path d="M3 20c0-3.866 3.134-7 7-7s7 3.134 7 7" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <path d="M20 8v6M17 11h6" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

// ── Types ───────────────────────────────────────────────────

type LoginMode = "select" | "coach" | "parent" | "admin" | "register-coach" | "register-parent";

// ── Background Effect ───────────────────────────────────────

const BgOrbs = () => (
  <div className="fixed inset-0 pointer-events-none overflow-hidden">
    <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(0,240,255,0.06)_0%,transparent_60%)]" />
    <div className="absolute bottom-[-15%] right-[-5%] w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(168,85,247,0.05)_0%,transparent_60%)]" />
    <div className="absolute top-[30%] right-[15%] w-[400px] h-[400px] rounded-full bg-[radial-gradient(circle,rgba(245,158,11,0.04)_0%,transparent_60%)]" />
  </div>
);

// ── Main Login Component ────────────────────────────────────

export default function LoginPage() {
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<LoginMode>("select");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
    // If already logged in, redirect
    const session = getSession();
    if (session) {
      window.location.href = getRedirectForRole(session.role);
    }
  }, []);

  const clearForm = () => {
    setEmail("");
    setPassword("");
    setCode("");
    setPin("");
    setName("");
    setError("");
    setSuccess("");
  };

  const switchMode = (m: LoginMode) => {
    clearForm();
    setMode(m);
  };

  // ── Handlers ────────────────────────────────────────────

  const handleCoachLogin = () => {
    setError("");
    if (!email.trim()) { setError("Email is required."); return; }
    if (!password.trim()) { setError("Password is required."); return; }
    setLoading(true);
    // Simulate async for UX
    setTimeout(() => {
      const result = loginCoach(email.trim(), password);
      setLoading(false);
      if (result.success && result.session) {
        window.location.href = getRedirectForRole(result.session.role);
      } else {
        setError(result.error || "Login failed.");
      }
    }, 400);
  };

  const handleParentLogin = () => {
    setError("");
    if (!email.trim()) { setError("Email is required."); return; }
    if (!code.trim()) { setError("Verification code is required."); return; }
    setLoading(true);
    setTimeout(() => {
      const result = loginParent(email.trim(), code.trim());
      setLoading(false);
      if (result.success && result.session) {
        window.location.href = getRedirectForRole(result.session.role);
      } else {
        setError(result.error || "Login failed.");
      }
    }, 400);
  };

  const handlePinLogin = () => {
    setError("");
    if (!pin.trim()) { setError("PIN is required."); return; }
    setLoading(true);
    setTimeout(() => {
      const result = loginWithPin(pin.trim());
      setLoading(false);
      if (result.success && result.session) {
        window.location.href = getRedirectForRole(result.session.role);
      } else {
        setError(result.error || "Invalid PIN.");
      }
    }, 400);
  };

  const handleCoachRegister = () => {
    setError("");
    setSuccess("");
    if (!name.trim()) { setError("Name is required."); return; }
    if (!email.trim()) { setError("Email is required."); return; }
    if (!password.trim() || password.length < 4) { setError("Password must be at least 4 characters."); return; }
    const result = registerCoach(email.trim(), password, name.trim());
    if (result.success) {
      setSuccess("Account created! You can now sign in.");
      setTimeout(() => switchMode("coach"), 1500);
    } else {
      setError(result.error || "Registration failed.");
    }
  };

  const handleParentRegister = () => {
    setError("");
    setSuccess("");
    if (!name.trim()) { setError("Name is required."); return; }
    if (!email.trim()) { setError("Email is required."); return; }
    if (!code.trim() || code.length < 4) { setError("Enter the verification code from your coach."); return; }
    const result = registerParent(email.trim(), name.trim(), code.trim());
    if (result.success) {
      setSuccess("Account created! You can now sign in.");
      setTimeout(() => switchMode("parent"), 1500);
    } else {
      setError(result.error || "Registration failed.");
    }
  };

  // ── Loading state ───────────────────────────────────────

  if (!mounted) return (
    <div className="min-h-screen bg-[#06020f] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#00f0ff]/30 border-t-[#00f0ff] rounded-full animate-spin" />
    </div>
  );

  // ── Shared UI helpers ───────────────────────────────────

  const inputClass = (hasError: boolean = false) =>
    `w-full px-4 py-4 bg-[#0a0518]/80 backdrop-blur-xl border rounded-xl text-white text-base placeholder:text-white/25 focus:outline-none transition-all font-mono ${
      hasError
        ? "border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]"
        : "border-white/10 focus:border-[#00f0ff]/40 focus:shadow-[0_0_20px_rgba(0,240,255,0.1)]"
    }`;

  const primaryBtnClass = (accentFrom: string, accentTo: string, textColor: string) =>
    `w-full py-4 rounded-xl font-bold text-base tracking-wider uppercase transition-all active:scale-[0.97] min-h-[52px] border bg-gradient-to-r ${accentFrom} ${accentTo} border-${textColor.replace("#", "")}/30 disabled:opacity-40 disabled:cursor-not-allowed`;

  // ── Render ──────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#06020f] relative overflow-hidden flex flex-col items-center justify-center px-5 py-8">
      <BgOrbs />

      <div className="relative z-10 w-full max-w-sm">

        {/* ── Role Selection Screen ── */}
        {mode === "select" && (
          <div className="text-center">
            {/* Logo + Title */}
            <div className="mb-8">
              <div className="flex justify-center mb-4">
                <SvgShield size={56} color="#00f0ff" />
              </div>
              <div className="text-[10px] tracking-[0.5em] uppercase font-mono mb-2" style={{ color: "rgba(0,240,255,0.4)" }}>
                AUTHENTICATION REQUIRED
              </div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white mb-2">
                Apex Athlete
              </h1>
              <p className="text-white/25 text-sm font-mono">Select your access level to continue</p>
            </div>

            {/* Role Cards */}
            <div className="flex flex-col gap-3">
              <button
                onClick={() => switchMode("coach")}
                className="group relative w-full text-left p-5 rounded-2xl border border-[#00f0ff]/15 bg-[#06020f]/70 backdrop-blur-xl hover:border-[#00f0ff]/40 hover:bg-[#0a0418]/90 transition-all duration-300 min-h-[72px]"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(0,240,255,0.08)", border: "1px solid rgba(0,240,255,0.2)" }}>
                    <SvgCoach size={28} color="#00f0ff" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-bold text-base">Coach Login</div>
                    <div className="text-white/30 text-sm">Email + password</div>
                  </div>
                  <div className="text-[#00f0ff]/30 group-hover:text-[#00f0ff]/60 transition-colors text-lg font-mono shrink-0">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
                  </div>
                </div>
              </button>

              <button
                onClick={() => switchMode("parent")}
                className="group relative w-full text-left p-5 rounded-2xl border border-[#f59e0b]/15 bg-[#06020f]/70 backdrop-blur-xl hover:border-[#f59e0b]/40 hover:bg-[#0a0418]/90 transition-all duration-300 min-h-[72px]"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
                    <SvgParent size={28} color="#f59e0b" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-bold text-base">Parent Login</div>
                    <div className="text-white/30 text-sm">Email + verification code</div>
                  </div>
                  <div className="text-[#f59e0b]/30 group-hover:text-[#f59e0b]/60 transition-colors text-lg font-mono shrink-0">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
                  </div>
                </div>
              </button>

              <button
                onClick={() => switchMode("admin")}
                className="group relative w-full text-left p-5 rounded-2xl border border-[#a855f7]/15 bg-[#06020f]/70 backdrop-blur-xl hover:border-[#a855f7]/40 hover:bg-[#0a0418]/90 transition-all duration-300 min-h-[72px]"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.2)" }}>
                    <SvgKey size={28} color="#a855f7" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-bold text-base">Admin Access</div>
                    <div className="text-white/30 text-sm">Master PIN</div>
                  </div>
                  <div className="text-[#a855f7]/30 group-hover:text-[#a855f7]/60 transition-colors text-lg font-mono shrink-0">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
                  </div>
                </div>
              </button>
            </div>

            {/* Portal selector link */}
            <Link href="/apex-athlete/portal" className="inline-flex items-center gap-2 text-white/20 text-sm hover:text-white/40 transition-colors mt-8 min-h-[44px]">
              <SvgArrowLeft size={14} color="currentColor" />
              <span>Back to Portal Selector</span>
            </Link>
          </div>
        )}

        {/* ── Coach Login ── */}
        {mode === "coach" && (
          <div>
            <button onClick={() => switchMode("select")} className="flex items-center gap-2 text-white/30 hover:text-white/50 transition-colors mb-6 min-h-[44px]">
              <SvgArrowLeft size={14} color="currentColor" />
              <span className="text-sm">Back</span>
            </button>

            <div className="text-center mb-8">
              <div className="flex justify-center mb-3">
                <SvgCoach size={40} color="#00f0ff" />
              </div>
              <h2 className="text-2xl font-black text-white mb-1">Coach Sign In</h2>
              <p className="text-white/30 text-sm font-mono">Enter your credentials to access the coach portal</p>
            </div>

            <div className="flex flex-col gap-4">
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <SvgMail size={18} color="rgba(148,163,184,0.5)" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(""); }}
                  onKeyDown={e => e.key === "Enter" && handleCoachLogin()}
                  placeholder="coach@email.com"
                  autoComplete="email"
                  className={`${inputClass(!!error)} pl-11`}
                  autoFocus
                />
              </div>

              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <SvgLock size={18} color="rgba(148,163,184,0.5)" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(""); }}
                  onKeyDown={e => e.key === "Enter" && handleCoachLogin()}
                  placeholder="Password"
                  autoComplete="current-password"
                  className={`${inputClass(!!error)} pl-11`}
                />
              </div>

              {error && (
                <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-mono">
                  {error}
                </div>
              )}

              <button
                onClick={handleCoachLogin}
                disabled={loading}
                className="w-full py-4 rounded-xl font-bold text-base tracking-wider uppercase transition-all active:scale-[0.97] min-h-[52px] border bg-gradient-to-r from-[#00f0ff]/20 to-[#a855f7]/20 border-[#00f0ff]/30 text-[#00f0ff] hover:shadow-[0_0_30px_rgba(0,240,255,0.2)] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-[#00f0ff]/30 border-t-[#00f0ff] rounded-full animate-spin" />
                    Authenticating...
                  </span>
                ) : "Sign In"}
              </button>

              <div className="flex items-center justify-between mt-1">
                <button onClick={() => switchMode("register-coach")} className="flex items-center gap-1.5 text-[#00f0ff]/40 text-sm hover:text-[#00f0ff]/70 transition-colors min-h-[44px]">
                  <SvgUserPlus size={14} color="currentColor" />
                  <span>Create Account</span>
                </button>
                <button className="text-white/20 text-sm hover:text-white/40 transition-colors min-h-[44px] cursor-default" title="Contact your administrator to reset your password">
                  Forgot Password?
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Parent Login ── */}
        {mode === "parent" && (
          <div>
            <button onClick={() => switchMode("select")} className="flex items-center gap-2 text-white/30 hover:text-white/50 transition-colors mb-6 min-h-[44px]">
              <SvgArrowLeft size={14} color="currentColor" />
              <span className="text-sm">Back</span>
            </button>

            <div className="text-center mb-8">
              <div className="flex justify-center mb-3">
                <SvgParent size={40} color="#f59e0b" />
              </div>
              <h2 className="text-2xl font-black text-white mb-1">Parent Sign In</h2>
              <p className="text-white/30 text-sm font-mono">Use the verification code from your enrollment email</p>
            </div>

            <div className="flex flex-col gap-4">
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <SvgMail size={18} color="rgba(148,163,184,0.5)" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(""); }}
                  onKeyDown={e => e.key === "Enter" && handleParentLogin()}
                  placeholder="parent@email.com"
                  autoComplete="email"
                  className={`${inputClass(!!error)} pl-11`}
                  autoFocus
                />
              </div>

              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <SvgHash size={18} color="rgba(148,163,184,0.5)" />
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  value={code}
                  onChange={e => { setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }}
                  onKeyDown={e => e.key === "Enter" && handleParentLogin()}
                  placeholder="6-digit verification code"
                  className={`${inputClass(!!error)} pl-11 tracking-[0.3em]`}
                />
              </div>

              {error && (
                <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-mono">
                  {error}
                </div>
              )}

              <button
                onClick={handleParentLogin}
                disabled={loading}
                className="w-full py-4 rounded-xl font-bold text-base tracking-wider uppercase transition-all active:scale-[0.97] min-h-[52px] border bg-gradient-to-r from-[#f59e0b]/20 to-[#f97316]/20 border-[#f59e0b]/30 text-[#f59e0b] hover:shadow-[0_0_30px_rgba(245,158,11,0.2)] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-[#f59e0b]/30 border-t-[#f59e0b] rounded-full animate-spin" />
                    Verifying...
                  </span>
                ) : "Verify & Enter"}
              </button>

              <div className="flex items-center justify-between mt-1">
                <button onClick={() => switchMode("register-parent")} className="flex items-center gap-1.5 text-[#f59e0b]/40 text-sm hover:text-[#f59e0b]/70 transition-colors min-h-[44px]">
                  <SvgUserPlus size={14} color="currentColor" />
                  <span>Register Account</span>
                </button>
                <button className="text-white/20 text-sm hover:text-white/40 transition-colors min-h-[44px] cursor-default" title="Contact your coach for a new verification code">
                  Forgot Code?
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Admin PIN Login ── */}
        {mode === "admin" && (
          <div>
            <button onClick={() => switchMode("select")} className="flex items-center gap-2 text-white/30 hover:text-white/50 transition-colors mb-6 min-h-[44px]">
              <SvgArrowLeft size={14} color="currentColor" />
              <span className="text-sm">Back</span>
            </button>

            <div className="text-center mb-8">
              <div className="flex justify-center mb-3">
                <SvgKey size={40} color="#a855f7" />
              </div>
              <h2 className="text-2xl font-black text-white mb-1">Admin Access</h2>
              <p className="text-white/30 text-sm font-mono">Enter the master PIN to unlock admin controls</p>
            </div>

            <div className="flex flex-col gap-4">
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={e => { setPin(e.target.value.replace(/\D/g, "")); setError(""); }}
                onKeyDown={e => e.key === "Enter" && handlePinLogin()}
                placeholder="_ _ _ _"
                className={`${inputClass(!!error)} text-center text-2xl tracking-[0.5em]`}
                autoFocus
              />

              {error && (
                <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-mono">
                  {error}
                </div>
              )}

              <button
                onClick={handlePinLogin}
                disabled={loading}
                className="w-full py-4 rounded-xl font-bold text-base tracking-wider uppercase transition-all active:scale-[0.97] min-h-[52px] border bg-gradient-to-r from-[#a855f7]/20 to-[#7c3aed]/20 border-[#a855f7]/30 text-[#a855f7] hover:shadow-[0_0_30px_rgba(168,85,247,0.2)] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-[#a855f7]/30 border-t-[#a855f7] rounded-full animate-spin" />
                    Authenticating...
                  </span>
                ) : "Authenticate"}
              </button>
            </div>
          </div>
        )}

        {/* ── Coach Registration ── */}
        {mode === "register-coach" && (
          <div>
            <button onClick={() => switchMode("coach")} className="flex items-center gap-2 text-white/30 hover:text-white/50 transition-colors mb-6 min-h-[44px]">
              <SvgArrowLeft size={14} color="currentColor" />
              <span className="text-sm">Back to Sign In</span>
            </button>

            <div className="text-center mb-8">
              <div className="flex justify-center mb-3">
                <SvgUserPlus size={36} color="#00f0ff" />
              </div>
              <h2 className="text-2xl font-black text-white mb-1">Create Coach Account</h2>
              <p className="text-white/30 text-sm font-mono">Set up your coaching credentials</p>
            </div>

            <div className="flex flex-col gap-4">
              <input
                type="text"
                value={name}
                onChange={e => { setName(e.target.value); setError(""); }}
                placeholder="Full name"
                autoComplete="name"
                className={inputClass(!!error)}
                autoFocus
              />
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <SvgMail size={18} color="rgba(148,163,184,0.5)" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(""); }}
                  placeholder="coach@email.com"
                  autoComplete="email"
                  className={`${inputClass(!!error)} pl-11`}
                />
              </div>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <SvgLock size={18} color="rgba(148,163,184,0.5)" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(""); }}
                  placeholder="Create a password (4+ characters)"
                  autoComplete="new-password"
                  className={`${inputClass(!!error)} pl-11`}
                />
              </div>

              {error && (
                <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-mono">
                  {error}
                </div>
              )}
              {success && (
                <div className="px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-mono">
                  {success}
                </div>
              )}

              <button
                onClick={handleCoachRegister}
                disabled={loading}
                className="w-full py-4 rounded-xl font-bold text-base tracking-wider uppercase transition-all active:scale-[0.97] min-h-[52px] border bg-gradient-to-r from-[#00f0ff]/20 to-[#a855f7]/20 border-[#00f0ff]/30 text-[#00f0ff] hover:shadow-[0_0_30px_rgba(0,240,255,0.2)] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Create Account
              </button>
            </div>
          </div>
        )}

        {/* ── Parent Registration ── */}
        {mode === "register-parent" && (
          <div>
            <button onClick={() => switchMode("parent")} className="flex items-center gap-2 text-white/30 hover:text-white/50 transition-colors mb-6 min-h-[44px]">
              <SvgArrowLeft size={14} color="currentColor" />
              <span className="text-sm">Back to Sign In</span>
            </button>

            <div className="text-center mb-8">
              <div className="flex justify-center mb-3">
                <SvgUserPlus size={36} color="#f59e0b" />
              </div>
              <h2 className="text-2xl font-black text-white mb-1">Register Parent Account</h2>
              <p className="text-white/30 text-sm font-mono">Use the code provided by your coach</p>
            </div>

            <div className="flex flex-col gap-4">
              <input
                type="text"
                value={name}
                onChange={e => { setName(e.target.value); setError(""); }}
                placeholder="Full name"
                autoComplete="name"
                className={inputClass(!!error)}
                autoFocus
              />
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <SvgMail size={18} color="rgba(148,163,184,0.5)" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(""); }}
                  placeholder="parent@email.com"
                  autoComplete="email"
                  className={`${inputClass(!!error)} pl-11`}
                />
              </div>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <SvgHash size={18} color="rgba(148,163,184,0.5)" />
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  value={code}
                  onChange={e => { setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }}
                  placeholder="6-digit verification code"
                  className={`${inputClass(!!error)} pl-11 tracking-[0.3em]`}
                />
              </div>

              {error && (
                <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-mono">
                  {error}
                </div>
              )}
              {success && (
                <div className="px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-mono">
                  {success}
                </div>
              )}

              <button
                onClick={handleParentRegister}
                disabled={loading}
                className="w-full py-4 rounded-xl font-bold text-base tracking-wider uppercase transition-all active:scale-[0.97] min-h-[52px] border bg-gradient-to-r from-[#f59e0b]/20 to-[#f97316]/20 border-[#f59e0b]/30 text-[#f59e0b] hover:shadow-[0_0_30px_rgba(245,158,11,0.2)] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Register
              </button>
            </div>
          </div>
        )}

        {/* ── Footer ── */}
        <div className="text-center mt-10">
          <p className="text-white/[0.08] text-[10px] font-mono">
            APEX ATHLETE v7.0 // Secure Access Terminal
          </p>
        </div>
      </div>
    </div>
  );
}
