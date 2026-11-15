import { NextResponse } from "next/server";
import { CC_DOCUMENTS } from "@/data/cc-documents";
import { ownerOnly } from "@/lib/server/command-center-guard";

export const dynamic = "force-dynamic";

async function GET_handler() {
  return NextResponse.json({
    documents: CC_DOCUMENTS,
    count: CC_DOCUMENTS.length,
    fetchedAt: new Date().toISOString(),
  });
}

// Owner-only: enforced in the handler itself (CC-SECURITY-RECONCILIATION-02).
export const GET = ownerOnly(GET_handler);
