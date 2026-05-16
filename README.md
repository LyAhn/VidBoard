![line](https://capsule-render.vercel.app/api?type=egg&color=gradient&height=2)

# ➤ VidBoard

A local-first music video storyboard tool. Uses Ollama (Qwen3) for AI planning and ComfyUI + FLUX.2 Klein for cinematic frame generation — no cloud dependencies, no API rate limits.


![line](https://capsule-render.vercel.app/api?type=egg&color=gradient&height=2)

## ➤ Purpose

VidBoard is designed to streamline the pre-production pipeline for AI-assisted music video creation.

You give it an artist, a track, lyrics, and a mood/theme. It researches the artist, builds a Visual Bible, breaks the track into scenes, and generates **Start and End frame pairs** for each scene — cinematic stills that bookend a video segment.

Those frame pairs are the actual deliverable. The intended workflow is:

1. VidBoard generates a **Start frame** and **End frame** for each scene
2. You take those two frames into **Google Flow (Veo)** and use them as the first and last frame inputs
3. Veo generates the video segment between them — motion, transitions, and everything in between
4. Repeat for each scene to build the full music video sequence

This means VidBoard handles the creative planning and visual consistency work, while Veo handles the video generation. The quality of the output depends heavily on how well the Start and End frames communicate the intended shot — which is what the scene planning and prompt generation pipeline is optimised for.

> The approach to generating Start and End frames is still evolving. The goal is better visual continuity between the two frames of a pair without making them so similar that Veo has nothing interesting to interpolate between.


![line](https://capsule-render.vercel.app/api?type=egg&color=gradient&height=2)

## ➤ Prerequisites

### 1. Node.js 20+ and pnpm

### 2. Ollama

- Install: https://ollama.com/download
- Pull the planning model:
  ```bash
  ollama pull qwen3:8b
  ```
- Create a free account at https://ollama.com and generate an API key — required for Ollama's web search feature

### 3. ComfyUI + FLUX.2 Klein

Install ComfyUI: https://github.com/comfy-org/ComfyUI

Download the following model files and place them in your ComfyUI installation:

| File | Destination |
|---|---|
| `flux-2-klein-4b-fp8.safetensors` | `ComfyUI/models/diffusion_models/` |
| `qwen_3_4b.safetensors` | `ComfyUI/models/text_encoders/` |
| `flux2-vae.safetensors` | `ComfyUI/models/vae/` |

All three model files are available on Hugging Face. Search for the filenames above.

Start ComfyUI so it listens on the network:

```bash
python main.py --listen
```

> Comfy Desktop runs on a different port — check its startup log for the actual URL and set `COMFYUI_BASE_URL` accordingly.


![line](https://capsule-render.vercel.app/api?type=egg&color=gradient&height=2)

## ➤ Setup

```bash
git clone https://github.com/LyAhn/VidBoard
cd VidBoard
pnpm install
cp .env.example .env.local
# Edit .env.local — at minimum set OLLAMA_API_KEY
pnpm run dev
```

Open http://localhost:3000.


![line](https://capsule-render.vercel.app/api?type=egg&color=gradient&height=2)

## ➤ Workflows

Three ComfyUI workflow files are included in `comfyui/`, all targeting **FLUX.2 Klein 4B**:

| Workflow | Description |
|---|---|
| `flux2-klein-txt2img` | Text prompt only |
| `flux2-klein-reference` | Text prompt + character reference image |
| `flux2-klein-reference-img2img` | Text prompt + character ref + init image (img2img) |

By default VidBoard uses `flux2-klein-reference` for both the Start and End frames. For storyboard continuity (where the Start frame seeds the End frame), set in `.env.local`:

```env
COMFYUI_START_WORKFLOW=flux2-klein-reference
COMFYUI_END_WORKFLOW=flux2-klein-reference-img2img
```

### Using a different model

The included workflows are built around FLUX.2 Klein, but VidBoard is not tied to any specific model. You can use any model supported by ComfyUI by exporting your own workflow in API format and registering it in `comfyui/workflows.json`. A helper script makes this straightforward:

```bash
pnpm run map-workflow comfyui/my-workflow.json
```

See [`comfyui/README.md`](comfyui/README.md) for full workflow documentation, the `workflows.json` schema, environment variables, and instructions for bringing your own workflow or model.


![line](https://capsule-render.vercel.app/api?type=egg&color=gradient&height=2)

## ➤ Recommended Hardware

- **GPU:** RTX 3080 Ti / 12 GB+ VRAM (FLUX.2 Klein FP8 uses ~10–11 GB)
- **RAM:** 16 GB+ system RAM
- **Storage:** ~8 GB for models


![line](https://capsule-render.vercel.app/api?type=egg&color=gradient&height=2)

## ➤ Architecture

- **Frontend:** Next.js 15 + React 19 + Tailwind CSS
- **Planning LLM:** Ollama (qwen3:8b) with web search grounding
- **Image generation:** ComfyUI + FLUX.2 Klein 4B FP8
- **No cloud dependencies**
