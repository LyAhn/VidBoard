# VidBoard

VidBoard is a local-first pre-production storyboard app for planning music video sequences from track details, lyrics, and visual direction.

## Prerequisites

- Node.js
- Ollama
- ComfyUI

## Run Locally

1. Install Ollama from https://ollama.com/download.
2. Pull the recommended planning model:
   ```bash
   ollama pull qwen3:8b
   ```
3. Install dependencies:
   ```bash
   pnpm install
   ```
4. Configure local services in `.env.local` using `.env.example` as a template. `OLLAMA_API_KEY` is required for Ollama web search and can be created with a free account at https://ollama.com.
5. Run the app:
   ```bash
   pnpm run dev
   ```
