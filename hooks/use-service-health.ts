"use client";

import { useEffect, useState } from "react";

type ServiceStatus = "online" | "offline" | "loading";

interface ServiceHealth {
  ollama: ServiceStatus;
  comfyui: ServiceStatus;
}

export function useServiceHealth(intervalMs = 30_000): ServiceHealth {
  const [health, setHealth] = useState<ServiceHealth>({
    ollama: "loading",
    comfyui: "loading",
  });

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    let controller: AbortController | null = null;

    const check = async () => {
      if (inFlight) return;
      inFlight = true;
      controller = new AbortController();
      try {
        const res = await fetch("/api/health", {
          signal: controller.signal,
          cache: "no-store",
        });
        if (cancelled) return;
        if (res.ok) {
          const data = (await res.json()) as { ollama: string; comfyui: string };
          setHealth({
            ollama: data.ollama === "online" ? "online" : "offline",
            comfyui: data.comfyui === "online" ? "online" : "offline",
          });
        } else {
          setHealth({ ollama: "offline", comfyui: "offline" });
        }
      } catch {
        if (!cancelled) setHealth({ ollama: "offline", comfyui: "offline" });
      } finally {
        inFlight = false;
      }
    };

    void check();
    const timer = window.setInterval(() => void check(), intervalMs);
    return () => {
      cancelled = true;
      controller?.abort();
      clearInterval(timer);
    };
  }, [intervalMs]);

  return health;
}
