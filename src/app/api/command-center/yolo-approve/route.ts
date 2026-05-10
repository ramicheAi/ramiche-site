import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Thin entry point. The actual implementation (filesystem operations + gateway
 * spawn) lives in `./handler` and is loaded dynamically so NFT does not
 * statically trace the workspace fallback path or the gateway lib's transitive
 * imports into this route's serverless bundle.
 */
export async function POST(request: Request): Promise<Response> {
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
