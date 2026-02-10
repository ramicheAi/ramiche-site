"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CoachPortal() {
  const router = useRouter();

  useEffect(() => {
    // For now, redirect to the existing main page
    // We'll extract the coach-specific UI here soon
    router.push("/apex-athlete");
  }, [router]);

  return (
    <div className="min-h-screen bg-[#06020f] flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-4">🏊</div>
        <div className="neon-text-cyan text-lg font-mono mb-2">Redirecting to Coach Portal...</div>
        <div className="text-[#00f0ff]/30 text-sm">Building the three-portal architecture</div>
      </div>
    </div>
  );
}