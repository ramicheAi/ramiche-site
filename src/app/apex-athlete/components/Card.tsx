import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  glow?: boolean;
  neon?: boolean;
}

export function Card({ children, className = "", glow = false, neon = false }: CardProps) {
  return (
    <div
      className={`game-panel game-panel-border card-press touch-glow-cyan hover-lift relative bg-[#06020f]/80 backdrop-blur-xl border border-[#00f0ff]/15 transition-all duration-300 hover:border-[#00f0ff]/30 ${glow ? "neon-pulse" : ""} ${neon ? "shadow-[0_0_30px_rgba(0,240,255,0.1)]" : "shadow-[0_4px_24px_rgba(0,0,0,0.4)]"} ${className}`}
    >
      {children}
    </div>
  );
}

interface GameButtonProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
}

export function GameButton({ children, onClick, className = "", type = "button", disabled = false }: GameButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`game-btn tap-feedback touch-glow-cyan px-4 py-2.5 bg-gradient-to-r from-[#00f0ff]/20 to-[#a855f7]/20 border border-[#00f0ff]/30 text-[#00f0ff] font-bold text-sm tracking-widest uppercase hover:shadow-[0_0_30px_rgba(0,240,255,0.3)] hover:-translate-y-[1px] transition-all min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {children}
    </button>
  );
}