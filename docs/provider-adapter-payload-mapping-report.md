# Provider Adapter Payload Mapping Report

Created: 2026-05-10

## Scope

This report covers canonical `ProviderJobRequest` mapping inside `src/modules/provider-runtime/`.

No real WAN, Kling, Runway, or paid provider execution is enabled. The real adapters still stop at configuration/not-implemented guards after validating and mapping payloads locally.

## Provider support matrix

| Provider | Required fields | Mapped fields | Safely ignored with warning | Current limitations |
| --- | --- | --- | --- | --- |
| Mock | `prompt`, `duration`, `referenceAssets.primaryImage` | All canonical fields are copied into mock `providerMetadata.canonicalPayload`; primary image is used as `sourceImage`. | None; mock records the full canonical payload. | Mock still produces placeholder video ids only. |
| Comfy | `prompt`, `duration`, `referenceAssets.primaryImage` | `prompt` -> positive prompt, `negativePrompt` -> negative prompt, `resolution` -> dimensions, `seed` -> sampler seed, `workflowId` -> workflow id, `referenceAssets` -> image inputs, `providerMetadata` -> workflow overrides. | `aspectRatio`, `fps`, `model`, `motionIntensity`, `transitionType`, `audioSyncData`, `subtitleData`. | No real Comfy video submission is enabled; workflow registry lookup is represented by `workflowId` only. |
| WAN | `prompt`, `duration`, `referenceAssets.primaryImage` | `prompt` -> video prompt, `duration` -> target duration, `cameraDirection` -> camera motion, `referenceAssets.primaryImage` -> image-to-video source, `fps` and `resolution` -> output settings, `providerMetadata` plus `motionIntensity` -> provider options. | `negativePrompt`, `aspectRatio`, `seed`, `model`, `workflowId`, `transitionType`, `audioSyncData`, `subtitleData`. | No WAN API request is sent. Provider-specific capability checks are still future work. |
| Kling | `prompt`, `duration`, `referenceAssets.primaryImage` | `prompt` -> prompt, `duration` -> duration, `referenceAssets.primaryImage` -> start frame, `cameraDirection` and `motionIntensity` -> motion prompt, `providerMetadata` -> provider options. | `negativePrompt`, `aspectRatio`, `resolution`, `fps`, `seed`, `model`, `workflowId`, `transitionType`, `audioSyncData`, `subtitleData`. | No Kling API request is sent. Output setting mapping remains pending. |
| Runway | `prompt`, `duration`, `referenceAssets.primaryImage` | `prompt` -> prompt, `referenceAssets.primaryImage` -> image input, `duration`, `resolution`, and `fps` -> output settings, `providerMetadata` -> provider options. | `negativePrompt`, `aspectRatio`, `cameraDirection`, `motionIntensity`, `transitionType`, `seed`, `model`, `workflowId`, `audioSyncData`, `subtitleData`. | No Runway API request is sent. Model/workflow routing remains pending. |

## Failure behavior

- Missing or blank `prompt` maps to `provider_payload_invalid`.
- Non-positive `duration` maps to `provider_payload_invalid`.
- Missing `referenceAssets.primaryImage` maps to `provider_missing_reference_asset`.
- Unsupported provider-specific optional canonical fields produce mapper warnings and do not crash.

## Readiness

The adapters are ready for a later real-execution implementation step because canonical payloads now map into provider-shaped request objects before any provider call could be added. Real execution is still blocked until each provider adapter adds authenticated HTTP submission, provider capability validation, response parsing, and artifact certification.
