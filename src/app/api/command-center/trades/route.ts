import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import { guardPrivateRead } from "@/lib/server/protected-mutation";

// Never let Next statically optimize/cache this route — trade_ledger.json is
// regenerated daily by the SIMONS paper-trading pipeline and every request
// must read the current file (mirrors the no-store fetch semantics that
// implicitly make the meridian route dynamic).
export const dynamic = "force-dynamic";

const DATA_PATH = join(
  process.env.HOME || "/Users/admin",
  ".openclaw/workspace/shared/artifacts/quantitative/trade_ledger.json"
);

function isValidPayload(data: unknown): data is { summary: unknown; trades: unknown[] } {
  if (!data || typeof data !== "object") return false;
  const d = data as { summary?: unknown; trades?: unknown };
  return !!d.summary && typeof d.summary === "object" && Array.isArray(d.trades);
}

export async function GET(req: Request) {
  const p03Guard = await guardPrivateRead(req);
  if (!p03Guard.ok) return p03Guard.response;
  try {
    const raw = await readFile(DATA_PATH, "utf-8");
    const data = JSON.parse(raw) as unknown;
    if (isValidPayload(data)) {
      return NextResponse.json(data, {
        headers: { "Cache-Control": "no-store", "X-CC-Trades-Source": "fs" },
      });
    }
  } catch {
    /* fall through to unavailable */
  }

  return NextResponse.json(
    {
      unavailable: true,
      message:
        "Trade journal not on this host yet. Sync `trade_ledger.json` via bridge or open Finance HQ from the machine that runs the SIMONS pipeline.",
    },
    {
      status: 200,
      headers: { "Cache-Control": "no-store", "X-CC-Trades-Source": "unavailable" },
    }
  );
}
