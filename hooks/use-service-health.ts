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

    const check = async () => {
      try {
        const res = await fetch("/api/health");
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
      }
    };

    void check();
    const timer = window.setInterval(check, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [intervalMs]);

  return health;
}
