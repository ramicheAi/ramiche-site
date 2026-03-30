"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSession, type AuthSession } from "../auth";
/* ══════════════════════════════════════════════════════════════
   METTLE — Athlete Onboarding Flow
   Multi-step guided wizard for new athletes:
   Step 1: Welcome + PIN verification
   Step 2: Profile confirmation (name, group, age)
   Step 3: Goal setting (season goals, target events)
   Step 4: How it works (XP, checkpoints, quests)
   Step 5: Ready to go → redirect to athlete portal
   ══════════════════════════════════════════════════════════════ */

const SWIM_EVENTS = [
  "50 Free", "100 Free", "200 Free", "500 Free", "1000 Free", "1650 Free",
  "100 Back", "200 Back", "100 Breast", "200 Breast",
  "100 Fly", "200 Fly", "200 IM", "400 IM",
];

const SEASON_GOALS = [
  { id: "pr", label: "Drop time in my main events", icon: "⏱️" },
  { id: "qualify", label: "Qualify for a championship meet", icon: "🏆" },
  { id: "consistency", label: "Never miss a practice", icon: "🔥" },
  { id: "technique", label: "Improve my technique", icon: "🎯" },
  { id: "leadership", label: "Be a team leader", icon: "⭐" },
  { id: "fun", label: "Have fun & stay healthy", icon: "💪" },
];

export default function OnboardPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [loading, setLoading] = useState(false);
  const [session, setSessionState] = useState<AuthSession | null>(null);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [targetEvents, setTargetEvents] = useState<string[]>([]);
  const [nickname, setNickname] = useState("");

  // Check if already logged in
  useEffect(() => {
    const s = getSession();
    if (s && s.role === "athlete") {
      setSessionState(s);
      setStep(1); // skip PIN, go to profile
    }
  }, []);

  // Step 0: PIN Login
  const handlePinSubmit = async () => {
    if (pin.length < 4) return;
    setLoading(true);
    setPinError("");
    try {
      const { loginWithPin } = await import("../auth");
      const result = await loginWithPin(pin);
      if (result.success && result.session) {
        setSessionState(result.session);
        setStep(1);
      } else {
        setPinError(result.error || "Invalid PIN");
      }
    } catch {
      setPinError("Something went wrong");
    }
    setLoading(false);
  };

  const toggleGoal = (id: string) => {
    setSelectedGoals(prev =>
      prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]
    );
  };

  const toggleEvent = (ev: string) => {
    setTargetEvents(prev =>
      prev.includes(ev) ? prev.filter(e => e !== ev) : prev.length < 4 ? [...prev, ev] : prev
    );
  };

  const finishOnboarding = () => {
    // Save onboarding data to localStorage
    if (typeof window !== "undefined" && session) {
      const onboardData = {
        athleteId: session.athleteId,
        nickname,
        goals: selectedGoals,
        targetEvents,
        completedAt: new Date().toISOString(),
      };
      localStorage.setItem(
        `mettle-onboard-${session.athleteId}`,
        JSON.stringify(onboardData)
      );
    }
    router.push("/apex-athlete/athlete");
  };

  return (
    <div className="min-h-screen bg-[#06020f] text-white overflow-hidden">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-600/5 rounded-full blur-[120px]" />
      </div>

      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-white/5">
        <div
          className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-500"
          style={{ width: `${((step + 1) / 5) * 100}%` }}
        />
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
        {/* Step 0: PIN Entry */}
        {step === 0 && (
          <div className="w-full max-w-md text-center space-y-8 animate-in fade-in">
            <div>
              <div className="text-5xl mb-4">🏊</div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                Welcome to METTLE
              </h1>
              <p className="text-white/40 mt-2 text-sm">
                Enter your athlete PIN to get started
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex justify-center gap-3">
                {[0, 1, 2, 3].map(i => (
                  <div
                    key={i}
                    className={`w-14 h-14 rounded-xl border-2 flex items-center justify-center text-2xl font-mono transition-all ${
                      pin[i]
                        ? "border-purple-500 bg-purple-500/10 text-white"
                        : "border-white/10 bg-white/5 text-white/20"
                    }`}
                  >
                    {pin[i] ? "●" : ""}
                  </div>
                ))}
              </div>

              <input
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={pin}
                onChange={e => {
                  const v = e.target.value.slice(0, 4);
                  setPin(v);
                  setPinError("");
                }}
                onKeyDown={e => e.key === "Enter" && handlePinSubmit()}
                className="opacity-0 absolute w-0 h-0"
                autoFocus
              />

              {/* Number pad */}
              <div className="grid grid-cols-3 gap-3 max-w-[240px] mx-auto">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, "⌫"].map((n, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      if (n === "⌫") setPin(prev => prev.slice(0, -1));
                      else if (n !== null && pin.length < 4) setPin(prev => prev + n);
                    }}
                    disabled={n === null}
                    className={`h-14 rounded-xl text-xl font-mono transition-all ${
                      n === null
                        ? "invisible"
                        : "bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>

              {pinError && (
                <p className="text-red-400 text-sm">{pinError}</p>
              )}

              <button
                onClick={handlePinSubmit}
                disabled={pin.length < 4 || loading}
                className="w-full py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-30 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500"
              >
                {loading ? "Checking..." : "Continue →"}
              </button>
            </div>

            <p className="text-white/20 text-xs">
              Don&apos;t have a PIN? Ask your coach to set one up for you.
            </p>
          </div>
        )}

        {/* Step 1: Profile Confirmation */}
        {step === 1 && session && (
          <div className="w-full max-w-md text-center space-y-8 animate-in fade-in">
            <div>
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 mx-auto flex items-center justify-center text-3xl mb-4">
                {session.name.charAt(0).toUpperCase()}
              </div>
              <h1 className="text-2xl font-bold">{session.name}</h1>
              <p className="text-white/40 text-sm mt-1">Let&apos;s set up your profile</p>
            </div>

            <div className="space-y-4 text-left">
              <div>
                <label className="text-xs text-white/40 uppercase tracking-wider mb-1 block">Nickname (optional)</label>
                <input
                  type="text"
                  value={nickname}
                  onChange={e => setNickname(e.target.value)}
                  placeholder="What your teammates call you"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm placeholder:text-white/20 focus:border-purple-500/50 focus:outline-none transition-colors"
                />
              </div>

              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <div className="flex items-center justify-between">
                  <span className="text-white/40 text-xs uppercase tracking-wider">Level</span>
                  <span className="text-sm font-mono text-purple-400">🌱 Rookie</span>
                </div>
                <div className="mt-2 h-2 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full w-0 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full" />
                </div>
                <p className="text-white/20 text-xs mt-1">0 / 300 XP to Contender</p>
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              className="w-full py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 transition-all"
            >
              Next: Set Your Goals →
            </button>
          </div>
        )}

        {/* Step 2: Goal Setting */}
        {step === 2 && (
          <div className="w-full max-w-lg text-center space-y-6 animate-in fade-in">
            <div>
              <h1 className="text-2xl font-bold">What are you training for?</h1>
              <p className="text-white/40 text-sm mt-1">Pick as many as you want</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {SEASON_GOALS.map(goal => (
                <button
                  key={goal.id}
                  onClick={() => toggleGoal(goal.id)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    selectedGoals.includes(goal.id)
                      ? "border-purple-500 bg-purple-500/10"
                      : "border-white/10 bg-white/5 hover:border-white/20"
                  }`}
                >
                  <div className="text-2xl mb-2">{goal.icon}</div>
                  <div className="text-sm font-medium">{goal.label}</div>
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-3 rounded-xl text-sm border border-white/10 hover:bg-white/5 transition-all"
              >
                ← Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex-1 py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 transition-all"
              >
                Next: Pick Events →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Target Events */}
        {step === 3 && (
          <div className="w-full max-w-lg text-center space-y-6 animate-in fade-in">
            <div>
              <h1 className="text-2xl font-bold">Your Focus Events</h1>
              <p className="text-white/40 text-sm mt-1">Pick up to 4 events to track</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {SWIM_EVENTS.map(ev => (
                <button
                  key={ev}
                  onClick={() => toggleEvent(ev)}
                  className={`px-4 py-3 rounded-lg border text-sm font-mono transition-all ${
                    targetEvents.includes(ev)
                      ? "border-blue-500 bg-blue-500/10 text-blue-300"
                      : "border-white/10 bg-white/5 hover:border-white/20 text-white/60"
                  }`}
                >
                  {ev}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="px-6 py-3 rounded-xl text-sm border border-white/10 hover:bg-white/5 transition-all"
              >
                ← Back
              </button>
              <button
                onClick={() => setStep(4)}
                className="flex-1 py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 transition-all"
              >
                Next: How It Works →
              </button>
            </div>
          </div>
        )}

        {/* Step 4: How It Works */}
        {step === 4 && (
          <div className="w-full max-w-lg text-center space-y-6 animate-in fade-in">
            <div>
              <h1 className="text-2xl font-bold">How METTLE Works</h1>
              <p className="text-white/40 text-sm mt-1">Earn XP. Level up. Get recognized.</p>
            </div>

            <div className="space-y-4 text-left">
              <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center text-xl shrink-0">⚡</div>
                  <div>
                    <h3 className="font-semibold text-sm">Earn XP Every Practice</h3>
                    <p className="text-white/40 text-xs mt-1">
                      Show up, check in with your coach, and earn XP for effort — not just speed. Up to 150 XP per day.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center text-xl shrink-0">🔥</div>
                  <div>
                    <h3 className="font-semibold text-sm">Build Streaks</h3>
                    <p className="text-white/40 text-xs mt-1">
                      Consecutive practices build your streak multiplier. More consistency = faster leveling.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-gold-500/20 flex items-center justify-center text-xl shrink-0" style={{ backgroundColor: "rgba(245,158,11,0.2)" }}>🏆</div>
                  <div>
                    <h3 className="font-semibold text-sm">Complete Quests</h3>
                    <p className="text-white/40 text-xs mt-1">
                      Special challenges from your coach — technique labs, leadership tasks, recovery rituals. Bonus XP.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center text-xl shrink-0">📈</div>
                  <div>
                    <h3 className="font-semibold text-sm">Level Up</h3>
                    <p className="text-white/40 text-xs mt-1">
                      Rookie → Contender → Warrior → Elite → Captain → Legend. Your level shows your commitment.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(3)}
                className="px-6 py-3 rounded-xl text-sm border border-white/10 hover:bg-white/5 transition-all"
              >
                ← Back
              </button>
              <button
                onClick={finishOnboarding}
                className="flex-1 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 transition-all"
              >
                Let&apos;s Go! 🚀
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
