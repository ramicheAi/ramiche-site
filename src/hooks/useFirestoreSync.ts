// useFirestoreSync — debounced roster sync with status tracking
// Auto-syncs roster changes to Firestore, returns {syncing, lastSyncTime, error}

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  syncRosterToFirestore,
  subscribeToRoster,
  type RosterAthlete,
  type RosterDocument,
} from "@/lib/firestore-sync";
import type { Unsubscribe } from "@/lib/firebase";

const DEBOUNCE_MS = 2000;

export interface FirestoreSyncState {
  syncing: boolean;
  lastSyncTime: Date | null;
  error: string | null;
}

export function useFirestoreSync(
  teamId: string,
  athletes: RosterAthlete[],
  source: "coach" | "parent" = "coach"
) {
  const [state, setState] = useState<FirestoreSyncState>({
    syncing: false,
    lastSyncTime: null,
    error: null,
  });
  const [remoteData, setRemoteData] = useState<RosterDocument | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const athletesRef = useRef(athletes);

  useEffect(() => {
    athletesRef.current = athletes;
  }, [athletes]);

  const doSync = useCallback(async () => {
    setState((prev) => ({ ...prev, syncing: true, error: null }));
    const ok = await syncRosterToFirestore(
      teamId,
      athletesRef.current,
      source
    );
    if (ok) {
      setState({ syncing: false, lastSyncTime: new Date(), error: null });
    } else {
      setState((prev) => ({
        ...prev,
        syncing: false,
        error: "Sync failed — check connection",
      }));
    }
  }, [teamId, source]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(doSync, DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [athletes, doSync]);

  useEffect(() => {
    let unsub: Unsubscribe | null = null;
    unsub = subscribeToRoster(teamId, (data) => {
      setRemoteData(data);
    });
    return () => {
      if (unsub) unsub();
    };
  }, [teamId]);

  return { ...state, remoteData };
}
