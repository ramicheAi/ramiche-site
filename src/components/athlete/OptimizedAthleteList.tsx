"use client";

import { useState, useMemo, useRef, useEffect } from "react";

interface Athlete {
  id: string;
  name: string;
  xp: number;
  level: number;
  streak: number;
  present: boolean;
  color: string;
}

interface OptimizedAthleteListProps {
  athletes: Athlete[];
  onAthleteClick?: (athlete: Athlete) => void;
  onTogglePresent?: (athleteId: string) => void;
  className?: string;
}

// Virtualized item with content-visibility optimization
const AthleteListItem = ({ 
  athlete, 
  onClick, 
  onTogglePresent,
  index 
}: { 
  athlete: Athlete;
  onClick: () => void;
  onTogglePresent: () => void;
  index: number;
}) => {
  const itemRef = useRef<HTMLDivElement>(null);

  // Apply content-visibility optimization
  useEffect(() => {
    if (itemRef.current) {
      // Only apply content-visibility for items far from viewport
      if (index > 20) {
        itemRef.current.style.contentVisibility = "auto";
        itemRef.current.style.containIntrinsicSize = "0 72px"; // Estimate height
      }
    }
  }, [index]);

  return (
    <div
      ref={itemRef}
      className="group relative overflow-hidden transition-all duration-200 hover:bg-white/5 rounded-xl"
      style={{ 
        // CSS containment for performance
        contain: "content layout style",
        willChange: "transform"
      }}
    >
      <div className="absolute left-0 top-0 bottom-0 w-[2px]" 
           style={{ 
             background: `linear-gradient(180deg, ${athlete.present ? "#00f0ff" : athlete.color}${athlete.present ? "80" : "25"}, transparent)` 
           }} />
      
      <div className="flex items-center gap-3 p-4 cursor-pointer tap-feedback"
           onClick={onClick}>
        
        {/* Present toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onTogglePresent();
          }}
          className={`w-10 h-10 rounded-full shrink-0 flex items-center justify-center transition-all duration-200 active:scale-90 ${
            athlete.present
              ? "bg-emerald-500/20 border-2 border-emerald-400/60 shadow-[0_0_12px_rgba(16,185,129,0.2)]"
              : "bg-white/[0.03] border-2 border-white/10 hover:border-white/20"
          }`}
          aria-label={athlete.present ? "Mark absent" : "Mark present"}
        >
          {athlete.present ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8.5L6.5 12L13 4" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ) : (
            <div className="w-2 h-2 rounded-full bg-white/15" />
          )}
        </button>

        {/* Avatar */}
        <div 
          className="w-11 h-11 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0 transition-all duration-300 group-hover:scale-110"
          style={{ 
            background: `radial-gradient(circle at 30% 30%, ${athlete.color}30, ${athlete.color}08)`,
            border: `2px solid ${athlete.color}${athlete.present ? "90" : "35"}`,
            boxShadow: athlete.present ? `0 0 20px ${athlete.color}20` : `0 0 8px ${athlete.color}08`
          }}
        >
          {athlete.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="text-white text-sm font-semibold truncate">
            {athlete.name}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span 
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ 
                color: athlete.color, 
                background: `${athlete.color}15` 
              }}
            >
              Level {athlete.level}
            </span>
            {athlete.streak > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#f59e0b]/10 text-[#f59e0b]/70 inline-flex items-center gap-0.5">
                🔥 {athlete.streak}d
              </span>
            )}
          </div>
        </div>

        {/* XP */}
        <div className="w-28 shrink-0 text-right">
          <div className="text-white font-black text-sm tabular-nums whitespace-nowrap">
            {athlete.xp.toLocaleString()}
            <span className="text-white/50 text-xs ml-1">XP</span>
          </div>
          <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden mt-1.5">
            <div 
              className="h-full rounded-full bg-gradient-to-r from-[#7c3aed] to-[#a855f7] transition-all duration-700"
              style={{ width: `${(athlete.xp % 1000) / 10}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default function OptimizedAthleteList({
  athletes,
  onAthleteClick,
  onTogglePresent,
  className = ""
}: OptimizedAthleteListProps) {
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 30 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Sort athletes for better visual grouping
  const sortedAthletes = useMemo(() => {
    return [...athletes].sort((a, b) => {
      // Present athletes first
      if (a.present !== b.present) return a.present ? -1 : 1;
      // Then by XP
      return b.xp - a.xp;
    });
  }, [athletes]);

  // Virtual scrolling optimization
  const handleScroll = () => {
    if (!containerRef.current) return;
    
    const container = containerRef.current;
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;
    
    // Calculate visible range with buffer
    const itemHeight = 72; // Estimated item height
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - 10);
    const end = Math.min(
      sortedAthletes.length,
      Math.ceil((scrollTop + clientHeight) / itemHeight) + 10
    );
    
    setVisibleRange({ start, end });
  };

  // Initial scroll handler setup
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Initial calculation

    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  // Visible items for virtualization
  const visibleAthletes = useMemo(() => {
    return sortedAthletes.slice(visibleRange.start, visibleRange.end);
  }, [sortedAthletes, visibleRange]);

  return (
    <div 
      ref={containerRef}
      className={`overflow-y-auto ${className}`}
      style={{ 
        // CSS Containment for performance
        contain: "strict",
        contentVisibility: "auto",
        // Smooth scrolling
        scrollBehavior: "smooth",
        // Optimize scrolling performance
        WebkitOverflowScrolling: "touch",
        overscrollBehavior: "contain"
      }}
    >
      {/* Top spacer for virtualization */}
      <div style={{ height: `${visibleRange.start * 72}px` }} />
      
      {/* Visible items */}
      {visibleAthletes.map((athlete, index) => (
        <AthleteListItem
          key={athlete.id}
          athlete={athlete}
          index={visibleRange.start + index}
          onClick={() => onAthleteClick?.(athlete)}
          onTogglePresent={() => onTogglePresent?.(athlete.id)}
        />
      ))}
      
      {/* Bottom spacer for virtualization */}
      <div style={{ 
        height: `${Math.max(0, (sortedAthletes.length - visibleRange.end) * 72)}px` 
      }} />
      
      {/* Performance metrics overlay (dev only) */}
      {process.env.NODE_ENV === "development" && (
        <div className="fixed bottom-4 right-4 bg-black/80 text-white text-xs p-2 rounded-lg z-50">
          <div>Visible: {visibleAthletes.length}/{sortedAthletes.length}</div>
          <div>Range: {visibleRange.start}-{visibleRange.end}</div>
          <div>Render time: {performance.now().toFixed(1)}ms</div>
        </div>
      )}
    </div>
  );
}

// Performance utility: Measure rendering
export function useRenderMetrics(name: string) {
  useEffect(() => {
    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      if (duration > 16) { // Longer than one frame at 60fps
        console.warn(`⚡ ${name} render took ${duration.toFixed(1)}ms`);
      }
    };
  }, [name]);
}