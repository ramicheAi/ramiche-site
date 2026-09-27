import { guardPrivateRead } from "@/lib/server/protected-mutation";
import { NextResponse } from "next/server";
import { CC_DOCUMENTS } from "@/data/cc-documents";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const p03Guard = await guardPrivateRead(req);
  if (!p03Guard.ok) return p03Guard.response;

  return NextResponse.json({
    documents: CC_DOCUMENTS,
    count: CC_DOCUMENTS.length,
    fetchedAt: new Date().toISOString(),
  });
}
