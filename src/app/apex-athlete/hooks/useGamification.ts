import { useState, useCallback, useRef } from "react";
import type { XpFloat } from "../coach/components/XpFloats";
import type { AchievementToast } from "../coach/components/AchievementToasts";

export function useGamification() {
  // ── level-up state ──
  const [levelUpName, setLevelUpName] = useState<string | null>(null);
  const [levelUpLevel, setLevelUpLevel] = useState<string>("");
  const [levelUpIcon, setLevelUpIcon] = useState<string>("");
  const [levelUpColor, setLevelUpColor] = useState<string>("");
  const [levelUpExiting, setLevelUpExiting] = useState(false);

  // ── XP floats ──
  const [xpFloats, setXpFloats] = useState<XpFloat[]>([]);

  // ── achievement toasts ──
  const [achieveToasts, setAchieveToasts] = useState<AchievementToast[]>([]);
  const achieveIdRef = useRef(0);

  // ── combo counter ──
  const [comboCount, setComboCount] = useState(0);
  const [comboExiting, setComboExiting] = useState(false);
  const comboTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const comboResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const incrementCombo = useCallback(() => {
    if (comboResetRef.current) clearTimeout(comboResetRef.current);
    if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
    setComboExiting(false);
    setComboCount(prev => {
      const next = prev + 1;
      if (next >= 3) {
        try {
          const ctx = new AudioContext();
          const baseFreq = 440 + Math.min(next * 60, 600);
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
          osc.frequency.value = baseFreq; osc.type = "triangle";
          gain.gain.setValueAtTime(0.06, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
          osc.start(); osc.stop(ctx.currentTime + 0.15);
          if (next >= 5) {
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.connect(gain2); gain2.connect(ctx.destination);
            osc2.frequency.value = baseFreq * 1.5; osc2.type = "sine";
            gain2.gain.setValueAtTime(0.03, ctx.currentTime + 0.05);
            gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
            osc2.start(ctx.currentTime + 0.05); osc2.stop(ctx.currentTime + 0.2);
          }
        } catch {}
        if (navigator.vibrate) navigator.vibrate(15);
      }
      return next;
    });
    comboResetRef.current = setTimeout(() => {
      setComboExiting(true);
      comboTimerRef.current = setTimeout(() => { setComboCount(0); setComboExiting(false); }, 400);
    }, 2000);
  }, []);

  const handleLevelUpDismiss = useCallback(() => {
    setLevelUpExiting(true);
    setTimeout(() => setLevelUpName(null), 500);
  }, []);

  const handleAchieveDismiss = useCallback((id: string) => {
    setAchieveToasts(prev => prev.map(x => x.id === id ? { ...x, exiting: true } : x));
  }, []);

  return {
    levelUpName, setLevelUpName,
    levelUpLevel, setLevelUpLevel,
    levelUpIcon, setLevelUpIcon,
    levelUpColor, setLevelUpColor,
    levelUpExiting, setLevelUpExiting,
    xpFloats, setXpFloats,
    achieveToasts, setAchieveToasts,
    achieveIdRef,
    comboCount, setComboCount,
    comboExiting, setComboExiting,
    comboTimerRef, comboResetRef,
    incrementCombo,
    handleLevelUpDismiss,
    handleAchieveDismiss,
  };
}
