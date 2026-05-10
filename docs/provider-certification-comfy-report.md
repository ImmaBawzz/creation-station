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
COMFY_AUTO_START=false
npm run certify:provider -- comfy
```

Final status: `skipped_offline`

Certified: `false`

No WAN, Kling, or Runway execution was enabled.

## Automated Bootstrap

The Comfy certification runner now calls `bootstrapComfy()` before provider certification.

Bootstrap checks `COMFY_API_URL`, then probes `/system_stats` and falls back to the provider-runtime Comfy health check. It only attempts to start Comfy when `COMFY_AUTO_START=true`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `COMFY_API_URL` | `http://127.0.0.1:8188` | Local Comfy endpoint to detect and certify. |
| `COMFY_AUTO_START` | `false` | Enables automated local Comfy startup when offline. |
| `COMFY_START_COMMAND` | empty | Shell command used to start Comfy when auto-start is enabled. |
| `COMFY_WORKDIR` | empty | Optional working directory for the start command. |
| `COMFY_STARTUP_TIMEOUT_MS` | `120000` | Maximum time to wait for Comfy to become healthy. |
| `COMFY_HEALTHCHECK_INTERVAL_MS` | `3000` | Delay between startup health checks. |

Bootstrap outcomes:

| Status | Certification behavior |
| --- | --- |
| `already_running` | Proceed to Comfy certification. |
| `started` | Proceed to Comfy certification after health passes. |
| `skipped_autostart_disabled` | Report `skipped_offline`; no startup attempted. |
| `missing_start_command` | Report `bootstrap_config_missing`; no startup attempted. |
| `startup_timeout` | Report `comfy_startup_timeout`; certification fails safely. |
| `startup_failed` | Report `comfy_startup_failed`; certification fails safely. |

Safety constraints:

- The bootstrap never runs unless `COMFY_AUTO_START=true`.
- The bootstrap never kills existing Comfy processes.
- The bootstrap never installs dependencies.
- The bootstrap never mutates Comfy workflows.
- The bootstrap does not log secrets and the report does not require committing local machine paths.
- WAN, Kling, and Runway remain disabled during Comfy certification.

## Readiness State

| Check | Result |
| --- | --- |
| Provider adapter | Present |
| Payload mapper | Present |
| Provider registry | Includes `comfy` |
| Comfy URL | `http://127.0.0.1:8188` |
| Comfy auto-start | `false` for the recorded run |
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

Either start local ComfyUI externally at `http://127.0.0.1:8188`, or configure an explicit local bootstrap command outside source control:

```powershell
COMFY_AUTO_START=true
COMFY_START_COMMAND=<local Comfy start command>
COMFY_WORKDIR=<optional local Comfy directory>
```

Then rerun:

```powershell
npm run certify:provider -- comfy
```

Do not enable WAN, Kling, or Runway while certifying local ComfyUI.
