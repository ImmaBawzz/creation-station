# Local Comfy Provider Certification Report

Generated: 2026-05-10T20:59:53.253Z

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

Final status: `failed`

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
| `COMFY_QUEUE_TIMEOUT_MS` | `120000` | Maximum time a submitted prompt may remain queued during certification. |
| `COMFY_EXECUTION_TIMEOUT_MS` | `1200000` | Maximum time a running certification prompt may execute. |
| `COMFY_OUTPUT_IMPORT_TIMEOUT_MS` | `120000` | Maximum time to wait for completed outputs to appear. |
| `COMFY_ARTIFACT_VALIDATION_TIMEOUT_MS` | `60000` | Maximum time reserved for artifact validation. |

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

## Timeout Diagnostics

Certification now writes detailed local diagnostics to:

```text
.debug/comfy-certification-diagnostics.json
```

This file is intentionally ignored by git and must not be committed. It records the Comfy URL, `/system_stats`, queue snapshots before and after submit, `prompt_id`, history poll snapshots, final history if available, execution errors, output node IDs, output filenames, artifact validation status, and whether timeout happened before or after history appeared.

Timeout phase categories:

| Phase | Meaning |
| --- | --- |
| `before_queue` | Timeout or failure occurred before a `prompt_id` was available. |
| `queued` | Prompt was still in Comfy pending queue when queue timeout elapsed. |
| `running` | Prompt was running or had incomplete history when execution timeout elapsed. |
| `completed_no_history` | Prompt left the queue, but history was unavailable. |
| `history_no_outputs` | History completed but did not contain outputs. |
| `outputs_not_found` | History named outputs, but expected files were not found or accessible. |
| `artifact_invalid` | Artifact validator rejected the output. |
| `unknown_timeout` | Timeout did not match a more specific phase. |

The latest diagnostic run timed out in certification execution after `prompt_id` submission. The prompt entered Comfy's running queue immediately, `/history/[prompt_id]` remained empty during the diagnostic window, no output filenames were reported, and artifact validation did not run.

Observed diagnostic classification:

| Field | Value |
| --- | --- |
| Prompt ID | `5001e4f9-5123-4084-a4ec-5ee030a968da` |
| Queue before submit | empty |
| Queue after submit | `queue_running` |
| History appeared | `false` |
| Timeout happened before history | `true` |
| Timeout phase | `running` |
| Outputs detected | `false` |
| Artifact validation ran | `false` |

This supports a bounded diagnosis: the certification did not time out waiting in the queue and did not reach output import. It timed out while Comfy considered the prompt running, before history was written.

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

Status: `passed`

Bootstrap status: `already_running`

Health endpoint: `/system_stats`

Local ComfyUI was already reachable at `http://127.0.0.1:8188`, so certification proceeded past bootstrap and health validation.

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

Runtime payload inspection passed.

Mapped payload summary:

```json
{
  "workflowId": "flux-fast-concept",
  "positivePrompt": "simple cinematic test frame, soft light, abstract geometric object, no text",
  "negativePrompt": "text, watermark, logo, blurry, corrupted",
  "width": 512,
  "height": 512,
  "samplerSeed": 12345,
  "imageInputs": [],
  "workflowOverrides": {}
}
```

Inspection warnings:

- `aspectRatio` is advisory for Comfy; `resolution` controls dimensions when provided.
- `fps` is not mapped into current Comfy workflow stubs.
- `motionIntensity` is not mapped into current Comfy workflow stubs.

## Dry-Run Result

Status: `passed`

Workflow: `flux-fast-concept`

Prepared prompt node count: `10`

Workflow identity recorded before submit:

| Field | Value |
| --- | --- |
| Workflow type | `flux-fast-concept` |
| Workflow path | `src/modules/comfy/workflows/flux-fast-concept.json` |
| Positive prompt node ID | `4` |
| Negative prompt node ID | `36` |
| Save image node ID | `9` |
| Latent size | `512x512` |
| Sampler steps | `6` |
| Seed | randomized by Comfy workflow after submit |
| Filename prefix | `comfy-certification-dry-run-concept-*` |
| Model filenames | `flux1-schnell.safetensors`, `clip_l.safetensors`, `t5xxl_fp16.safetensors`, `ae.safetensors` |

Workflow validation now fails before execution with explicit errors:

- `comfy_workflow_missing` when the workflow file or registry entry is missing.
- `comfy_model_missing` when a required model file is missing.
- `comfy_prompt_injection_failed` when the positive prompt node cannot be injected.
- `comfy_output_node_missing` when the `SaveImage` output node is missing.

## Certification Execution Result

Status: `failed`

Reason: `provider_timeout`

Timeout phase: `running`

The local Comfy interrupt endpoint was called after the diagnostic timeout and returned without an error response.

Submitted prompt timed out:

```text
ComfyUI job timed out: d60bec7c-cda2-4489-85da-301775586458
```

An automated local Comfy interrupt was attempted through `POST /interrupt` after the timeout. The endpoint returned without an error response.

## Artifact Validation Result

Status: not run

Reason: certification execution timed out before output retrieval.

Output diagnostics now distinguish completed history with missing outputs from provider timeouts. If history completes without output filenames, the run is classified as `history_no_outputs`. If output filenames exist but files cannot be found or accessed, the run is classified as `outputs_not_found`.

## Certification Workflow Strategy

The primary certification workflow remains `flux-fast-concept`. If that workflow is too slow or model-heavy, certification must keep the production workflow marked as timed out and uncertified.

A lightweight provider lifecycle workflow may be used only if it is explicitly registered as `comfy-provider-smoke`. That smoke workflow may verify submit, poll, output, and artifact validation plumbing, but it does not replace `flux-fast-concept` production certification.

## Final Certification Status

`failed`

This is a real local certification failure caused by `provider_timeout`. Comfy is not marked certified and Comfy is not production-default.

## Next Recommended Step

Investigate why the safe `flux-fast-concept` certification workflow did not complete within the certification timeout, then rerun:

```powershell
npm run certify:provider -- comfy
```

Do not enable WAN, Kling, or Runway while certifying local ComfyUI.
