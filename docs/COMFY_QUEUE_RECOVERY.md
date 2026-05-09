# Comfy Queue Recovery

Creation Station does not auto-cancel Comfy jobs.

If a FLUX concept job is stuck in `queued` or `running`, clear it manually in ComfyUI:

1. Open the local ComfyUI window or browser tab.
2. In the queue panel, clear pending jobs.
3. If a job is actively running, use ComfyUI's interrupt or stop control.
4. If ComfyUI is unresponsive, restart ComfyUI.

After the queue is cleared:

1. Refresh the Creation Station project page.
2. Wait for the current job to move to `failed` or `timeout` through polling.
3. Start a new concept job only after the previous project job is no longer active.

If ComfyUI was cleared manually and the project still appears locked after the timeout window, verify that the prompt is gone from ComfyUI queue and history, then remove the matching lock file from `output/temp/comfy-jobs/locks/` as a last resort.