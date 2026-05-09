# Comfy Workflow Validation

## Validation Flow

Creation Station now treats Comfy workflow registration as a two-step process:

1. `POST /api/comfy/workflows/[workflowType]/validate`
2. `POST /api/comfy/workflows/[workflowType]/smoke-test`

The validation route performs static workflow checks without requiring direct ComfyUI interaction:

- workflow JSON exists under `src/modules/comfy/workflows/`
- required node IDs exist
- positive prompt node is mutable
- negative prompt node is mutable
- `SaveImage` node is mutable
- latent width and height node exists and is mutable
- model filename exists in the workflow
- VAE filename exists in the workflow
- both CLIP filenames exist in the workflow

If the static checks pass, the route also probes ComfyUI availability. A structurally valid workflow can still be marked unavailable when ComfyUI is offline.

## Smoke Test Flow

The smoke-test route completes automated workflow registration:

1. re-runs static validation
2. checks that the target visual project exists
3. submits a reduced prompt payload using a safe smoke prompt
4. reduces latent width, height, and steps when the workflow supports it
5. polls ComfyUI until completion or timeout
6. imports the generated image into `visual-workspace/projects/[projectId]/images/`
7. updates the visual project manifest
8. persists the workflow state as `Validated`

The media UI calls the validation route automatically and, for `flux-dev-cinematic`, runs the smoke test automatically once the workflow reaches the `Available` state. No manual ComfyUI testing is required.

## Branch Handling

The workflow state is persisted in `.debug/comfy-workflow-state-[workflowType].json` and exposed back to the UI.

Statuses:

- `Available`: static validation passed and ComfyUI is reachable, but smoke validation has not completed yet
- `Needs validation`: workflow JSON or required node/model metadata failed validation
- `Comfy offline`: workflow is structurally valid, but ComfyUI is unreachable
- `Timeout`: smoke test ran but exceeded the configured timeout
- `Output missing`: ComfyUI completed the run but Creation Station could not retrieve an image output
- `Validated`: smoke test imported an output successfully and the workflow is selectable in the UI

Selection rules:

- `Fast Concept` remains the default workflow
- `Cinematic Frame` stays disabled until the smoke-test route marks it `Validated`

## Known Failure Modes

### Validation Failure

Symptoms:

- route returns `valid: false`
- UI shows `Needs validation`
- `.debug/comfy-workflow-validation-[workflowType].json` is written

Common causes:

- missing workflow file
- missing prompt, save, or width/height node IDs
- non-mutable prompt or save node widgets
- missing model, VAE, or CLIP filenames in the workflow JSON

### Comfy Offline

Symptoms:

- route returns a reachable workflow definition with `status: "Comfy offline"`
- workflow remains unavailable in the UI
- build does not fail

### Timeout

Symptoms:

- smoke test returns `status: "Timeout"`
- no output is imported
- UI keeps the workflow disabled

Recommendation:

- increase `CREATION_STATION_COMFY_TIMEOUT_MS`

### Output Missing

Symptoms:

- smoke test finishes but no image can be retrieved
- `.debug/comfy-history-[promptId].json` is written
- workflow stays disabled

## Recovery Path

1. Call the validation route and inspect `errors`, `warnings`, `modelFiles`, and `nodeMapping`.
2. If validation fails, fix the workflow JSON under `src/modules/comfy/workflows/` and re-run validation.
3. If ComfyUI is offline, restore the Comfy service and re-run validation. The app build remains unaffected.
4. If the smoke test times out, increase `CREATION_STATION_COMFY_TIMEOUT_MS` and re-run the smoke test.
5. If output is missing, inspect `.debug/comfy-history-[promptId].json` for the exact Comfy history payload, then fix the workflow or output path issue and re-run the smoke test.
6. Once the smoke test imports successfully, the workflow state becomes `Validated` and `Cinematic Frame` is enabled in the UI.