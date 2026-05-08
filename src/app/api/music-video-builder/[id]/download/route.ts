import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/lib/db";

const fileNames: Record<string, string> = {
  finalMp4: "final.mp4",
  metadata: "metadata.json",
  promptText: "prompt.txt",
  thumbnail: "thumbnail.jpg",
  workflow: "workflow.json",
};

function parseReleaseDirectory(result: string): string {
  const parsed = JSON.parse(result) as { releasePackageDir?: unknown };
  return typeof parsed.releasePackageDir === "string" ? parsed.releasePackageDir : "";
}

function contentTypeFor(file: string): string {
  if (file.endsWith(".mp4")) {
    return "video/mp4";
  }

  if (file.endsWith(".jpg")) {
    return "image/jpeg";
  }

  if (file.endsWith(".json")) {
    return "application/json";
  }

  return "text/plain; charset=utf-8";
}

export async function GET(
  request: NextRequest,
  context: RouteContext<"/api/music-video-builder/[id]/download">,
) {
  const { id } = await context.params;
  const fileKey = new URL(request.url).searchParams.get("file") ?? "";
  const fileName = fileNames[fileKey];

  if (!fileName) {
    return NextResponse.json({ error: "Unknown package file." }, { status: 400 });
  }

  const executionRequest = await db.executionRequest.findUnique({
    where: { id },
  });

  if (!executionRequest || executionRequest.status !== "completed") {
    return NextResponse.json({ error: "Package is not ready." }, { status: 404 });
  }

  let releasePackageDir = "";

  try {
    releasePackageDir = parseReleaseDirectory(executionRequest.result);
  } catch {
    releasePackageDir = "";
  }

  if (!releasePackageDir) {
    return NextResponse.json({ error: "Package metadata is missing." }, { status: 404 });
  }

  const outputRoot = path.resolve(process.cwd(), "output");
  const targetPath = path.resolve(releasePackageDir, fileName);

  if (!targetPath.startsWith(outputRoot)) {
    return NextResponse.json({ error: "Package path is outside output." }, { status: 403 });
  }

  try {
    const bytes = await readFile(targetPath);

    return new Response(bytes, {
      headers: {
        "content-disposition": `attachment; filename="${fileName}"`,
        "content-type": contentTypeFor(fileName),
      },
    });
  } catch {
    return NextResponse.json({ error: "Package file was not found." }, { status: 404 });
  }
}
