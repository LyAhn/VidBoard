# FLUX.2 Klein storyboard continuity workflow

This guide is for building the ComfyUI workflows VidBoard needs for stable music-video storyboard frames.

The goal is not just "nice images." It is continuity:

- same character or band identity
- same wardrobe/instruments/props
- same environment family and colour grade
- Start and End frame differ only by action/motion progression

## Recommended setup

Use two workflows and export both in API format:

```text
comfyui/flux2-klein-reference.workflow.json
comfyui/flux2-klein-reference-img2img.workflow.json
```

Then set:

```env
COMFYUI_START_WORKFLOW=flux2-klein-reference
COMFYUI_END_WORKFLOW=flux2-klein-reference-img2img
```

## Models found locally

Your Comfy Desktop install already has the required default files:

```text
models/diffusion_models/flux-2-klein-4b-fp8.safetensors
models/text_encoders/qwen_3_4b.safetensors
models/vae/flux2-vae.safetensors
```

## Workflow A: Start frame, reference-only

Use this for each frame's Start image.

### Node chain

```text
UNETLoader
  unet_name: flux-2-klein-4b-fp8.safetensors
  weight_dtype: default

CLIPLoader
  clip_name: qwen_3_4b.safetensors
  type: flux2
  device: default

VAELoader
  vae_name: flux2-vae.safetensors

CLIPTextEncode
  text: placeholder positive prompt
  clip: CLIPLoader

ConditioningZeroOut
  conditioning: CLIPTextEncode

LoadImage
  image: placeholder character/reference image

ImageScaleToTotalPixels
  image: LoadImage
  upscale_method: lanczos
  megapixels: 1.0
  resolution_steps: 1

VAEEncode
  pixels: ImageScaleToTotalPixels
  vae: VAELoader

ReferenceLatent
  conditioning: CLIPTextEncode
  latent: VAEEncode

CFGGuider
  model: UNETLoader
  positive: ReferenceLatent
  negative: ConditioningZeroOut
  cfg: 1.0

KSamplerSelect
  sampler_name: euler

RandomNoise
  noise_seed: random/fixed placeholder

Flux2Scheduler
  steps: 12 to 16
  width: 1344
  height: 768

EmptyFlux2LatentImage
  width: 1344
  height: 768
  batch_size: 1

SamplerCustomAdvanced
  noise: RandomNoise
  guider: CFGGuider
  sampler: KSamplerSelect
  sigmas: Flux2Scheduler
  latent_image: EmptyFlux2LatentImage

VAEDecode
  samples: SamplerCustomAdvanced
  vae: VAELoader

SaveImage
  filename_prefix: VidBoard/frame
```

### API node map

After exporting API JSON, map these node IDs in `comfyui/workflows.json`:

```json
"flux2-klein-reference": {
  "file": "flux2-klein-reference.workflow.json",
  "capabilities": {
    "referenceImage": true,
    "initImage": false
  },
  "nodes": {
    "prompt": "<CLIPTextEncode id>",
    "seed": "<RandomNoise id>",
    "scheduler": "<Flux2Scheduler id>",
    "latent": "<EmptyFlux2LatentImage id>",
    "saveImage": "<SaveImage id>",
    "referenceImage": "<LoadImage character/reference id>"
  }
}
```

## Workflow B: End frame, reference + Start frame

Use this for each frame's End image. It should keep the generated Start frame as the visual anchor.

### Node chain

Build the same loader/prompt/sampler chain as Workflow A, but add a second image reference:

```text
LoadImage (character/reference)
  -> ImageScaleToTotalPixels
  -> VAEEncode
  -> ReferenceLatent #1

LoadImage (generated Start frame / init image)
  -> ImageScaleToTotalPixels
  -> VAEEncode
  -> ReferenceLatent #2

CLIPTextEncode
  -> ReferenceLatent #1
  -> ReferenceLatent #2
  -> CFGGuider positive
```

So the conditioning path should be:

```text
CLIPTextEncode
  -> ReferenceLatent(character/reference latent)
  -> ReferenceLatent(start-frame latent)
  -> CFGGuider.positive
```

Sampler path is the same:

```text
RandomNoise + CFGGuider + KSamplerSelect + Flux2Scheduler + EmptyFlux2LatentImage
  -> SamplerCustomAdvanced
  -> VAEDecode
  -> SaveImage
```

### Settings

Start here:

```text
steps: 12 to 16
cfg: 1.0
sampler: euler
reference image scale: 1.0 megapixels
start image scale: 1.0 megapixels
```

If End frames barely move, lower the Start-frame reference influence by reducing its scale or try
fewer steps. If identity drifts, make the character reference clearer and keep it first in the
ReferenceLatent chain.

### API node map

```json
"flux2-klein-reference-img2img": {
  "file": "flux2-klein-reference-img2img.workflow.json",
  "capabilities": {
    "referenceImage": true,
    "initImage": true
  },
  "nodes": {
    "prompt": "<CLIPTextEncode id>",
    "seed": "<RandomNoise id>",
    "scheduler": "<Flux2Scheduler id>",
    "latent": "<EmptyFlux2LatentImage id>",
    "saveImage": "<SaveImage id>",
    "referenceImage": "<LoadImage character/reference id>",
    "initImage": "<LoadImage generated Start frame id>"
  }
}
```

## Export steps

1. Build Workflow A in ComfyUI.
2. Run it manually with a character reference image and a simple prompt.
3. Save the normal UI workflow if desired.
4. Export API format and save as `comfyui/flux2-klein-reference.workflow.json`.
5. Build Workflow B by adding the second Start-frame image path.
6. Run it manually with the same character reference image plus a generated Start image.
7. Export API format and save as `comfyui/flux2-klein-reference-img2img.workflow.json`.
8. Create `comfyui/workflows.json` with the actual node IDs from the exported files.

## Notes

FLUX.2 Klein reference editing is convenient and already installed here. If identity preservation is
still weak after this, the next model to test is Qwen-Image-Edit-2511, because its current ComfyUI
docs specifically call out reduced image drift and improved character consistency.
