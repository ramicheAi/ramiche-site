'use client';

/**
 * Animated streak flame — replaces static 🔥 emoji with a living, flickering flame SVG.
 * Flame intensity scales with streak length (bigger streaks = more intense).
 */
export default function StreakFlame({ streak, size = 16 }: { streak: number; size?: number }) {
  if (streak <= 0) return null;

  // Intensity tiers: 1-3 = small, 4-7 = medium, 8-14 = hot, 15+ = inferno
  const tier = streak >= 15 ? 3 : streak >= 8 ? 2 : streak >= 4 ? 1 : 0;
  const colors = [
    { outer: '#f59e0b', inner: '#fbbf24', core: '#fef3c7' }, // warm amber
    { outer: '#f97316', inner: '#fb923c', core: '#fed7aa' }, // orange
    { outer: '#ef4444', inner: '#f97316', core: '#fbbf24' }, // red-orange
    { outer: '#dc2626', inner: '#ef4444', core: '#fbbf24' }, // intense red
  ][tier];

  const animDuration = tier >= 2 ? '0.3s' : '0.5s';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={{ display: 'inline-block', verticalAlign: 'middle', filter: `drop-shadow(0 0 ${3 + tier * 2}px ${colors.outer}80)` }}
    >
      <style>{`
        @keyframes flicker1 { 0%,100% { transform: scaleY(1) scaleX(1); } 25% { transform: scaleY(1.06) scaleX(0.96); } 50% { transform: scaleY(0.94) scaleX(1.04); } 75% { transform: scaleY(1.03) scaleX(0.97); } }
        @keyframes flicker2 { 0%,100% { transform: scaleY(1) scaleX(1); } 33% { transform: scaleY(1.08) scaleX(0.94); } 66% { transform: scaleY(0.95) scaleX(1.05); } }
        @keyframes flicker3 { 0%,100% { opacity: 0.7; } 50% { opacity: 1; } }
        .flame-outer { animation: flicker1 ${animDuration} ease-in-out infinite; transform-origin: 12px 20px; }
        .flame-inner { animation: flicker2 ${parseFloat(animDuration) * 0.8}s ease-in-out infinite; transform-origin: 12px 20px; }
        .flame-core { animation: flicker3 ${parseFloat(animDuration) * 0.6}s ease-in-out infinite; }
      `}</style>
      {/* Outer flame */}
      <path
        className="flame-outer"
        d="M12 2C12 2 5 10 5 15C5 19.4 8.1 22 12 22C15.9 22 19 19.4 19 15C19 10 12 2 12 2Z"
        fill={colors.outer}
        opacity="0.9"
      />
      {/* Inner flame */}
      <path
        className="flame-inner"
        d="M12 6C12 6 8 12 8 15.5C8 18.3 9.8 20 12 20C14.2 20 16 18.3 16 15.5C16 12 12 6 12 6Z"
        fill={colors.inner}
        opacity="0.95"
      />
      {/* Core */}
      <path
        className="flame-core"
        d="M12 11C12 11 10 14.5 10 16C10 17.7 10.9 18.5 12 18.5C13.1 18.5 14 17.7 14 16C14 14.5 12 11 12 11Z"
        fill={colors.core}
      />
    </svg>
  );
}
