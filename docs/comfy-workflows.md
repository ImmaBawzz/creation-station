# Comfy Workflows

## Scope

Creation Station supports controlled ComfyUI image-generation workflows only.

- `flux-fast-concept` remains the default concept workflow.
- `flux-dev-cinematic` is the higher-quality production workflow for key art and visual engine assets.
- Video-oriented workflows remain blocked by scope policy. Do not add WAN, LTX, Flowframes, Kling, Hunyuan, or other video-generation pipelines under this surface.

## Workflow Roles

### `flux-fast-concept`

- Role: concept exploration
- UI label: `Fast Concept`
- Use when: you need a quick composition pass, early visual direction, or a lower-cost smokeable concept image.
- Default behavior: stays selectable by default so the media project flow does not depend on optional production models.

### `flux-dev-cinematic`

- Role: production image generation
- UI label: `Cinematic Frame`
- Use when: you need higher-quality music video key art, stronger scene framing, or a more production-oriented still for the visual engine.
- Default behavior: not selected by default and not enabled until validation succeeds.

## Validation Behavior

The workflow registry and validator check each registered workflow for:

- workflow file presence under `src/modules/comfy/workflows/`
- positive prompt node presence and mutability
- negative prompt node presence and mutability
- `SaveImage` node presence and mutability
- latent width and height node presence and mutability
- declared UNET, CLIP, and VAE model filenames in the workflow graph
- exact local model-file presence for production-role workflows when the Comfy models directory can be resolved

Exact model-file validation uses one of these sources:

- `CREATION_STATION_COMFYUI_MODELS_DIR`
- `CREATION_STATION_COMFYUI_ROOT` joined with `models/`
- common local ComfyUI install locations when no env var is set

If a referenced model file is missing, the workflow is not selectable and the UI surfaces the exact missing filename.

## UI Selection Rules

- The workflow selector stays visible even if ComfyUI is offline.
- `Fast Concept` stays available as the default selection.
- `Cinematic Frame` is enabled only after validation and smoke validation mark it usable.
- If validation fails, `Cinematic Frame` stays disabled and the UI shows the first validation error.
- If a concept job is already active, the generate button is disabled and the current job state is shown in the button/status text.

## Async Generation Flow

The image-generation request payload includes:

```json
{
  "projectId": "...",
  "prompt": "...",
  "negativePrompt": "...",
  "workflowType": "flux-fast-concept" | "flux-dev-cinematic"
}
```

After submission, Creation Station preserves the existing async behavior:

1. submit the Comfy job
2. poll job status
3. import the resulting image when available
4. update the visual project manifest
5. show the generated image in the project UI

## Failure And Recovery Branches

### Comfy offline

- Selector remains visible.
- Workflow status becomes `Comfy offline`.
- The page should not crash.

### Workflow validation failure

- `Cinematic Frame` stays disabled.
- The validator returns a short error, including exact missing model filenames when detected.
- Builds continue to succeed because validation errors are runtime workflow state, not compile errors.

### Timeout

- Workflow state becomes `Timeout`.
- No duplicate submit is performed for the same active project job.
- Increase `CREATION_STATION_COMFY_TIMEOUT_MS` if the production workflow needs more time.

### Output missing

- History/debug data is written under ignored `.debug/` files.
- The UI reports `Output missing`.
- The workflow is not marked validated.

### Successful cinematic import

- Workflow state becomes `Validated`.
- The imported image is written into the project image folder.
- The project manifest is updated.
- The image becomes visible in the project UI.

## Why Video Workflows Stay Blocked

Creation Station is still stabilization-first for the current milestone.

- The approved Comfy scope is limited to image-generation workflows.
- Video workflows expand runtime cost, model sprawl, queue complexity, and validation surface area beyond the current stabilization target.
- Keeping the registry image-only preserves the existing orchestration path without reopening unapproved subsystems.