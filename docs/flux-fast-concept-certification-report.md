# Flux Fast Concept Certification Report

Generated: 2026-05-10T22:03:22.288Z

Final classification: `workflow_runtime_hang`

## Static Validation

Status: `passed`

Model files: `ae.safetensors`, `clip_l.safetensors`, `t5xxl_fp16.safetensors`, `flux1-schnell.safetensors`

Node mapping: `{"positivePromptNodeId":"4","negativePromptNodeId":"36","saveImageNodeId":"9","widthHeightNodeId":"6"}`

Errors: none

## Minimal Run

Status: `failed`

Timeout phase: `running_no_history`

Queue state: `running`

History state: `missing`

Output detection: `missing`

Artifact validation: `not_run`

## Standard Run

Status: `failed`

Timeout phase: `not_run`

Queue state: `not_run`

History state: `not_run`

Output detection: `not_run`

Artifact validation: `not_run`

## Recommended Fix

Inspect Comfy runtime logs and node execution for the minimal FLUX workflow; provider lifecycle remains valid.
