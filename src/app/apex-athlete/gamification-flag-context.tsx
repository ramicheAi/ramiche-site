"use client";

import { createContext, useContext } from "react";

const GamificationFlagContext = createContext(false);

export function GamificationFlagProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <GamificationFlagContext.Provider value={enabled}>
      {children}
    </GamificationFlagContext.Provider>
  );
}

export function useGamificationFlag() {
  return useContext(GamificationFlagContext);
}
