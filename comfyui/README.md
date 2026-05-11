# ComfyUI workflows

VidBoard talks to a local ComfyUI server by submitting workflow API JSON to `/prompt`.

## Default workflow

The default backend is `flux2-klein`, targeting FLUX.2 Klein 4B on 12GB RTX cards.

Expected model files for the example workflow:

```text
ComfyUI/
├── models/
│   ├── diffusion_models/
│   │   └── flux-2-klein-4b-fp8.safetensors
│   ├── text_encoders/
│   │   └── qwen_3_4b.safetensors
│   └── vae/
│       └── flux2-vae.safetensors
```

## Local workflow export

The committed `*.workflow.example.json` file is a portable starting point. For a tuned local
workflow, export from ComfyUI with **Save (API format)** and save it as:

```text
comfyui/flux2-klein.workflow.json
```

Local workflow exports are gitignored because they can contain machine-specific node choices.

If node IDs change, copy `workflows.example.json` to `workflows.json` and update the node map.
`workflows.json` is also gitignored.

## Storyboard continuity workflow

The committed `flux2-klein.workflow.example.json` is only a text-to-image smoke test. It cannot
use a character reference image or a generated Start frame.

For real storyboard continuity, export a workflow that supports both:

- a character/reference image `LoadImage` node
- a Start-frame/init image `LoadImage` node for End-frame image-to-image/reference generation

The best setup is two workflows:

- Start workflow: text prompt + character/reference image.
- End workflow: text prompt + character/reference image + generated Start frame as init/reference.

Then add local `workflows.json` entries like:

```json
{
  "defaultWorkflow": "flux2-klein",
  "workflows": {
    "flux2-klein-reference": {
      "file": "flux2-klein-reference.workflow.json",
      "capabilities": {
        "referenceImage": true,
        "initImage": false
      },
      "nodes": {
        "prompt": "64",
        "negativePrompt": "65",
        "seed": "111",
        "scheduler": "114",
        "latent": "118",
        "saveImage": "58",
        "referenceImage": "124"
      }
    },
    "flux2-klein-reference-img2img": {
      "file": "flux2-klein-reference-img2img.workflow.json",
      "capabilities": {
        "referenceImage": true,
        "initImage": true
      },
      "nodes": {
        "prompt": "64",
        "negativePrompt": "65",
        "seed": "111",
        "scheduler": "114",
        "latent": "118",
        "saveImage": "58",
        "referenceImage": "124",
        "initImage": "116"
      }
    }
  }
}
```

Set:

```env
COMFYUI_START_WORKFLOW=flux2-klein-reference
COMFYUI_END_WORKFLOW=flux2-klein-reference-img2img
```

VidBoard will now fail loudly if a reference or init image is supplied to a workflow that cannot
actually consume it. That avoids generating attractive but inconsistent text-to-image frames.

## Environment

Set these in `.env.local` as needed:

```env
COMFYUI_BASE_URL=http://127.0.0.1:8188
COMFYUI_WORKFLOW=flux2-klein
COMFYUI_WORKFLOW_DIR=./comfyui
```

Comfy Desktop sometimes runs on another port, so set `COMFYUI_BASE_URL` to the URL shown in its
startup log.
