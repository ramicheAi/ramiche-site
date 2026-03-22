/* ══════════════════════════════════════════════════════════════
   METTLE — Firebase Auth Wrapper (Phase 1: Additive Only)

   This module wraps Firebase Authentication SDK.
   It does NOT modify existing localStorage auth.
   It exists alongside the current auth.ts as a future replacement.
   ══════════════════════════════════════════════════════════════ */

import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  signInAnonymously,
  type Auth,
  type User,
  type Unsubscribe,
} from "firebase/auth";
import { app } from "@/lib/firebase";

let auth: Auth | null = null;

function getFirebaseAuth(): Auth | null {
  if (!app) return null;
  if (!auth) {
    auth = getAuth(app);
  }
  return auth;
}

// ── Sign Up (email/password) ──────────────────────────────────
export async function fbSignUp(
  email: string,
  password: string
): Promise<{ success: boolean; uid?: string; error?: string }> {
  const a = getFirebaseAuth();
  if (!a) return { success: false, error: "Firebase not configured" };
  try {
    const cred = await createUserWithEmailAndPassword(a, email, password);
    return { success: true, uid: cred.user.uid };
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string };
    if (err.code === "auth/email-already-in-use") {
      return fbSignIn(email, password);
    }
    return { success: false, error: err.message ?? "Sign up failed" };
  }
}

// ── Sign In (email/password) ──────────────────────────────────
export async function fbSignIn(
  email: string,
  password: string
): Promise<{ success: boolean; uid?: string; error?: string }> {
  const a = getFirebaseAuth();
  if (!a) return { success: false, error: "Firebase not configured" };
  try {
    const cred = await signInWithEmailAndPassword(a, email, password);
    return { success: true, uid: cred.user.uid };
  } catch (e: unknown) {
    const err = e as { message?: string };
    return { success: false, error: err.message ?? "Sign in failed" };
  }
}

// ── Sign In Anonymously (for athlete PIN sessions) ────────────
export async function fbSignInAnonymous(): Promise<{
  success: boolean;
  uid?: string;
  error?: string;
}> {
  const a = getFirebaseAuth();
  if (!a) return { success: false, error: "Firebase not configured" };
  try {
    const cred = await signInAnonymously(a);
    return { success: true, uid: cred.user.uid };
  } catch (e: unknown) {
    const err = e as { message?: string };
    return { success: false, error: err.message ?? "Anonymous sign in failed" };
  }
}

// ── Sign Out ──────────────────────────────────────────────────
export async function fbSignOut(): Promise<boolean> {
  const a = getFirebaseAuth();
  if (!a) return false;
  try {
    await signOut(a);
    return true;
  } catch {
    return false;
  }
}

// ── Current User ──────────────────────────────────────────────
export function fbGetCurrentUser(): User | null {
  const a = getFirebaseAuth();
  if (!a) return null;
  return a.currentUser;
}

// ── Auth State Listener ───────────────────────────────────────
export function fbOnAuthStateChanged(
  callback: (user: User | null) => void
): Unsubscribe | null {
  const a = getFirebaseAuth();
  if (!a) return null;
  return onAuthStateChanged(a, callback);
}
