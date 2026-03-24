"use client";

import { ReactNode } from "react";

interface BentoGridProps {
  children: ReactNode;
  className?: string;
}

interface BentoCardProps {
  children: ReactNode;
  className?: string;
  span?: "sm" | "md" | "lg" | "xl";
  color?: "purple" | "blue" | "orange" | "green" | "cyan";
}

export function BentoGrid({ children, className = "" }: BentoGridProps) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-12 gap-4 auto-rows-[160px] ${className}`}>
      {children}
    </div>
  );
}

export function BentoCard({ 
  children, 
  className = "", 
  span = "md",
  color = "purple" 
}: BentoCardProps) {
  const spanClasses = {
    sm: "md:col-span-3",
    md: "md:col-span-4",
    lg: "md:col-span-6",
    xl: "md:col-span-8"
  };

  const colorClasses = {
    purple: "bg-gradient-to-br from-[#0e0e18] via-[#1a1a2e] to-[#2d1b69] border-[#7c3aed]/20",
    blue: "bg-gradient-to-br from-[#0e0e18] via-[#1a2e3a] to-[#1e3a8a] border-[#3b82f6]/20",
    orange: "bg-gradient-to-br from-[#0e0e18] via-[#2a1a0e] to-[#7c2d12] border-[#f97316]/20",
    green: "bg-gradient-to-br from-[#0e0e18] via-[#1a2e2a] to-[#065f46] border-[#10b981]/20",
    cyan: "bg-gradient-to-br from-[#0e0e18] via-[#0e1a2a] to-[#0a3344] border-[#00f0ff]/20"
  };

  return (
    <div 
      className={`
        ${spanClasses[span]}
        ${colorClasses[color]}
        border-2 rounded-2xl
        p-4 md:p-6
        backdrop-blur-xl
        transition-all duration-300
        hover:scale-[1.02] hover:border-[currentColor]/40
        group
        ${className}
      `}
      style={{
        // Bento grid styling
        boxShadow: "0 4px 24px -8px rgba(0, 0, 0, 0.3)",
        // CSS containment for performance
        contain: "content layout style",
        contentVisibility: "auto"
      }}
    >
      {children}
    </div>
  );
}

// Specific bento cards for Apex Athlete
export function AthleteStatsCard({ 
  title, 
  value, 
  change, 
  icon,
  color = "purple" 
}: {
  title: string;
  value: string | number;
  change?: string;
  icon: ReactNode;
  color?: BentoCardProps["color"];
}) {
  return (
    <BentoCard span="sm" color={color}>
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[#94a3b8] text-xs font-semibold uppercase tracking-wider">
            {title}
          </div>
          <div className="text-[#00f0ff] opacity-70 group-hover:opacity-100 transition-opacity">
            {icon}
          </div>
        </div>
        <div className="text-2xl md:text-3xl font-black text-[#f8fafc] mb-1">
          {value}
        </div>
        {change && (
          <div className="text-sm text-[#10b981] font-semibold mt-auto">
            {change}
          </div>
        )}
      </div>
    </BentoCard>
  );
}

export function ProgressCard({ 
  title, 
  progress, 
  color = "blue",
  details 
}: {
  title: string;
  progress: number;
  color?: BentoCardProps["color"];
  details?: string;
}) {
  return (
    <BentoCard span="md" color={color}>
      <div className="h-full flex flex-col">
        <div className="text-[#94a3b8] text-xs font-semibold uppercase tracking-wider mb-3">
          {title}
        </div>
        <div className="flex-1 flex flex-col justify-center">
          <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden mb-2">
            <div 
              className="h-full rounded-full bg-gradient-to-r from-current to-transparent transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between items-center">
            <div className="text-lg font-black text-[#f8fafc]">
              {progress}%
            </div>
            {details && (
              <div className="text-sm text-[#94a3b8]">
                {details}
              </div>
            )}
          </div>
        </div>
      </div>
    </BentoCard>
  );
}

export function MetricCard({ 
  title, 
  metric,
  trend,
  color = "green",
  format = "number"
}: {
  title: string;
  metric: number;
  trend: "up" | "down" | "neutral";
  color?: BentoCardProps["color"];
  format?: "number" | "percent" | "duration";
}) {
  const formattedMetric = format === "percent" 
    ? `${metric}%`
    : format === "duration"
    ? `${metric}m`
    : metric.toLocaleString();

  const trendColor = {
    up: "#10b981",
    down: "#ef4444",
    neutral: "#94a3b8"
  }[trend];

  const trendIcon = {
    up: "↗",
    down: "↘",
    neutral: "→"
  }[trend];

  return (
    <BentoCard span="sm" color={color}>
      <div className="h-full flex flex-col">
        <div className="text-[#94a3b8] text-xs font-semibold uppercase tracking-wider mb-2">
          {title}
        </div>
        <div className="text-2xl font-black text-[#f8fafc] mb-1">
          {formattedMetric}
        </div>
        <div className="mt-auto flex items-center gap-1">
          <span style={{ color: trendColor }}>{trendIcon}</span>
          <span className="text-xs" style={{ color: trendColor }}>
            {trend === "up" ? "Increasing" : trend === "down" ? "Decreasing" : "Stable"}
          </span>
        </div>
      </div>
    </BentoCard>
  );
}

export function ActionCard({ 
  title, 
  description,
  action,
  color = "cyan",
  onClick
}: {
  title: string;
  description: string;
  action: string;
  color?: BentoCardProps["color"];
  onClick?: () => void;
}) {
  return (
    <BentoCard span="lg" color={color}>
      <div className="h-full flex flex-col">
        <div className="text-[#f8fafc] font-bold text-lg mb-2">
          {title}
        </div>
        <div className="text-[#94a3b8] text-sm mb-4 flex-1">
          {description}
        </div>
        <button
          onClick={onClick}
          className="mt-auto px-4 py-2 bg-gradient-to-r from-current/20 to-transparent border border-current/30 rounded-lg text-current font-semibold text-sm transition-all hover:from-current/30 hover:border-current/50 active:scale-95"
        >
          {action}
        </button>
      </div>
    </BentoCard>
  );
}