import { NextResponse } from "next/server";
import { requireFounderAuthority } from "@/lib/server/founder-authority";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Thin entry point. The actual implementation (filesystem operations + gateway
 * spawn) lives in `./handler` and is loaded dynamically so NFT does not
 * statically trace the workspace fallback path or the gateway lib's transitive
 * imports into this route's serverless bundle.
 */
export async function POST(request: Request): Promise<Response> {
  // CC-FOUNDER-AUTHORITY-GUARD-01 worked example. No-op (today's unguarded
  // behavior) unless CC_FOUNDER_GUARD_ENFORCE is "all" or lists "yolo-approve";
  // then only a server-signed founder session cookie from /auth/pin passes.
  const denied = requireFounderAuthority(request, "yolo-approve");
  if (denied) return denied;
  try {
    const { handleYoloApprove } = await import("./handler");
    return await handleYoloApprove(request);
  } catch (err) {
    console.error("[yolo-approve] Failed to load handler:", err);
    return NextResponse.json(
      { error: "Failed to process action" },
      { status: 500 }
    );
  }
}
