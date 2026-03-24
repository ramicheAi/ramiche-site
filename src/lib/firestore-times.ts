import { fbSet, fbGet } from "@/lib/firebase";

interface BestTimeRecord {
  event: string;
  stroke: string;
  time: string;
  course: string;
  meet: string;
  date: string;
}

interface StoredBestTimes {
  times: BestTimeRecord[];
  swimmer?: string;
  team?: string;
  swimmerUrl?: string;
  count?: number;
  savedAt: number;
}

export async function saveBestTimes(
  athleteId: string,
  data: { times: BestTimeRecord[]; swimmer?: string; team?: string; swimmerUrl?: string; count?: number }
): Promise<boolean> {
  const payload: StoredBestTimes = { ...data, savedAt: Date.now() };
  return fbSet(`athletes/${athleteId}/bestTimes`, payload as unknown as Record<string, unknown>);
}

export async function getBestTimes(athleteId: string): Promise<StoredBestTimes | null> {
  return fbGet<StoredBestTimes>(`athletes/${athleteId}/bestTimes`);
}
