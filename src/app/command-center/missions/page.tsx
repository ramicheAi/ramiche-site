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
  // The prefill query is consumed (replaced, not pushed, so Back cannot return to it) as soon as a mission is created
  // from it, or the form is cancelled: a refresh or Back never rebuilds a creation form for the same plan. No key on
  // the list: clearing the query must not remount it, or the partial-success recovery screen would be lost. Arriving
  // from Decisions mounts this page fresh anyway.
  return <MissionListView fromSynthesis={fromSynthesis} initialObjective={objective}
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
