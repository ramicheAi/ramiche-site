"use client";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { InstrumentPage } from "@/components/command-center/po/Instrument";
import { MissionListView } from "@/components/command-center/missions/MissionViews";

/* ══════════════════════════════════════════════════════════════════════════════
   MISSIONS — canonical P06 Missions (M1 identity + M2 founder API).
   The former project-progress page that lived here is now /command-center/projects/progress.
   ?objective=…&fromSynthesis=<id> (from Decisions) opens New Mission prefilled and links the plan after creating.
   ══════════════════════════════════════════════════════════════════════════════ */

function MissionsWithParams() {
  const q = useSearchParams();
  const router = useRouter();
  const fromSynthesis = q.get("fromSynthesis") ?? undefined;
  const objective = q.get("objective") ?? undefined;
  // Once a prefilled form is created OR cancelled, drop the prefill query: "New Mission" then starts clean, a refresh
  // does not reopen it, and the cancelled plan cannot be attached by accident.
  return <MissionListView key={`${fromSynthesis ?? ""}|${objective ?? ""}`} fromSynthesis={fromSynthesis} initialObjective={objective}
    onPrefillDone={() => { if (fromSynthesis || objective) router.replace("/command-center/missions"); }} />;
}

export default function MissionsPage() {
  return (
    <InstrumentPage id="missions" title="Missions" section="Operations" icon="bolt" accent="var(--c-amber)">
      <Suspense fallback={<p style={{ color: "var(--t-mid)" }}>Loading missions…</p>}>
        <MissionsWithParams />
      </Suspense>
    </InstrumentPage>
  );
}
