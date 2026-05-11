import { NextResponse } from "next/server";

import { generateLyricsArtifacts, type LyricsPipelineError } from "@/modules/visual-engine/lyrics/transcribe";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  try {
    const result = await generateLyricsArtifacts(id);
    return NextResponse.json({
      assPath: result.assPath,
      jsonPath: result.jsonPath,
      lineCount: result.lineCount,
      projectId: id,
      srtPath: result.srtPath,
      success: true,
      wordCount: result.wordCount,
    });
  } catch (error) {
    const lyricsError = error as LyricsPipelineError;

    return NextResponse.json(
      {
        details: lyricsError.details ?? [],
        error: lyricsError.message || "Lyrics generation failed.",
        projectId: id,
      },
      { status: lyricsError.statusCode ?? 500 },
    );
  }
}