# Provider Readiness Gates

Created: 2026-05-10

## Purpose

Provider runtime readiness gates prevent mapped provider payloads from accidentally reaching real provider submission paths before the provider is explicitly configured and enabled.

The gate runs before `submitProviderJob` calls a provider adapter.

## Readiness Levels

| Level | Meaning |
| --- | --- |
| `unavailable` | Provider cannot be used. |
| `inspectable` | Provider payload can be generated and inspected locally. |
| `dryRunReady` | Provider can simulate submission without network calls. |
| `certificationReady` | Provider has enough local config or credentials for certification mode. |
| `executionReady` | Provider may execute real jobs. |

## Execution Modes

Set `PROVIDER_RUNTIME_EXECUTION_MODE`.

| Mode | Behavior |
| --- | --- |
| `disabled` | Default. Only mock executes. Real-provider submissions are routed through mock fallback. |
| `inspect` | Real providers return mapped payload inspection metadata. No adapter submission occurs. |
| `dry-run` | Real providers simulate successful submission/completion locally. No network calls occur. |
| `certify` | Providers with required config/credentials may enter certification paths. |
| `execute` | Real adapter submission is allowed only when credentials/config and provider-specific enable flags are present. |

## Provider Requirements

| Provider | Inspect | Dry Run | Certify | Execute |
| --- | --- | --- | --- | --- |
| Mock | Always | Always | Always | Always |
| Comfy | Adapter exists | Payload maps | `COMFY_API_URL` | `COMFY_API_URL` and `PROVIDER_RUNTIME_ENABLE_COMFY=true` |
| WAN | Adapter exists | Payload maps | `WAN_API_KEY` | `WAN_API_KEY` and `PROVIDER_RUNTIME_ENABLE_WAN=true` |
| Kling | Adapter exists | Payload maps | `KLING_API_KEY` | `KLING_API_KEY` and `PROVIDER_RUNTIME_ENABLE_KLING=true` |
| Runway | Adapter exists | Payload maps | `RUNWAY_API_KEY` | `RUNWAY_API_KEY` and `PROVIDER_RUNTIME_ENABLE_RUNWAY=true` |

## Environment Variables

```env
PROVIDER_RUNTIME_EXECUTION_MODE=disabled

PROVIDER_RUNTIME_ENABLE_COMFY=false
PROVIDER_RUNTIME_ENABLE_WAN=false
PROVIDER_RUNTIME_ENABLE_KLING=false
PROVIDER_RUNTIME_ENABLE_RUNWAY=false

COMFY_API_URL=http://127.0.0.1:8188
COMFY_AUTO_START=false
COMFY_START_COMMAND=
COMFY_WORKDIR=
COMFY_STARTUP_TIMEOUT_MS=120000
COMFY_HEALTHCHECK_INTERVAL_MS=3000
WAN_API_KEY=
KLING_API_KEY=
RUNWAY_API_KEY=
```

## Safety Behavior

- In `disabled`, real providers cannot submit real jobs; submission requests route through mock fallback.
- In `inspect`, provider payloads are mapped and returned for review; no provider adapter submission occurs.
- In `dry-run`, provider jobs complete through a local readiness result; no network call occurs.
- In `execute`, provider-specific enable flags still block execution unless explicitly set to `true`.
- Missing credentials block certification and execution.
- Missing required payload fields return normalized validation errors such as `provider_payload_invalid` or `provider_missing_reference_asset`.
- Unavailable provider submission returns normalized `provider_unavailable`.

## Comfy Certification Bootstrap

Comfy certification has an automation-first bootstrap path for local-only certification runs. The bootstrap detects Comfy at `COMFY_API_URL` by checking `/system_stats` and falling back to the provider-runtime Comfy health check.

Bootstrap does not make Comfy the production default. It only starts Comfy when `COMFY_AUTO_START=true` and `COMFY_START_COMMAND` is configured by the local environment.

| Bootstrap status | Meaning | Certification outcome |
| --- | --- | --- |
| `already_running` | Comfy is already healthy. | Continue certification. |
| `started` | Bootstrap command launched and health check passed. | Continue certification. |
| `skipped_autostart_disabled` | Comfy is offline and auto-start is disabled. | Report `skipped_offline`. |
| `missing_start_command` | Auto-start is enabled without a command. | Report `bootstrap_config_missing`. |
| `startup_timeout` | Comfy did not become healthy before timeout. | Report `comfy_startup_timeout`. |
| `startup_failed` | Start command could not be spawned. | Report `comfy_startup_failed`. |

Bootstrap safety rules:

- It never runs unless `COMFY_AUTO_START=true`.
- It never kills existing Comfy processes.
- It never installs dependencies.
- It never mutates workflows.
- It does not require storing personal machine paths or secrets in committed files.
- It does not enable WAN, Kling, or Runway.

## Workflow Certification Gates

Provider readiness is split into two certification layers:

| Layer | Meaning |
| --- | --- |
| Provider lifecycle certification | The provider adapter can submit, poll, retrieve output, and validate artifacts. |
| Workflow production certification | A specific workflow is safe to execute in production mode. |

Comfy can be provider-lifecycle certified through `comfy-provider-smoke` while production workflows remain blocked. A smoke pass does not certify `flux-fast-concept`.

Current Comfy state:

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

Production execution is allowed only when:

- `providerLifecycleStatus = lifecycle_certified`
- `workflowCertificationStatus = production_certified`
- `PROVIDER_RUNTIME_EXECUTION_MODE=execute`
- the provider-specific enable flag is true, such as `PROVIDER_RUNTIME_ENABLE_COMFY=true`

The payload inspection route includes the provider lifecycle status, workflow certification status, and whether the exact requested workflow may execute.

Workflow certification APIs:

```http
GET /api/provider-runtime/workflows/certification
GET /api/provider-runtime/workflows/flux-fast-concept/certification
```

## Routes

Readiness:

```http
GET /api/provider-runtime/providers/readiness
```

Payload inspection:

```http
POST /api/provider-runtime/providers/wan/inspect-payload
Content-Type: application/json

{
  "id": "job-1",
  "sceneId": "scene-1",
  "prompt": "Camera pushes through neon haze",
  "duration": 5,
  "referenceAssets": [{ "path": "images/scene-1.png", "role": "sourceImage" }]
}
```

Response includes `providerId`, `readinessLevel`, `executionMode`, `mappedPayload`, `warnings`, and `missingRequirements`.
