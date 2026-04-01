import { NextResponse } from "next/server";
import { CC_DOCUMENTS } from "@/data/cc-documents";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    documents: CC_DOCUMENTS,
    count: CC_DOCUMENTS.length,
    fetchedAt: new Date().toISOString(),
  });
}
