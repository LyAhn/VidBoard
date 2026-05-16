import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const ollamaUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  const comfyUrl = process.env.COMFYUI_BASE_URL || "http://127.0.0.1:8188";

  const ping = (url: string) =>
    fetch(url, { signal: AbortSignal.timeout(4000) })
      .then((r) => r.ok)
      .catch(() => false);

  const [ollamaOk, comfyOk] = await Promise.all([
    ping(`${ollamaUrl}/api/version`),
    ping(`${comfyUrl}/system_stats`),
  ]);

  return NextResponse.json({
    ollama: ollamaOk ? "online" : "offline",
    comfyui: comfyOk ? "online" : "offline",
  });
}
