# Local Comfy Provider Certification Report

Generated: 2026-05-10T20:32:31.484Z

## Summary

Local ComfyUI certification was run through the provider-runtime certification command:

```powershell
PROVIDER_RUNTIME_EXECUTION_MODE=certify
PROVIDER_RUNTIME_ENABLE_COMFY=true
PROVIDER_RUNTIME_ENABLE_WAN=false
PROVIDER_RUNTIME_ENABLE_KLING=false
PROVIDER_RUNTIME_ENABLE_RUNWAY=false
COMFY_API_URL=http://127.0.0.1:8188
npm run certify:provider -- comfy
```

Final status: `skipped_offline`

Certified: `false`

No WAN, Kling, or Runway execution was enabled.

## Readiness State

| Check | Result |
| --- | --- |
| Provider adapter | Present |
| Payload mapper | Present |
| Provider registry | Includes `comfy` |
| Comfy URL | `http://127.0.0.1:8188` |
| Execution mode | `certify` |
| Comfy enable flag | `true` for this certification process only |

## Health Result

Status: `skipped`

Reason: `comfy_offline`

Observed error: `ComfyUI is unavailable at http://127.0.0.1:8188: fetch failed`

Because local ComfyUI was offline, the certification runner did not attempt workflow submission, polling, or artifact retrieval.

## Payload Inspection Result

The configured safe certification payload is:

```json
{
  "prompt": "simple cinematic test frame, soft light, abstract geometric object, no text",
  "negativePrompt": "text, watermark, logo, blurry, corrupted",
  "duration": 1,
  "aspectRatio": "1:1",
  "resolution": { "width": 512, "height": 512 },
  "fps": 24,
  "seed": 12345,
  "workflowId": "flux-fast-concept",
  "cameraDirection": "static",
  "motionIntensity": "low",
  "referenceAssets": []
}
```

Payload mapper coverage is validated by automated tests. Runtime payload inspection was not executed in this offline run because the health gate stopped the certification flow before workflow validation and dry-run preparation.

## Dry-Run Result

Status: not run

Reason: local ComfyUI health check returned `comfy_offline`.

## Certification Execution Result

Status: skipped

Reason: `comfy_offline`

No real image generation occurred.

## Artifact Validation Result

Status: not run

Reason: no provider artifact was created because certification execution was skipped.

## Final Certification Status

`skipped_offline`

This is an environment-state skip, not a source validation failure.

## Next Recommended Step

Start local ComfyUI externally at `http://127.0.0.1:8188`, then rerun:

```powershell
npm run certify:provider -- comfy
```

Do not enable WAN, Kling, or Runway while certifying local ComfyUI.
