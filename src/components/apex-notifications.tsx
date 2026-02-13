"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  requestNotificationPermission,
  getNotificationStatus,
  onForegroundMessage,
} from "@/lib/notifications";

/* ══════════════════════════════════════════════════════════════
   APEX ATHLETE — In-App Notification System + Push (FCM)
   Bell icon + badge + dropdown panel + push permission toggle
   Stored in localStorage key "apex-notifications"
   ══════════════════════════════════════════════════════════════ */

// ── Types ────────────────────────────────────────────────────

export type NotificationType =
  | "STREAK_WARNING"
  | "LEVEL_UP"
  | "QUEST_APPROVED"
  | "PRACTICE_REMINDER"
  | "WEEKLY_SUMMARY"
  | "MVP_ALERT"
  | "ATTRITION_RISK";

export type PortalType = "coach" | "athlete" | "parent";

export interface ApexNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  portal: PortalType;
  timestamp: number;
  read: boolean;
}

// ── Storage ──────────────────────────────────────────────────

const STORAGE_KEY = "apex-notifications";

function loadNotifications(): ApexNotification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveNotifications(notifs: ApexNotification[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifs));
  } catch {}
}

// ── Public Helper ────────────────────────────────────────────

export function addNotification(
  type: NotificationType,
  title: string,
  message: string,
  portal: PortalType
): ApexNotification {
  const notif: ApexNotification = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    title,
    message,
    portal,
    timestamp: Date.now(),
    read: false,
  };
  const existing = loadNotifications();
  // Deduplicate: don't add if same type+message exists within last 60 seconds
  const recent = existing.find(
    (n) => n.type === type && n.message === message && Date.now() - n.timestamp < 60_000
  );
  if (recent) return recent;
  const updated = [notif, ...existing].slice(0, 50); // keep last 50
  saveNotifications(updated);
  // Dispatch custom event so open panels update
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("apex-notification-added", { detail: notif }));
  }
  return notif;
}

// ── Notification Icon Map (SVG) ──────────────────────────────

function NotifIcon({ type }: { type: NotificationType }) {
  const s = 18;
  switch (type) {
    case "STREAK_WARNING":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 22c4-2 7-6 7-10 0-3-2-5-3-7-1 2-2 3-3 3 0-3-1-6-4-8-1 3-2 5-3 6-1 1-2 1-3 0 0 4 1 7 2 9-1 0-2-1-3-2 0 4 4 9 10 9z"
            stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="rgba(245,158,11,0.2)" />
        </svg>
      );
    case "LEVEL_UP":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            stroke="#a855f7" strokeWidth="1.8" strokeLinejoin="round" fill="rgba(168,85,247,0.25)" />
        </svg>
      );
    case "QUEST_APPROVED":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="9" stroke="#34d399" strokeWidth="1.8" fill="rgba(52,211,153,0.15)" />
          <path d="M9 12l2 2 4-4" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "PRACTICE_REMINDER":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="13" r="8" stroke="#00f0ff" strokeWidth="1.8" fill="rgba(0,240,255,0.1)" />
          <path d="M12 9v4l2 2" stroke="#00f0ff" strokeWidth="2" strokeLinecap="round" />
          <path d="M10 2h4" stroke="#00f0ff" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "WEEKLY_SUMMARY":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="4" width="18" height="16" rx="2" stroke="#60a5fa" strokeWidth="1.8" fill="rgba(96,165,250,0.1)" />
          <path d="M8 2v4M16 2v4M3 10h18" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "MVP_ALERT":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 2h8v9a4 4 0 01-8 0V2z" stroke="#f59e0b" strokeWidth="1.8" fill="rgba(245,158,11,0.15)" />
          <path d="M8 5H5a2 2 0 00-2 2v1a3 3 0 003 3h2" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M16 5h3a2 2 0 012 2v1a3 3 0 01-3 3h-2" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="12" y1="15" x2="12" y2="19" stroke="#f59e0b" strokeWidth="1.8" />
          <path d="M8 22h8M10 19h4" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "ATTRITION_RISK":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L2 20h20L12 2z" stroke="#ef4444" strokeWidth="1.8" strokeLinejoin="round" fill="rgba(239,68,68,0.15)" />
          <line x1="12" y1="9" x2="12" y2="14" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
          <circle cx="12" cy="17" r="1" fill="#ef4444" />
        </svg>
      );
    default:
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="9" stroke="#94a3b8" strokeWidth="1.8" fill="rgba(148,163,184,0.1)" />
          <path d="M12 8v4M12 16h.01" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
  }
}

// ── Time Formatting ──────────────────────────────────────────

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── CSS Keyframes (injected once) ────────────────────────────

const NOTIF_STYLES = (
  <style>{`
    @keyframes apex-notif-slide {
      from { opacity: 0; transform: translateY(-8px) scale(0.96); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes apex-notif-pop {
      0% { transform: scale(1); }
      50% { transform: scale(1.3); }
      100% { transform: scale(1); }
    }
    @keyframes apex-notif-ring {
      0%, 100% { transform: rotate(0deg); }
      10% { transform: rotate(14deg); }
      20% { transform: rotate(-14deg); }
      30% { transform: rotate(10deg); }
      40% { transform: rotate(-8deg); }
      50% { transform: rotate(4deg); }
      60% { transform: rotate(0deg); }
    }
    @keyframes apex-notif-item-in {
      from { opacity: 0; transform: translateX(-12px); }
      to { opacity: 1; transform: translateX(0); }
    }
    @keyframes apex-notif-glow {
      0%, 100% { box-shadow: 0 0 6px rgba(0,240,255,0.2); }
      50% { box-shadow: 0 0 16px rgba(0,240,255,0.5), 0 0 32px rgba(168,85,247,0.2); }
    }
  `}</style>
);

// ── Main Component ───────────────────────────────────────────

interface ApexNotificationBellProps {
  portal: PortalType;
  accentColor?: string;
}

export function ApexNotificationBell({ portal, accentColor = "#00f0ff" }: ApexNotificationBellProps) {
  const [notifications, setNotifications] = useState<ApexNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [hasNewPulse, setHasNewPulse] = useState(false);
  const [pushStatus, setPushStatus] = useState<"granted" | "denied" | "default" | "unsupported">("default");
  const [pushRequesting, setPushRequesting] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);

  // Load notifications for this portal
  const loadForPortal = useCallback(() => {
    const all = loadNotifications();
    return all.filter((n) => n.portal === portal);
  }, [portal]);

  useEffect(() => {
    setNotifications(loadForPortal());
    // Check push permission status
    setPushStatus(getNotificationStatus());
  }, [loadForPortal]);

  // Initialize foreground message listener
  useEffect(() => {
    let cleanup: (() => void) | null = null;
    onForegroundMessage((payload) => {
      if (payload.title) {
        addNotification("PRACTICE_REMINDER", payload.title, payload.body || "", portal);
      }
    }).then((unsub) => { cleanup = unsub; });
    return () => { cleanup?.(); };
  }, [portal]);

  const handleEnablePush = async () => {
    setPushRequesting(true);
    const token = await requestNotificationPermission();
    setPushStatus(getNotificationStatus());
    setPushRequesting(false);
    if (token) {
      // Store token in localStorage for the coach portal to use when sending
      try { localStorage.setItem("apex-fcm-token", token); } catch {}
    }
  };

  // Listen for new notifications
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as ApexNotification;
      if (detail.portal === portal) {
        setNotifications(loadForPortal());
        setHasNewPulse(true);
        setTimeout(() => setHasNewPulse(false), 1200);
      }
    };
    window.addEventListener("apex-notification-added", handler);
    return () => window.removeEventListener("apex-notification-added", handler);
  }, [portal, loadForPortal]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        bellRef.current &&
        !bellRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markRead = (id: string) => {
    const all = loadNotifications();
    const updated = all.map((n) => (n.id === id ? { ...n, read: true } : n));
    saveNotifications(updated);
    setNotifications(updated.filter((n) => n.portal === portal));
  };

  const markAllRead = () => {
    const all = loadNotifications();
    const updated = all.map((n) => (n.portal === portal ? { ...n, read: true } : n));
    saveNotifications(updated);
    setNotifications(updated.filter((n) => n.portal === portal));
  };

  const clearAll = () => {
    const all = loadNotifications();
    const updated = all.filter((n) => n.portal !== portal);
    saveNotifications(updated);
    setNotifications([]);
    setOpen(false);
  };

  return (
    <div className="relative" style={{ zIndex: 50 }}>
      {NOTIF_STYLES}
      {/* Bell Button */}
      <button
        ref={bellRef}
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg transition-all duration-200 hover:bg-white/5 active:scale-90"
        style={{
          animation: hasNewPulse ? "apex-notif-ring 0.8s ease-in-out" : undefined,
        }}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      >
        {/* Bell SVG */}
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ filter: unreadCount > 0 ? `drop-shadow(0 0 6px ${accentColor}60)` : undefined }}
        >
          <path
            d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9z"
            stroke={unreadCount > 0 ? accentColor : "rgba(255,255,255,0.4)"}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill={unreadCount > 0 ? `${accentColor}15` : "none"}
          />
          <path
            d="M13.73 21a2 2 0 01-3.46 0"
            stroke={unreadCount > 0 ? accentColor : "rgba(255,255,255,0.4)"}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
        {/* Badge */}
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 flex items-center justify-center text-[9px] font-black text-white rounded-full"
            style={{
              minWidth: 16,
              height: 16,
              padding: "0 4px",
              background: `linear-gradient(135deg, ${accentColor}, #a855f7)`,
              boxShadow: `0 0 8px ${accentColor}60, 0 0 16px ${accentColor}30`,
              animation: hasNewPulse ? "apex-notif-pop 0.4s ease-out" : undefined,
            }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full mt-2 w-[340px] max-h-[420px] rounded-xl overflow-hidden"
          style={{
            background: "linear-gradient(180deg, #0d0520 0%, #06020f 100%)",
            border: `1px solid ${accentColor}20`,
            boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 24px ${accentColor}10`,
            animation: "apex-notif-slide 0.2s ease-out",
          }}
        >
          {/* Panel Header */}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: `1px solid ${accentColor}15` }}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-black tracking-widest uppercase" style={{ color: accentColor }}>
                Notifications
              </span>
              {unreadCount > 0 && (
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: `${accentColor}20`, color: accentColor }}
                >
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-[10px] font-semibold px-2 py-1 rounded-md transition-all hover:bg-white/5"
                  style={{ color: `${accentColor}99` }}
                >
                  Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  className="text-[10px] font-semibold px-2 py-1 rounded-md text-white/20 transition-all hover:bg-white/5 hover:text-white/40"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Push Notification Toggle */}
          {pushStatus !== "unsupported" && pushStatus !== "granted" && (
            <div className="px-4 py-2.5" style={{ borderBottom: `1px solid ${accentColor}10`, background: `${accentColor}05` }}>
              <button
                onClick={handleEnablePush}
                disabled={pushRequesting || pushStatus === "denied"}
                className="w-full flex items-center gap-2.5 text-left transition-all hover:opacity-80 disabled:opacity-40"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="1.8" strokeLinecap="round">
                  <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9z" />
                  <path d="M13.73 21a2 2 0 01-3.46 0" />
                  <line x1="12" y1="2" x2="12" y2="4" strokeWidth="2" />
                </svg>
                <div>
                  <span className="text-[11px] font-bold" style={{ color: accentColor }}>
                    {pushRequesting ? "Requesting..." : pushStatus === "denied" ? "Push Blocked" : "Enable Push Notifications"}
                  </span>
                  <span className="text-[9px] text-white/20 block">
                    {pushStatus === "denied" ? "Allow in browser settings" : "Get alerts even when app is closed"}
                  </span>
                </div>
              </button>
            </div>
          )}
          {pushStatus === "granted" && (
            <div className="px-4 py-1.5 flex items-center gap-1.5" style={{ borderBottom: `1px solid ${accentColor}10` }}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
              <span className="text-[9px] font-mono text-emerald-400/60">PUSH ENABLED</span>
            </div>
          )}

          {/* Notification List */}
          <div className="overflow-y-auto max-h-[360px] scrollbar-thin">
            {notifications.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="mx-auto mb-3 opacity-20">
                  <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9z" stroke="white" strokeWidth="1.5" />
                  <path d="M13.73 21a2 2 0 01-3.46 0" stroke="white" strokeWidth="1.5" />
                </svg>
                <p className="text-white/20 text-xs font-mono">No notifications yet</p>
                <p className="text-white/10 text-[10px] mt-1">Alerts will appear here</p>
              </div>
            ) : (
              notifications.map((notif, i) => (
                <button
                  key={notif.id}
                  onClick={() => markRead(notif.id)}
                  className="w-full text-left px-4 py-3 flex items-start gap-3 transition-all hover:bg-white/[0.03] group"
                  style={{
                    borderBottom: "1px solid rgba(255,255,255,0.03)",
                    animation: `apex-notif-item-in 0.2s ease-out ${i * 0.05}s both`,
                    background: notif.read ? "transparent" : `${accentColor}05`,
                  }}
                >
                  {/* Icon */}
                  <div
                    className="flex-shrink-0 mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{
                      background: notif.read ? "rgba(255,255,255,0.03)" : `${accentColor}10`,
                      border: `1px solid ${notif.read ? "rgba(255,255,255,0.05)" : `${accentColor}20`}`,
                    }}
                  >
                    <NotifIcon type={notif.type} />
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-bold truncate ${notif.read ? "text-white/40" : "text-white/90"}`}
                      >
                        {notif.title}
                      </span>
                      {!notif.read && (
                        <span
                          className="flex-shrink-0 w-1.5 h-1.5 rounded-full"
                          style={{
                            background: accentColor,
                            boxShadow: `0 0 6px ${accentColor}80`,
                          }}
                        />
                      )}
                    </div>
                    <p className={`text-[11px] mt-0.5 leading-snug ${notif.read ? "text-white/20" : "text-white/50"}`}>
                      {notif.message}
                    </p>
                    <span className="text-[9px] text-white/15 font-mono mt-1 block">
                      {timeAgo(notif.timestamp)}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ApexNotificationBell;
