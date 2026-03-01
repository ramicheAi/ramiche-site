"use client";
import { ReactNode, useRef, useCallback } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  glow?: boolean;
  neon?: boolean;
}

export function Card({ children, className = "", glow = false, neon = false }: CardProps) {
  const ref = useRef<HTMLDivElement>(null);

  const handleTouch = useCallback((e: React.TouchEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.touches[0].clientX - rect.left;
    const y = e.touches[0].clientY - rect.top;
    const dot = document.createElement("span");
    dot.className = "touch-glow";
    dot.style.left = `${x}px`;
    dot.style.top = `${y}px`;
    el.appendChild(dot);
    setTimeout(() => dot.remove(), 500);
  }, []);

  return (
    <div
      ref={ref}
      onTouchStart={handleTouch}
      className={`game-panel game-panel-border card-breathe relative bg-[#06020f]/80 backdrop-blur-xl border border-[#00f0ff]/15 transition-all duration-300 hover:border-[#00f0ff]/30 hover:-translate-y-[1px] ${glow ? "neon-pulse" : ""} ${neon ? "shadow-[0_0_30px_rgba(0,240,255,0.1)]" : "shadow-[0_4px_24px_rgba(0,0,0,0.4)]"} ${className}`}
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
  const ref = useRef<HTMLButtonElement>(null);

  const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const el = ref.current;
    if (!el || disabled) return;

    // Ripple from touch point
    const rect = el.getBoundingClientRect();
    const ripple = document.createElement("span");
    ripple.className = "btn-ripple";
    ripple.style.left = `${e.clientX - rect.left}px`;
    ripple.style.top = `${e.clientY - rect.top}px`;
    el.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);

    // Spring bounce
    el.classList.remove("btn-spring");
    void el.offsetWidth;
    el.classList.add("btn-spring");

    // Haptic
    if (navigator.vibrate) navigator.vibrate(15);

    onClick?.();
  }, [onClick, disabled]);

  return (
    <button
      ref={ref}
      type={type}
      onClick={handleClick}
      disabled={disabled}
      className={`game-btn relative overflow-hidden px-4 py-2.5 bg-gradient-to-r from-[#00f0ff]/20 to-[#a855f7]/20 border border-[#00f0ff]/30 text-[#00f0ff] font-bold text-sm tracking-widest uppercase hover:shadow-[0_0_30px_rgba(0,240,255,0.3)] transition-all min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {children}
    </button>
  );
}
