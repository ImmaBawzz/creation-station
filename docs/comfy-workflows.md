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
- exact local model-file presence for production-role workflows using the configurable Comfy model inventory
- approved local alias resolution when a production-compatible filename differs from the workflow default

The inventory scans these directories:

- `COMFY_MODEL_ROOT/unet`
- `COMFY_MODEL_ROOT/diffusion_models`
- `COMFY_MODEL_ROOT/clip`
- `COMFY_MODEL_ROOT/vae`

Overrides:

- `COMFY_MODEL_ROOT`
- `COMFY_UNET_DIR`
- `COMFY_CLIP_DIR`
- `COMFY_VAE_DIR`

If a referenced model file is missing, the workflow is not selectable and the UI surfaces the exact missing filename.
If an approved alias exists locally, validation returns `validWithAlias`, the UI warns that a local alias is being used, and the submitted workflow graph is mutated to the resolved local filename before queue submission.

### Alias Resolution

Current supported alias families include:

- `flux1-dev.safetensors` -> `flux1-dev-fp8.safetensors` or `flux-dev-fp8.safetensors`
- `clip_l.safetensors` -> `clip-l.safetensors`
- `t5xxl_fp16.safetensors` -> `t5xxl_fp8_e4m3fn.safetensors` or `t5xxl_fp8.safetensors`
- `ae.safetensors` -> `flux_ae.safetensors`

If only `flux1-schnell.safetensors` is available, Creation Station does not promote it into the production cinematic workflow and instead recommends keeping Schnell under `Fast Concept`.

If only GGUF production candidates are found, Creation Station does not auto-select them for the current `UNETLoader` path and reports that GGUF loader support would be required.

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
- Alias-backed validation keeps the workflow enabled but surfaces `Using local model alias` in the UI.
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

## Submitted Workflow Debug

Each submitted workflow write includes an ignored debug file at:

- `.debug/comfy-last-submitted-[workflowType].json`

That payload includes:

- workflow type
- required model names
- resolved model names
- mutated node IDs
- final prompt
- final negative prompt
- final filename prefix

## Why Video Workflows Stay Blocked

Creation Station is still stabilization-first for the current milestone.

- The approved Comfy scope is limited to image-generation workflows.
- Video workflows expand runtime cost, model sprawl, queue complexity, and validation surface area beyond the current stabilization target.
- Keeping the registry image-only preserves the existing orchestration path without reopening unapproved subsystems.