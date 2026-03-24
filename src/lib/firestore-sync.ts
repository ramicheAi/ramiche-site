// Firestore roster sync — parent-coach real-time bridge
// Writes local roster to teams/{teamId}/roster, subscribes to remote changes

import {
  doc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  collection,
  getDocs,
} from "firebase/firestore";
import { db, hasConfig } from "@/lib/firebase";
import type { Unsubscribe } from "@/lib/firebase";

export interface RosterAthlete {
  id: string;
  name: string;
  group?: string;
  xp?: number;
  level?: number;
  [key: string]: unknown;
}

export interface RosterDocument {
  athletes: RosterAthlete[];
  updatedAt: unknown;
  source: "coach" | "parent";
}

function rosterDocRef(teamId: string) {
  if (!db) return null;
  return doc(db, `teams/${teamId}/roster/current`);
}

function rosterCollectionRef(teamId: string) {
  if (!db) return null;
  return collection(db, `teams/${teamId}/roster`);
}

export async function syncRosterToFirestore(
  teamId: string,
  athletes: RosterAthlete[],
  source: "coach" | "parent" = "coach"
): Promise<boolean> {
  if (!hasConfig || !db) return false;
  const ref = rosterDocRef(teamId);
  if (!ref) return false;
  try {
    await setDoc(
      ref,
      {
        athletes,
        updatedAt: serverTimestamp(),
        source,
      } satisfies RosterDocument,
      { merge: true }
    );
    return true;
  } catch (e) {
    console.warn("[FirestoreSync] write error:", e);
    return false;
  }
}

export function subscribeToRoster(
  teamId: string,
  callback: (data: RosterDocument | null) => void
): Unsubscribe | null {
  if (!hasConfig || !db) return null;
  const ref = rosterDocRef(teamId);
  if (!ref) return null;
  return onSnapshot(
    ref,
    (snap) => {
      callback(snap.exists() ? (snap.data() as RosterDocument) : null);
    },
    (err) => {
      console.warn("[FirestoreSync] listener error:", err);
      callback(null);
    }
  );
}

export async function listRosterDocuments(
  teamId: string
): Promise<RosterDocument[]> {
  if (!hasConfig || !db) return [];
  const col = rosterCollectionRef(teamId);
  if (!col) return [];
  try {
    const snap = await getDocs(col);
    return snap.docs.map((d) => d.data() as RosterDocument);
  } catch (e) {
    console.warn("[FirestoreSync] list error:", e);
    return [];
  }
}
