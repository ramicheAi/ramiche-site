/* ══════════════════════════════════════════════════════════════
   METTLE — Authentication Module
   Manages sessions for coaches, parents, and admins.
   Firestore-backed PIN auth for athletes.
   ══════════════════════════════════════════════════════════════ */

import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { fbSignUp } from "./lib/firebase-auth";

const ORG_ID = "saint-andrews-aquatics";

export type AuthRole = "coach" | "parent" | "admin" | "athlete";

export interface AuthSession {
  role: AuthRole;
  name: string;
  email: string;
  group?: string;
  athleteId?: string; // specific to athlete login
  expiry: number; // Unix timestamp (ms)
}

export interface StoredCoachAccount {
  email: string;
  password: string; // SHA-256 hashed (prefixed $sha256$); legacy plaintext auto-migrated on login
  name: string;
  role: "head" | "assistant" | "guest";
  groups: string[];
  createdAt: number;
}

export interface StoredParentAccount {
  email: string;
  verificationCode: string; // 6-digit code issued during enrollment
  name: string;
  linkedChildren: string[]; // athlete IDs
  createdAt: number;
}

// ── Storage keys ────────────────────────────────────────────
const AUTH_SESSION_KEY = "apex-auth-session";
const COACH_ACCOUNTS_KEY = "apex-auth-coach-accounts";
const PARENT_ACCOUNTS_KEY = "apex-auth-parent-accounts";
const MASTER_PIN = process.env.NEXT_PUBLIC_MASTER_PIN || "2451";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// ── Helpers ─────────────────────────────────────────────────
function loadJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveJSON(key: string, val: unknown): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(val));
}

// ── Password Hashing (Web Crypto API) ───────────────────────
const HASH_PREFIX = "$sha256$";

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  return HASH_PREFIX + hashHex;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (stored.startsWith(HASH_PREFIX)) {
    const hashed = await hashPassword(password);
    return hashed === stored;
  }
  return password === stored;
}

function isHashed(stored: string): boolean {
  return stored.startsWith(HASH_PREFIX);
}

// ── Session Management ──────────────────────────────────────

export function getSession(): AuthSession | null {
  const session = loadJSON<AuthSession | null>(AUTH_SESSION_KEY, null);
  if (!session) return null;
  if (Date.now() > session.expiry) {
    clearSession();
    return null;
  }
  return session;
}

export function setSession(session: AuthSession): void {
  saveJSON(AUTH_SESSION_KEY, session);
  // Also set legacy keys so existing portal code stays compatible
  try {
    if (session.role === "coach" || session.role === "admin") {
      sessionStorage.setItem("apex-coach-auth", "1");
      localStorage.setItem("apex-coach-auth", Date.now().toString());
    }
  } catch {}
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(AUTH_SESSION_KEY);
  try {
    sessionStorage.removeItem("apex-coach-auth");
    localStorage.removeItem("apex-coach-auth");
  } catch {}
}

export function isAuthenticated(requiredRole?: AuthRole): boolean {
  const session = getSession();
  if (!session) return false;
  if (requiredRole === "coach") return session.role === "coach" || session.role === "admin";
  if (requiredRole === "parent") return session.role === "parent" || session.role === "admin";
  if (requiredRole) return session.role === requiredRole;
  return true;
}

// ── Coach Account CRUD ──────────────────────────────────────

export function getCoachAccounts(): StoredCoachAccount[] {
  return loadJSON<StoredCoachAccount[]>(COACH_ACCOUNTS_KEY, []);
}

export function saveCoachAccounts(accounts: StoredCoachAccount[]): void {
  saveJSON(COACH_ACCOUNTS_KEY, accounts);
}

export async function registerCoach(email: string, password: string, name: string, role: "head" | "assistant" | "guest" = "assistant", groups: string[] = ["all"]): Promise<{ success: boolean; error?: string }> {
  const accounts = getCoachAccounts();
  if (accounts.find(a => a.email.toLowerCase() === email.toLowerCase())) {
    return { success: false, error: "An account with this email already exists." };
  }
  const hashed = await hashPassword(password);
  accounts.push({ email: email.toLowerCase(), password: hashed, name, role, groups, createdAt: Date.now() });
  saveCoachAccounts(accounts);
  // Phase 2: Dual-write — create Firebase Auth account (non-blocking)
  fbSignUp(email.toLowerCase(), password).catch(() => {});
  return { success: true };
}

// ── Parent Account CRUD ─────────────────────────────────────

export function getParentAccounts(): StoredParentAccount[] {
  return loadJSON<StoredParentAccount[]>(PARENT_ACCOUNTS_KEY, []);
}

export function saveParentAccounts(accounts: StoredParentAccount[]): void {
  saveJSON(PARENT_ACCOUNTS_KEY, accounts);
}

export function registerParent(email: string, name: string, verificationCode: string, linkedChildren: string[] = []): { success: boolean; error?: string } {
  const accounts = getParentAccounts();
  if (accounts.find(a => a.email.toLowerCase() === email.toLowerCase())) {
    return { success: false, error: "An account with this email already exists." };
  }
  accounts.push({ email: email.toLowerCase(), verificationCode, name, linkedChildren, createdAt: Date.now() });
  saveParentAccounts(accounts);
  // Phase 3: Dual-write — create parent Firebase Auth account (non-blocking)
  fbSignUp(email.toLowerCase(), verificationCode).catch(() => {});
  return { success: true };
}

// ── Login Functions ─────────────────────────────────────────

export async function loginWithPin(pin: string): Promise<{ success: boolean; session?: AuthSession; error?: string }> {
  // 1. Check Master Admin PIN (skip if MASTER_PIN is empty/unset)
  if (MASTER_PIN && pin === MASTER_PIN) {
    const session: AuthSession = {
      role: "admin",
      name: "Admin",
      email: "admin@apexathlete.local",
      expiry: Date.now() + SESSION_DURATION_MS,
    };
    setSession(session);
    return { success: true, session };
  }

  // 2. Check stored custom Admin PIN
  try {
    const storedPinRaw = localStorage.getItem("apex-athlete-pin");
    if (storedPinRaw) {
      let storedPin: string;
      try { storedPin = JSON.parse(storedPinRaw); } catch { storedPin = storedPinRaw; }
      if (pin === storedPin) {
        const session: AuthSession = {
          role: "admin",
          name: "Admin",
          email: "admin@apexathlete.local",
          expiry: Date.now() + SESSION_DURATION_MS,
        };
        setSession(session);
        return { success: true, session };
      }
    }
  } catch {}

  // 3. Check Athlete PINs from Firestore (works on any device)
  if (db) {
    try {
      const rostersRef = collection(db, `organizations/${ORG_ID}/rosters`);
      const snap = await getDocs(rostersRef);
      for (const docSnap of snap.docs) {
        const data = docSnap.data();
        const athletes = data.athletes as any[];
        if (!athletes) continue;
        const athlete = athletes.find((a: any) => a.pin && a.pin === pin);
        if (athlete) {
          const session: AuthSession = {
            role: "athlete",
            name: athlete.name,
            email: `${athlete.id}@apexathlete.local`,
            athleteId: athlete.id,
            expiry: Date.now() + SESSION_DURATION_MS,
          };
          setSession(session);
          return { success: true, session };
        }
      }
    } catch (e) {
      console.warn("[Auth] Firestore PIN lookup failed:", e);
    }
  }

  // 4. Fallback: check localStorage roster (coach's device only)
  try {
    const storedRosterRaw = localStorage.getItem("apex-athlete-roster-v5");
    if (storedRosterRaw) {
      const roster = JSON.parse(storedRosterRaw);
      const athlete = roster.find((a: any) => a.pin && a.pin === pin);
      if (athlete) {
        const session: AuthSession = {
          role: "athlete",
          name: athlete.name,
          email: `${athlete.id}@apexathlete.local`,
          athleteId: athlete.id,
          expiry: Date.now() + SESSION_DURATION_MS,
        };
        setSession(session);
        return { success: true, session };
      }
    }
  } catch {}

  return { success: false, error: "Invalid PIN." };
}

export async function loginCoach(email: string, password: string): Promise<{ success: boolean; session?: AuthSession; error?: string }> {
  // Check for admin email
  if (email.toLowerCase() === "admin@apexathlete.local" && password === MASTER_PIN) {
    const session: AuthSession = {
      role: "admin",
      name: "Admin",
      email: "admin@apexathlete.local",
      expiry: Date.now() + SESSION_DURATION_MS,
    };
    setSession(session);
    return { success: true, session };
  }
  const accounts = getCoachAccounts();
  const account = accounts.find(a => a.email.toLowerCase() === email.toLowerCase());
  if (!account) return { success: false, error: "No account found with this email." };
  const passwordValid = await verifyPassword(password, account.password);
  if (!passwordValid) return { success: false, error: "Incorrect password." };
  // Migrate legacy plaintext password to hashed on successful login
  if (!isHashed(account.password)) {
    account.password = await hashPassword(password);
    saveCoachAccounts(accounts);
  }
  const session: AuthSession = {
    role: account.role === "head" ? "admin" : "coach",
    name: account.name,
    email: account.email,
    group: account.groups[0] || "all",
    expiry: Date.now() + SESSION_DURATION_MS,
  };
  setSession(session);
  // Phase 2: Dual-write — mirror to Firebase Auth (non-blocking, no behavior change)
  fbSignUp(account.email, password).catch(() => {});
  return { success: true, session };
}

export function loginParent(email: string, code: string): { success: boolean; session?: AuthSession; error?: string } {
  const accounts = getParentAccounts();
  const account = accounts.find(a => a.email.toLowerCase() === email.toLowerCase());
  if (!account) return { success: false, error: "No parent account found. Ask your coach to enroll you." };
  if (account.verificationCode !== code) return { success: false, error: "Incorrect verification code." };
  const session: AuthSession = {
    role: "parent",
    name: account.name,
    email: account.email,
    expiry: Date.now() + SESSION_DURATION_MS,
  };
  setSession(session);
  // Phase 3: Dual-write — mirror parent to Firebase Auth (non-blocking)
  fbSignUp(account.email, code).catch(() => {});
  return { success: true, session };
}

// ── Redirect helpers ────────────────────────────────────────

export function getRedirectForRole(role: AuthRole): string {
  switch (role) {
    case "admin": return "/apex-athlete/coach";
    case "coach": return "/apex-athlete/coach";
    case "parent": return "/apex-athlete/parent";
    case "athlete": return "/apex-athlete/athlete";
    default: return "/apex-athlete/portal";
  }
}

// ── Roster loader (Firestore, works on any device) ──────────
export async function loadRosterFromFirestore(): Promise<any[]> {
  if (!db) return [];
  try {
    const rostersRef = collection(db, `organizations/${ORG_ID}/rosters`);
    const snap = await getDocs(rostersRef);
    const seen = new Map<string, any>();
    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      if (data.athletes && Array.isArray(data.athletes)) {
        for (const a of data.athletes) {
          if (a.id && !seen.has(a.id)) seen.set(a.id, a);
        }
      }
    }
    return Array.from(seen.values());
  } catch (e) {
    console.warn("[Auth] Firestore roster load failed:", e);
    return [];
  }
}

export { MASTER_PIN, AUTH_SESSION_KEY };
