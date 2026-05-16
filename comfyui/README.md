# ComfyUI workflows

VidBoard talks to a local ComfyUI server by submitting workflow API JSON to `/prompt`.

## What is committed

All workflow files and the node-map config are committed and machine-portable:

```text
comfyui/
├── workflows.json                              ← active node-map config
├── workflows.example.json                      ← fallback used if workflows.json is absent
├── flux2-klein-txt2img.workflow.json           ← text-to-image (no reference image)
├── flux2-klein-reference.workflow.json         ← txt2img + character reference image
├── flux2-klein-reference-img2img.workflow.json ← reference + init-image (img2img)
└── flux2-klein.workflow.example.json           ← original smoke-test example
```

These target **FLUX.2 Klein 4B** on a 12 GB RTX card. Expected model files:

```text
ComfyUI/
└── models/
    ├── diffusion_models/
    │   └── flux-2-klein-4b-fp8.safetensors
    ├── text_encoders/
    │   └── qwen_3_4b.safetensors
    └── vae/
        └── flux2-vae.safetensors
```

## Workflow roles

VidBoard uses two workflows per storyboard run, controlled by env vars:

| Env var | Default | Purpose |
|---|---|---|
| `COMFYUI_START_WORKFLOW` | `flux2-klein-reference` | Start frame — text prompt + optional character ref |
| `COMFYUI_END_WORKFLOW` | `flux2-klein-reference` | End frame — same, or img2img variant |
| `COMFYUI_WORKFLOW` | `defaultWorkflow` in `workflows.json` | Fallback if neither start/end is set |

The committed defaults work out of the box. For continuity-aware end frames (where the start image is used as an init), switch the end workflow:

```env
COMFYUI_START_WORKFLOW=flux2-klein-reference
COMFYUI_END_WORKFLOW=flux2-klein-reference-img2img
```

## Bringing your own workflow

If you export a custom ComfyUI workflow (**Save → API format**), the node IDs in your
export will differ from the committed files. Use the helper script to build the node map:

```bash
node scripts/map-workflow.mjs comfyui/my-workflow.json
```

The script introspects node `class_type` values and prints candidate node IDs for each
role. Copy the suggested entry into `workflows.json` under `"workflows"` and adjust any
ambiguous candidates (e.g. positive vs negative `CLIPTextEncode`).

## `workflows.json` structure

```jsonc
{
  "defaultWorkflow": "my-workflow",
  "workflows": {
    "my-workflow": {
      "file": "my-workflow.json",       // path relative to comfyui/
      "capabilities": {
        "referenceImage": false,        // true if workflow has a LoadImage for character ref
        "initImage": false              // true if workflow has a LoadImage for init/img2img
      },
      "nodes": {
        "prompt":         "<node-id>",  // CLIPTextEncode (positive)
        "negativePrompt": "<node-id>",  // CLIPTextEncode (negative) — omit for FLUX
        "seed":           "<node-id>",  // KSampler / RandomNoise
        "scheduler":      "<node-id>",  // node with width/height inputs (BasicScheduler etc.)
        "latent":         "<node-id>",  // EmptyLatentImage or similar
        "saveImage":      "<node-id>",  // SaveImage
        "referenceImage": "<node-id>",  // LoadImage for character ref (if applicable)
        "initImage":      "<node-id>"   // LoadImage for init frame (if applicable)
      }
    }
  }
}
```

> **Note on negative prompts:** FLUX models use flow matching and do not support CFG-based
> negative guidance. VidBoard skips `negativePrompt` injection automatically for any workflow
> whose name matches `/flux/i`. You can still define the node in the map — it will be left
> unmodified. For non-FLUX workflows, set `COMFYUI_NEGATIVE_PROMPT` in `.env.local` to
> provide the negative prompt text.

## Environment variables

```env
COMFYUI_BASE_URL=http://127.0.0.1:8188   # default; change if ComfyUI runs on another port
COMFYUI_WORKFLOW_DIR=./comfyui            # directory containing workflow files
COMFYUI_NEGATIVE_PROMPT=                  # negative prompt text for non-FLUX workflows
```

Comfy Desktop sometimes runs on a different port — check its startup log for the URL.
