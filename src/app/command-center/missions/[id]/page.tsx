"use client";
import { useParams } from "next/navigation";
import { InstrumentPage } from "@/components/command-center/po/Instrument";
import { MissionDetailView } from "@/components/command-center/missions/MissionViews";

/* MISSION DETAIL — state, definition, links/evidence, history and the founder's lifecycle actions (M2 API only). */
export default function MissionDetailPage() {
  const params = useParams<{ id: string }>();
  return (
    <InstrumentPage id="mission" title="Mission" section="Operations" icon="bolt" accent="var(--c-amber)">
      {params?.id ? <MissionDetailView key={params.id} id={params.id} /> : null}
    </InstrumentPage>
  );
}
