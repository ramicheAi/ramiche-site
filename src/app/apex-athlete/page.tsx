"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ApexAthleteRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/apex-athlete/coach");
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center">
      <div className="text-white/40 text-sm">Loading METTLE...</div>
    </div>
  );
}
