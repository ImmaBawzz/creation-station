# Clean Vocal Fallback Report

## Scope

This pass added a narrow fallback path for low-anchor vocal failures without changing the successful primary alignment path.

The fallback only activates when the alignment report detects one or more of these conditions:

- low anchor density
- low confidence alignment
- sparse transcript coverage

When triggered, the pipeline keeps the canonical source lyrics and switches timing generation to smart duration interpolation across the transcript span, nudged by any sparse matched anchors that do exist.

## Clean Case Before

Project: `clean-vocals-test`

- confidence score: `0.079`
- average timing drift: `0.247s`
- transcript word count: `57`
- used aligned timestamps: `false`
- failure mode: pathological fallback grouping from sparse Whisper anchors
- first SRT block: `00:00:19,620 --> 00:01:29,960`

That output was technically renderable but functionally unusable as subtitle timing.

## Clean Case After

Project: `clean-vocals-test`

- confidence score: `0.079`
- average timing drift: `0.247s`
- transcript word count: `57`
- fallback mode: `smart_duration_interpolation`
- anchor density: `0.146`
- transcript coverage: `0.193`
- fallback triggers:
  - `low_anchor_density`
  - `low_confidence_alignment`
  - `sparse_transcript_coverage`
- used fallback: `true`
- used aligned timestamps: `true`
- first SRT block: `00:00:19,620 --> 00:00:24,526`

The transcript quality did not improve, which is expected. The improvement is that low-confidence runs now stay on canonical source lines with sane interpolated timing instead of dropping back to pathological Whisper grouping.

## Behavior Change

The fallback does not attempt to invent better transcript anchors. It only changes how timestamps are assigned when the transcript is too sparse to trust the primary alignment path.

Mode A:

- distributes source lyric lines across the observed transcript span
- weights duration by source line length
- nudges windows toward sparse matched anchors when they exist
- preserves monotonic source order and minimum line durations

Mode B:

- not implemented in this pass
- future-ready adapter surface was added so a forced-alignment backend can be slotted in later without redesigning the alignment seam

## Preservation Check

The successful cases stayed on the primary path.

`melodic-vocals-test`

- confidence score: `0.721`
- average timing drift: `0.160s`
- fallback mode: `none`
- anchor density: `0.871`
- transcript coverage: `0.969`
- used fallback: `false`
- used aligned timestamps: `true`

`hard-vocals-test`

- confidence score: `0.716`
- average timing drift: `0.112s`
- fallback mode: `none`
- anchor density: `0.868`
- transcript coverage: `0.976`
- used fallback: `false`
- used aligned timestamps: `true`

## Validation

Completed validation for this slice:

- `tsc --noEmit`
- `POST /api/visual-engine/projects/clean-vocals-test/lyrics/align`
- `POST /api/visual-engine/projects/clean-vocals-test/render`
- `POST /api/visual-engine/projects/melodic-vocals-test/lyrics/align`
- `POST /api/visual-engine/projects/hard-vocals-test/lyrics/align`

## Conclusion

The fallback solves the specific low-anchor clean-vocal failure mode that previously produced unusable long-hold subtitles. It does this without changing the successful melodic and hard vocal paths, which remain on the primary alignment mode.