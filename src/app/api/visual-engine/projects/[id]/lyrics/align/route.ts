import { NextResponse } from "next/server";

import { alignLyricsArtifacts, type LyricsPipelineError } from "@/modules/visual-engine/lyrics/transcribe";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  try {
    const result = await alignLyricsArtifacts(id);

    return NextResponse.json({
      alignedJsonPath: result.alignedJsonPath,
      confidenceScore: result.alignmentReport?.confidenceScore ?? 0,
      lineCount: result.artifacts.lineCount,
      missingWords: result.alignmentReport?.missingWords ?? [],
      projectId: id,
      success: true,
      timingDriftSeconds: result.alignmentReport?.averageTimingDriftSeconds ?? 0,
      usedAlignedTimestamps: result.usedAlignedTimestamps,
      wordCount: result.artifacts.wordCount,
    });
  } catch (error) {
    const lyricsError = error as LyricsPipelineError;

    return NextResponse.json(
      {
        details: lyricsError.details ?? [],
        error: lyricsError.message || "Lyrics alignment failed.",
        projectId: id,
      },
      { status: lyricsError.statusCode ?? 500 },
    );
  }
}