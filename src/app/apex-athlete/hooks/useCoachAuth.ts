"use client";
import { useState, useMemo } from "react";
import { getSession, getCoachAccounts } from "../auth";
import type { AuthSession } from "../auth";

function getInitialUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  const session = getSession();
  return !!(session && (session.role === "coach" || session.role === "admin"));
}

function getCoachRole(): "head" | "assistant" | "guest" | "admin" {
  if (typeof window === "undefined") return "assistant";
  const session = getSession();
  if (!session) return "assistant";
  if (session.role === "admin") return "admin";
  const accounts = getCoachAccounts();
  const account = accounts.find(a => a.email.toLowerCase() === session.email.toLowerCase());
  return account?.role ?? "assistant";
}

function getCoachGroups(): string[] {
  if (typeof window === "undefined") return [];
  const session = getSession();
  if (!session) return [];
  if (session.role === "admin") return ["all"];
  const accounts = getCoachAccounts();
  const account = accounts.find(a => a.email.toLowerCase() === session.email.toLowerCase());
  return account?.groups ?? [];
}

export function useCoachAuth() {
  const [coachPin, setCoachPin] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [unlocked, setUnlocked] = useState(getInitialUnlocked);
  const coachRole = useMemo(() => getCoachRole(), []);
  const coachGroups = useMemo(() => getCoachGroups(), []);
  const isHeadCoach = coachRole === "head" || coachRole === "admin";
  const session = useMemo<AuthSession | null>(() => typeof window !== "undefined" ? getSession() : null, []);

  return {
    coachPin,
    setCoachPin,
    pinInput,
    setPinInput,
    unlocked,
    setUnlocked,
    coachRole,
    coachGroups,
    isHeadCoach,
    session,
  };
}
