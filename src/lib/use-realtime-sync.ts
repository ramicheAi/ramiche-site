"use client";

import { useEffect, useRef } from "react";
import { syncListenRoster, syncListenConfig } from "./apex-sync";

/**
 * Hook: subscribe to real-time Firestore roster updates for a group.
 * When the coach updates the roster, this fires the callback with fresh data.
 */
export function useRealtimeRoster(
  groupId: string | null,
  localStorageKey: string,
  onUpdate: (athletes: unknown[]) => void
) {
  const callbackRef = useRef(onUpdate);

  useEffect(() => {
    callbackRef.current = onUpdate;
  });

  useEffect(() => {
    if (!groupId) return;
    const unsub = syncListenRoster(localStorageKey, groupId, (athletes) => {
      callbackRef.current(athletes);
    });
    return () => {
      if (unsub) unsub();
    };
  }, [groupId, localStorageKey]);
}

/**
 * Hook: subscribe to real-time Firestore config updates.
 * Fires callback whenever the config document changes.
 */
export function useRealtimeConfig<T>(
  configKey: string | null,
  localStorageKey: string,
  onUpdate: (data: T) => void
) {
  const callbackRef = useRef(onUpdate);

  useEffect(() => {
    callbackRef.current = onUpdate;
  });

  useEffect(() => {
    if (!configKey) return;
    const unsub = syncListenConfig<T>(localStorageKey, configKey, (data) => {
      callbackRef.current(data);
    });
    return () => {
      if (unsub) unsub();
    };
  }, [configKey, localStorageKey]);
}
