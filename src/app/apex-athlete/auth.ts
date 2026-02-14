/* ══════════════════════════════════════════════════════════════
   APEX ATHLETE — Authentication Module
   Manages sessions for coaches, parents, and admins.
   localStorage-based (Firestore-ready structure).
   ══════════════════════════════════════════════════════════════ */

export type AuthRole = "coach" | "parent" | "admin";

export interface AuthSession {
  role: AuthRole;
  name: string;
  email: string;
  group?: string;
  expiry: number; // Unix timestamp (ms)
}

export interface StoredCoachAccount {
  email: string;
  password: string; // plaintext for localStorage demo; hash in production
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
const MASTER_PIN = "1234";
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

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

export function registerCoach(email: string, password: string, name: string, role: "head" | "assistant" | "guest" = "assistant", groups: string[] = ["all"]): { success: boolean; error?: string } {
  const accounts = getCoachAccounts();
  if (accounts.find(a => a.email.toLowerCase() === email.toLowerCase())) {
    return { success: false, error: "An account with this email already exists." };
  }
  accounts.push({ email: email.toLowerCase(), password, name, role, groups, createdAt: Date.now() });
  saveCoachAccounts(accounts);
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
  return { success: true };
}

// ── Login Functions ─────────────────────────────────────────

export function loginWithPin(pin: string): { success: boolean; session?: AuthSession; error?: string } {
  if (pin === MASTER_PIN) {
    const session: AuthSession = {
      role: "admin",
      name: "Admin",
      email: "admin@apexathlete.local",
      expiry: Date.now() + SESSION_DURATION_MS,
    };
    setSession(session);
    return { success: true, session };
  }
  // Also check the stored custom PIN
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
  return { success: false, error: "Invalid PIN." };
}

export function loginCoach(email: string, password: string): { success: boolean; session?: AuthSession; error?: string } {
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
  if (account.password !== password) return { success: false, error: "Incorrect password." };
  const session: AuthSession = {
    role: account.role === "head" ? "admin" : "coach",
    name: account.name,
    email: account.email,
    group: account.groups[0] || "all",
    expiry: Date.now() + SESSION_DURATION_MS,
  };
  setSession(session);
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
  return { success: true, session };
}

// ── Redirect helpers ────────────────────────────────────────

export function getRedirectForRole(role: AuthRole): string {
  switch (role) {
    case "admin": return "/apex-athlete";
    case "coach": return "/apex-athlete/coach";
    case "parent": return "/apex-athlete/parent";
    default: return "/apex-athlete/login";
  }
}

export { MASTER_PIN, AUTH_SESSION_KEY };
