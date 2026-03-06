import { NextResponse } from "next/server";
import fs from "fs";

const BUILDS_PATH = "/Users/admin/.openclaw/workspace/yolo-builds/builds.json";

function readBuilds(): unknown[] {
  const raw = fs.readFileSync(BUILDS_PATH, "utf-8");
  return JSON.parse(raw);
}

function writeBuilds(builds: unknown[]): void {
  fs.writeFileSync(BUILDS_PATH, JSON.stringify(builds, null, 2), "utf-8");
}

export async function GET() {
  try {
    const builds = readBuilds();
    return NextResponse.json(builds);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to read builds.json", detail: String(err) },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { folder, reviewStatus } = body as {
      folder: string;
      reviewStatus: "approved" | "rejected" | "pending";
    };

    if (!folder || !reviewStatus) {
      return NextResponse.json(
        { error: "Missing folder or reviewStatus" },
        { status: 400 },
      );
    }

    const builds = readBuilds() as Record<string, unknown>[];
    const build = builds.find((b) => b.folder === folder);

    if (!build) {
      return NextResponse.json(
        { error: `Build not found: ${folder}` },
        { status: 404 },
      );
    }

    build.reviewStatus = reviewStatus;
    writeBuilds(builds);

    return NextResponse.json(build);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to update build", detail: String(err) },
      { status: 500 },
    );
  }
}
