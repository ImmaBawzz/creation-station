# Provider Payload Contract Report

Created: 2026-05-10

## Purpose

Provider execution now uses one canonical generation payload contract in `src/modules/provider-runtime/types.ts`.

`ProviderJobRequest` extends `BaseGenerationPayload`, so scene planning, motion planning, timeline orchestration, video generation, provider runtime, provider certification, and real provider adapters share the same generation field surface before provider execution.

## Canonical payload fields

| Field | Status | Notes |
| --- | --- | --- |
| `prompt` | Required | Primary provider prompt. Legacy `motionPrompt` maps here. |
| `negativePrompt` | Optional | Shared negative prompt text. |
| `duration` | Required | Positive seconds. |
| `aspectRatio` | Optional | Strict values: `16:9`, `9:16`, `1:1`, `4:3`, `3:4`. |
| `cameraDirection` | Optional | Formalized to close the previous `index.test.ts` drift. |
| `motionIntensity` | Optional | Strict values: `low`, `medium`, `high`, `extreme`. |
| `transitionType` | Optional | Transition label passed from motion/timeline planning. |
| `resolution` | Optional | Positive numeric `{ width, height }`. |
| `fps` | Optional | Positive integer. |
| `seed` | Optional | Integer. |
| `model` | Optional | Provider model override. |
| `workflowId` | Optional | Provider or workflow routing id. |
| `referenceAssets` | Optional | Asset list with `path` and strict role. Legacy `sourceImage` maps to a `sourceImage` reference asset. |
| `audioSyncData` | Optional | BPM, beat timestamps, and labeled cues. |
| `subtitleData` | Optional | Timed subtitle lines. |
| `providerMetadata` | Optional | Provider-specific metadata object. |

## Module alignment

| Module | Contract relationship |
| --- | --- |
| `scene-planner` | Produces `cameraDirection` and scene duration inputs consumed downstream. |
| `motion-director` | Produces `motionIntensity` and `transitionType` signals represented in `BaseGenerationPayload`. |
| `timeline-director` | Produces adjusted durations, transition style, and sequencing fields that map into the canonical payload before execution. |
| `video-generation` | Persists existing `sceneVideos.json` fields for compatibility, then maps jobs into canonical `ProviderJobRequest` objects before provider submission. |
| `provider-runtime` | Owns `BaseGenerationPayload`, `ProviderJobRequest`, runtime validation, and legacy payload normalization. |
| `provider-certification` | Builds certification jobs with canonical `referenceAssets` and `cameraDirection`. |
| Real providers | Receive `ProviderJobRequest` through `ProviderAdapter.submitJob`, with schema validation enforced by `jobExecutor`. |

## Backward compatibility

Legacy fields are accepted only through `normalizeLegacyGenerationPayload`:

| Legacy field | Canonical mapping |
| --- | --- |
| `motionPrompt` | `prompt` |
| `motionType` | `cameraDirection` when no authored camera direction exists |
| `sourceImage` | `referenceAssets: [{ role: "sourceImage", path }]` |

After normalization, strict validation rejects unsupported fields on `BaseGenerationPayload` and `ProviderJobRequest`.

## Validation coverage

Schema tests in `src/modules/provider-runtime/index.test.ts` verify:

- every canonical field is accepted;
- unsupported legacy fields are rejected by strict validation;
- `ProviderJobRequest` uses the same canonical payload schema;
- legacy payloads map to canonical fields before execution.
