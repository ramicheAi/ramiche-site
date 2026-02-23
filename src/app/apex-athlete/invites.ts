/* ══════════════════════════════════════════════════════════════
   APEX ATHLETE — Invite System
   Generates shareable invite links for coach/athlete/parent roles.
   Stored in localStorage + synced to Firestore.
   ══════════════════════════════════════════════════════════════ */

import { fbSet, fbGet } from "@/lib/firebase";

export type InviteRole = "coach" | "athlete" | "parent";

export interface Invite {
  token: string;
  role: InviteRole;
  label: string; // e.g. "Saint Andrew's Coaches" or group name
  createdAt: number;
  expiresAt: number; // Unix ms, 0 = never
  maxUses: number; // 0 = unlimited
  useCount: number;
  active: boolean;
}

const INVITES_KEY = "apex-invites";

// ── Token generation ────────────────────────────────────────

function generateToken(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let token = "";
  const array = new Uint8Array(12);
  crypto.getRandomValues(array);
  for (let i = 0; i < 12; i++) {
    token += chars[array[i] % chars.length];
  }
  return token;
}

// ── Storage ─────────────────────────────────────────────────

function loadInvites(): Invite[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(INVITES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveInvites(invites: Invite[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(INVITES_KEY, JSON.stringify(invites));
  // Async sync to Firestore (fire-and-forget)
  fbSet("config/invites", { invites }).catch(() => {});
}

// ── CRUD ────────────────────────────────────────────────────

export function createInvite(
  role: InviteRole,
  label: string,
  options?: { maxUses?: number; expiresInDays?: number }
): Invite {
  const invites = loadInvites();
  const invite: Invite = {
    token: generateToken(),
    role,
    label,
    createdAt: Date.now(),
    expiresAt: options?.expiresInDays
      ? Date.now() + options.expiresInDays * 86400000
      : 0,
    maxUses: options?.maxUses || 0,
    useCount: 0,
    active: true,
  };
  invites.push(invite);
  saveInvites(invites);
  return invite;
}

export function getInvites(): Invite[] {
  return loadInvites();
}

export function getActiveInvites(): Invite[] {
  return loadInvites().filter((inv) => {
    if (!inv.active) return false;
    if (inv.expiresAt > 0 && Date.now() > inv.expiresAt) return false;
    if (inv.maxUses > 0 && inv.useCount >= inv.maxUses) return false;
    return true;
  });
}

export function deactivateInvite(token: string): void {
  const invites = loadInvites();
  const inv = invites.find((i) => i.token === token);
  if (inv) {
    inv.active = false;
    saveInvites(invites);
  }
}

export function recordInviteUse(token: string): void {
  const invites = loadInvites();
  const inv = invites.find((i) => i.token === token);
  if (inv) {
    inv.useCount++;
    saveInvites(invites);
  }
}

// ── Validation (used by join page) ──────────────────────────

export async function validateInviteToken(
  token: string
): Promise<{ valid: boolean; invite?: Invite; error?: string }> {
  // Check localStorage first
  let invites = loadInvites();
  let invite = invites.find((i) => i.token === token);

  // If not in localStorage, try Firestore
  if (!invite) {
    const fbData = await fbGet<{ invites: Invite[] }>("config/invites");
    if (fbData?.invites) {
      invite = fbData.invites.find((i) => i.token === token);
    }
  }

  if (!invite) return { valid: false, error: "Invalid invite link." };
  if (!invite.active) return { valid: false, error: "This invite has been deactivated." };
  if (invite.expiresAt > 0 && Date.now() > invite.expiresAt)
    return { valid: false, error: "This invite has expired." };
  if (invite.maxUses > 0 && invite.useCount >= invite.maxUses)
    return { valid: false, error: "This invite has reached its usage limit." };

  return { valid: true, invite };
}

// ── URL builder ─────────────────────────────────────────────

export function getInviteUrl(token: string): string {
  if (typeof window === "undefined") return "";
  const base = window.location.origin;
  return `${base}/apex-athlete/join?token=${token}`;
}
