"use client";

import React, { useState } from "react";

interface PinAuthScreenProps {
  coaches: { pin: string }[];
  coachPin: string;
  onUnlock: (pin: string) => void;
}

export default function PinAuthScreen({ coaches, coachPin, onUnlock }: PinAuthScreenProps) {
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);

  const tryUnlock = () => {
    if (pinInput === coachPin) { onUnlock(pinInput); return; }
    const matchedCoach = coaches.find(c => c.pin === pinInput);
    if (matchedCoach) { onUnlock(pinInput); return; }
    setPinError(true);
  };

  return (
    <div className="min-h-screen bg-[#06020f] relative overflow-hidden">
      <style>{`
        @keyframes coachPinGlow {
          0%, 100% { box-shadow: 0 0 40px rgba(245,158,11,0.15), 0 0 80px rgba(245,158,11,0.05); }
          50% { box-shadow: 0 0 60px rgba(245,158,11,0.25), 0 0 120px rgba(245,158,11,0.1); }
        }
        @keyframes coachBtnPulse {
          0%, 100% { box-shadow: 0 0 20px rgba(245,158,11,0.3), 0 0 40px rgba(245,158,11,0.1); transform: scale(1); }
          50% { box-shadow: 0 0 40px rgba(245,158,11,0.5), 0 0 80px rgba(245,158,11,0.2); transform: scale(1.02); }
        }
        @keyframes coachLogoFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
      `}</style>
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-[radial-gradient(ellipse,rgba(245,158,11,0.08)_0%,transparent_70%)]" />
      </div>

      <div className="relative z-10 min-h-screen flex flex-col lg:flex-row">
        {/* Left panel — branding */}
        <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] flex-col items-center justify-center p-12 xl:p-20 relative">
          <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse at 60% 40%, rgba(245,158,11,0.08) 0%, transparent 70%)'}} />
          <div className="relative z-10 flex flex-col items-center max-w-lg">
            <div className="flex flex-col items-center">
              <img src="/mettle-brand/v5/mettle-icon.svg" alt="METTLE" className="w-36 xl:w-44 2xl:w-52 h-36 xl:h-44 2xl:h-52 mb-6" style={{animation:'coachLogoFloat 4s ease-in-out infinite',filter:'drop-shadow(0 0 40px rgba(245,158,11,0.3))'}} />
              <h1 className="text-6xl xl:text-7xl 2xl:text-8xl font-black mb-6 tracking-tight" style={{background:'linear-gradient(135deg, #f59e0b, #fbbf24, #f59e0b)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>METTLE</h1>
            </div>
            <p className="text-white/50 text-xl xl:text-2xl leading-relaxed max-w-md text-center">Your journey. Your legacy.</p>
          </div>
        </div>
        {/* Right panel — PIN form */}
        <div className="flex-1 flex items-center justify-center p-6 lg:p-16 xl:p-20">
          <div className="w-full max-w-md">
            {/* Mobile-only branding */}
            <div className="lg:hidden flex flex-col items-center justify-center mb-8">
              <img src="/mettle-brand/v5/mettle-icon.svg" alt="METTLE" className="w-20 h-20 mb-4 mx-auto block" style={{animation:'coachLogoFloat 4s ease-in-out infinite'}} />
              <h1 className="text-3xl font-black mb-1 tracking-tight" style={{background:'linear-gradient(135deg, #f59e0b, #fbbf24)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>METTLE</h1>
            </div>
            {/* Access card */}
            <div className="bg-[#0a0518]/80 backdrop-blur-xl border-2 border-[#f59e0b]/25 rounded-3xl p-10 sm:p-12 lg:p-14" style={{animation:'coachPinGlow 3s ease-in-out infinite'}}>
              <div className="text-center mb-10">
                <h2 className="text-white text-3xl xl:text-4xl font-bold tracking-wide">Coach Portal</h2>
              </div>
              <div className="flex flex-col gap-7">
                <div>
                  <input type="password" inputMode="numeric" maxLength={4} value={pinInput}
                    onChange={e => { setPinInput(e.target.value.replace(/\D/g, "")); setPinError(false); }}
                    onKeyDown={e => { if (e.key === "Enter") tryUnlock(); }}
                    className={`w-full text-center text-3xl tracking-[0.5em] py-5 bg-[#06020f]/60 border-2 rounded-xl text-[#f59e0b] placeholder:text-[#f59e0b]/15 focus:outline-none transition-all font-mono ${pinError ? "border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.3)]" : "border-[#f59e0b]/20 focus:border-[#f59e0b]/50 focus:shadow-[0_0_30px_rgba(245,158,11,0.2)]"}`}
                    placeholder="_ _ _ _" autoFocus />
                </div>
                {pinError && <p className="text-red-400 text-sm -mt-1 font-mono text-center">ACCESS DENIED</p>}
                <button onClick={tryUnlock}
                  className="w-full py-6 rounded-xl font-black text-lg tracking-widest uppercase transition-all active:scale-[0.97] min-h-[70px]"
                  style={{background:'linear-gradient(135deg, #f59e0b, #fbbf24, #d97706)',color:'#06020f',animation:'coachBtnPulse 2s ease-in-out infinite'}}>
                  Authenticate
                </button>
              </div>
            </div>
            <p className="text-white/20 text-xs text-center mt-6 font-mono">Secure • Encrypted • Private Beta</p>
          </div>
        </div>
      </div>
    </div>
  );
}
