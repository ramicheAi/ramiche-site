// ── Firebase Configuration ──────────────────────────────────────────
// Apex Athlete — Firestore backend
//
// To configure: set these env vars in Vercel dashboard or .env.local:
//   NEXT_PUBLIC_FIREBASE_API_KEY
//   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
//   NEXT_PUBLIC_FIREBASE_PROJECT_ID
//   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
//   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
//   NEXT_PUBLIC_FIREBASE_APP_ID

import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  where,
  onSnapshot,
  writeBatch,
  serverTimestamp,
  Timestamp,
  type Unsubscribe as FirestoreUnsubscribe,
} from "firebase/firestore";

export type Unsubscribe = FirestoreUnsubscribe;

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Only initialize if config is present (graceful fallback to localStorage-only)
const hasConfig = !!firebaseConfig.apiKey && !!firebaseConfig.projectId;

let app: ReturnType<typeof initializeApp> | null = null;
let db: ReturnType<typeof getFirestore> | null = null;

if (hasConfig && typeof window !== "undefined") {
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  db = getFirestore(app);
}

export { db, hasConfig };

// ── Firestore Collections ──────────────────────────────────────────
// organizations/{orgId}
//   → rosters/{groupId}          (array of athletes)
//   → config/settings             (PIN, culture, team challenges)
//   → config/coaches              (array of coach profiles)
//   → schedules/{groupId}         (group schedule)
//   → audit/{date}                (daily audit entries)
//   → snapshots/{date}            (daily snapshots)
//   → feedback/{athleteId}        (coach feedback per athlete)
//   → wellness/{athleteId}        (wellness data per athlete)
//   → athletes/{athleteId}/journal (journal entries)
//   → athletes/{athleteId}/times  (logged times/PRs)
//   → athletes/{athleteId}/profile (onboarding profile lock)
//   → parents/{parentId}          (linked children IDs)

const ORG_ID = "saint-andrews-aquatics"; // will be dynamic later for multi-org

// ── Helper: path builders ──────────────────────────────────────────
function orgDoc(path: string) {
  if (!db) return null;
  return doc(db, `organizations/${ORG_ID}/${path}`);
}

function orgCollection(path: string) {
  if (!db) return null;
  return collection(db, `organizations/${ORG_ID}/${path}`);
}

// ── Generic CRUD ───────────────────────────────────────────────────

export async function fbGet<T>(path: string): Promise<T | null> {
  const ref = orgDoc(path);
  if (!ref) return null;
  try {
    const snap = await getDoc(ref);
    return snap.exists() ? (snap.data() as T) : null;
  } catch (e) {
    console.warn("[Firebase] read error:", path, e);
    return null;
  }
}

export async function fbSet(path: string, data: Record<string, unknown>): Promise<boolean> {
  const ref = orgDoc(path);
  if (!ref) return false;
  try {
    await setDoc(ref, { ...data, _updatedAt: serverTimestamp() }, { merge: true });
    return true;
  } catch (e) {
    console.warn("[Firebase] write error:", path, e);
    return false;
  }
}

export async function fbUpdate(path: string, data: Record<string, unknown>): Promise<boolean> {
  const ref = orgDoc(path);
  if (!ref) return false;
  try {
    await updateDoc(ref, { ...data, _updatedAt: serverTimestamp() });
    return true;
  } catch (e) {
    // Doc might not exist yet — fall back to set
    return fbSet(path, data);
  }
}

export function fbListen<T>(
  path: string,
  callback: (data: T | null) => void
): Unsubscribe | null {
  const ref = orgDoc(path);
  if (!ref) return null;
  return onSnapshot(ref, (snap) => {
    callback(snap.exists() ? (snap.data() as T) : null);
  }, (err) => {
    console.warn("[Firebase] listener error:", path, err);
  });
}

export async function fbListCollection<T>(path: string): Promise<T[]> {
  const col = orgCollection(path);
  if (!col) return [];
  try {
    const snap = await getDocs(col);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
  } catch (e) {
    console.warn("[Firebase] list error:", path, e);
    return [];
  }
}

// ── Apex-specific operations ───────────────────────────────────────

export async function fbSaveRoster(groupId: string, athletes: unknown[]) {
  return fbSet(`rosters/${groupId}`, { athletes, groupId });
}

export async function fbGetRoster(groupId: string) {
  return fbGet<{ athletes: unknown[]; groupId: string }>(`rosters/${groupId}`);
}

export async function fbSaveConfig(key: string, data: Record<string, unknown>) {
  return fbSet(`config/${key}`, data);
}

export async function fbGetConfig<T>(key: string) {
  return fbGet<T>(`config/${key}`);
}

export async function fbSaveSchedule(groupId: string, schedule: unknown) {
  return fbSet(`schedules/${groupId}`, { schedule, groupId });
}

export async function fbGetSchedule(groupId: string) {
  return fbGet<{ schedule: unknown; groupId: string }>(`schedules/${groupId}`);
}

export async function fbSaveAudit(date: string, entries: unknown[]) {
  return fbSet(`audit/${date}`, { entries, date });
}

export async function fbSaveSnapshot(date: string, snapshot: Record<string, unknown>) {
  return fbSet(`snapshots/${date}`, snapshot);
}

export async function fbSaveFeedback(athleteId: string, feedback: unknown[]) {
  return fbSet(`feedback/${athleteId}`, { feedback, athleteId });
}

export async function fbSaveWellness(athleteId: string, data: unknown) {
  return fbSet(`wellness/${athleteId}`, { data, athleteId });
}

// ── Batch operations ───────────────────────────────────────────────

export async function fbBatchSaveRosters(
  rosters: Record<string, unknown[]>
): Promise<boolean> {
  if (!db) return false;
  try {
    const batch = writeBatch(db);
    for (const [groupId, athletes] of Object.entries(rosters)) {
      const ref = doc(db, `organizations/${ORG_ID}/rosters/${groupId}`);
      batch.set(ref, { athletes, groupId, _updatedAt: serverTimestamp() }, { merge: true });
    }
    await batch.commit();
    return true;
  } catch (e) {
    console.warn("[Firebase] batch error:", e);
    return false;
  }
}

// ── Real-time listeners ────────────────────────────────────────────

export function fbListenRoster(
  groupId: string,
  callback: (athletes: unknown[] | null) => void
): Unsubscribe | null {
  return fbListen<{ athletes: unknown[] }>(`rosters/${groupId}`, (data) => {
    callback(data?.athletes ?? null);
  });
}

export function fbListenConfig<T>(
  key: string,
  callback: (data: T | null) => void
): Unsubscribe | null {
  return fbListen<T>(`config/${key}`, callback);
}
