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
