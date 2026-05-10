# Local Comfy Provider Certification Report

Generated: 2026-05-10T21:38:22.640Z

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
npm run certify:provider -- comfy --smoke
```

Final status: `certified`

Lifecycle certified: `true`

Production certified: `false`

No WAN, Kling, or Runway execution was enabled.

## Certification State

```json
{
  "provider": "comfy",
  "smokeCertification": {
    "status": "passed",
    "reason": "provider_lifecycle_certified"
  },
  "productionCertification": {
    "workflowType": "flux-fast-concept",
    "status": "timeout",
    "reason": "running_no_history"
  }
}
```

Comfy may be considered lifecycle-certified for the local provider runtime submit, poll, output, and artifact validation path. Comfy is not production-certified for `flux-fast-concept`, and this does not make Comfy production-default.

Workflow-level provider runtime gates now enforce that distinction:

- Provider lifecycle certification answers whether the adapter can submit, poll, retrieve output, and validate artifacts.
- Workflow production certification answers whether a specific workflow is safe for real production execution.
- `comfy-provider-smoke` can certify the Comfy provider lifecycle.
- `comfy-provider-smoke` does not certify `flux-fast-concept` or any other production workflow.
- `flux-fast-concept` remains blocked because its latest production classification is `running_no_history`.

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

Runtime forensics now also write:

```text
.debug/comfy-runtime-forensics.json
```

This ignored file records `/system_stats`, `/object_info`, queue and history snapshots before and after submit, the submitted workflow node IDs, model filenames, the current `queue_running` item, whether the prompt remains running, whether history appears, and whether outputs appear without import.

Runtime timeout classifications:

| Classification | Meaning |
| --- | --- |
| `submit_failed` | Submit failed before `prompt_id` was returned. |
| `queued_never_started` | Prompt stayed in `queue_pending`. |
| `running_no_history` | Prompt stayed in `queue_running` and history never appeared. |
| `running_node_unknown` | Prompt was running with insufficient node-level detail. |
| `history_error` | Comfy history reported an execution error. |
| `history_no_outputs` | History appeared but contained no outputs. |
| `outputs_not_found` | History named outputs but files were not accessible. |
| `artifact_invalid` | Artifact validation failed after output retrieval. |
| `interrupted_after_timeout` | Local interrupt was issued after timeout. |
| `unknown` | Forensics could not classify the state. |

Current diagnosis: `running_no_history`.

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

## Smoke Certification Result

Status: `passed`

Workflow type: `comfy-provider-smoke`

Workflow strategy: `checkpoint`

Purpose: provider lifecycle only.

The smoke run completed:

```text
submit -> poll -> output -> artifact validation
```

Observed result:

| Field | Value |
| --- | --- |
| Bootstrap status | `already_running` |
| Health | `online` |
| Node count | `7` |
| Prompt ID | `cbb48ee5-d8af-4b86-a767-97146a5fb390` |
| Output count | `1` |
| Artifact byte length | `121068` |
| Artifact validation | `passed` |

Generated Comfy output media remains a local Comfy artifact and is not committed.

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

Production workflow status: not run after the smoke certification.

Reason: the latest command was `comfy --smoke`, which intentionally certifies provider lifecycle only. The previous `flux-fast-concept` production run timed out before output retrieval.

Smoke artifact validation status: `passed`

Output diagnostics now distinguish completed history with missing outputs from provider timeouts. If history completes without output filenames, the run is classified as `history_no_outputs`. If output filenames exist but files cannot be found or accessed, the run is classified as `outputs_not_found`.

## Certification Workflow Strategy

The primary certification workflow remains `flux-fast-concept`. If that workflow is too slow or model-heavy, certification must keep the production workflow marked as timed out and uncertified.

A lightweight provider lifecycle workflow is available as `comfy-provider-smoke` through:

```powershell
npm run certify:provider -- comfy --smoke
```

The smoke workflow verifies provider lifecycle only:

```text
submit -> poll -> output -> artifact validation
```

Smoke workflow model strategy:

1. Prefer a lightweight checkpoint workflow if any local checkpoint is discovered under configured Comfy model roots.
2. Fall back to a reduced FLUX workflow when checkpoint models are absent but FLUX dependencies are present.
3. Return `comfy_smoke_model_missing` when neither checkpoint nor FLUX dependencies are available.

The smoke workflow does not replace `flux-fast-concept` production certification.

Certification reports distinguish lifecycle and production state:

```json
{
  "provider": "comfy",
  "smokeCertification": {
    "status": "passed | failed | skipped",
    "reason": "..."
  },
  "productionCertification": {
    "workflowType": "flux-fast-concept",
    "status": "passed | failed | timeout | skipped",
    "reason": "..."
  }
}
```

If smoke certification passes, Comfy may be treated as provider-lifecycle certified while `flux-fast-concept` remains production-uncertified. Production execution must still stay disabled until production certification passes.

Production execution is allowed only when all of the following are true:

- `providerLifecycleStatus` is `lifecycle_certified`.
- The exact requested workflow has `workflowCertificationStatus` of `production_certified`.
- `PROVIDER_RUNTIME_EXECUTION_MODE=execute`.
- `PROVIDER_RUNTIME_ENABLE_COMFY=true`.

Current gate state:

```json
{
  "provider": "comfy",
  "providerLifecycleStatus": "lifecycle_certified",
  "workflows": {
    "flux-fast-concept": {
      "status": "timeout",
      "classification": "running_no_history"
    },
    "flux-dev-cinematic": {
      "status": "uncertified"
    }
  }
}
```

## Final Certification Status

Lifecycle: `passed`

Production `flux-fast-concept`: `timeout`

The local Comfy provider lifecycle is certified through the smoke workflow. `flux-fast-concept` remains production-uncertified because it previously timed out as `running_no_history`. Comfy is not production-default and should not be enabled for real production execution until production certification passes.

## Next Recommended Step

Keep the provider lifecycle path as certified and investigate why `flux-fast-concept` stays running without history. The next safe branch is production workflow optimization or model/runtime diagnosis, then rerun:

```powershell
npm run certify:provider -- comfy
```

Do not enable WAN, Kling, or Runway while certifying local ComfyUI.
