"use client";
import { useState } from "react";
import { getSession } from "../auth";

function getInitialUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  const session = getSession();
  return !!(session && (session.role === "coach" || session.role === "admin"));
}

export function useCoachAuth() {
  const [coachPin, setCoachPin] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [unlocked, setUnlocked] = useState(getInitialUnlocked);

  return {
    coachPin,
    setCoachPin,
    pinInput,
    setPinInput,
    unlocked,
    setUnlocked,
  };
}
