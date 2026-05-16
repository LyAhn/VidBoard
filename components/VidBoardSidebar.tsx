import { Activity, Loader2 } from "lucide-react";
import type { AppState, AspectRatio, VisualDirection } from "@/lib/vidboard-types";
import { useServiceHealth } from "@/hooks/use-service-health";
import { PlanningProgress } from "@/components/PlanningProgress";

interface VidBoardSidebarProps {
  state: AppState;
  planningElapsed: number;
  planningStepIndex: number;
  onGenerate: () => void;
  updateState: (updates: Partial<AppState>) => void;
}

type DotColor = "green" | "red" | "yellow";

function StatusDot({ color, label }: { color: DotColor; label: string }) {
  const bg: Record<DotColor, string> = {
    green: "bg-green-500",
    red: "bg-red-500",
    yellow: "bg-yellow-500",
  };
  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full ${bg[color]} ${color === "green" ? "animate-pulse" : ""}`} />
      <span className="text-[9px] uppercase tracking-wide text-neutral-400">{label}</span>
    </span>
  );
}

export function VidBoardSidebar({
  state,
  planningElapsed,
  planningStepIndex,
  onGenerate,
  updateState,
}: VidBoardSidebarProps) {
  const health = useServiceHealth();

  const ollamaColor: DotColor =
    health.ollama === "online" ? "green" : health.ollama === "loading" ? "yellow" : "red";
  const comfyColor: DotColor =
    health.comfyui === "online" ? "green" : health.comfyui === "loading" ? "yellow" : "red";

  const servicesReady = health.ollama === "online" && health.comfyui === "online";
  const isDisabled = state.isPlanning || state.isGeneratingImages || !servicesReady;

  return (
    <div className="w-full md:w-[300px] flex-shrink-0 bg-[#0a0a0a] border-b md:border-b-0 md:border-r border-[#1a1a1a] flex flex-col z-10 transition-all md:h-full max-h-[50vh] md:max-h-full p-5 gap-5">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8 rounded bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center font-bold text-black text-xs italic">
          VB
        </div>
        <h1 className="text-xl font-black tracking-tighter text-white uppercase">VidBoard</h1>
      </div>

      <div className="flex items-center gap-4 px-2 py-1.5 rounded bg-[#111] border border-[#1e1e1e]">
        <StatusDot color={ollamaColor} label="Ollama" />
        <StatusDot color={comfyColor} label="ComfyUI" />
      </div>

      <div className="flex-1 overflow-y-auto space-y-4">
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="input-label">Artist Name</label>
            <input
              value={state.artistName}
              onChange={(e) => updateState({ artistName: e.target.value })}
              className="w-full bg-[#151515] border border-[#222] rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-500 transition-colors"
              placeholder="e.g. The Weeknd"
            />
          </div>
          <div className="space-y-1">
            <label className="input-label">Track Title</label>
            <input
              value={state.trackTitle}
              onChange={(e) => updateState({ trackTitle: e.target.value })}
              className="w-full bg-[#151515] border border-[#222] rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-500 transition-colors"
              placeholder="e.g. Blinding Lights"
            />
          </div>
          <div className="space-y-1">
            <label className="input-label">Paste Lyrics</label>
            <textarea
              value={state.lyrics}
              onChange={(e) => updateState({ lyrics: e.target.value })}
              rows={8}
              className="w-full bg-[#151515] border border-[#222] rounded px-3 py-2 text-xs focus:outline-none focus:border-amber-500 transition-colors resize-none font-mono"
              placeholder="Paste song lyrics here..."
            />
          </div>
          <div className="space-y-1">
            <label className="input-label">Video Theme / Mood</label>
            <input
              value={state.theme}
              onChange={(e) => updateState({ theme: e.target.value })}
              className="w-full bg-[#151515] border border-[#222] rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-500 transition-colors"
              placeholder="e.g. dark and ethereal, euphoric"
            />
          </div>
          <div className="space-y-1">
            <label className="input-label">Visual Direction</label>
            <div className="grid grid-cols-3 gap-1" role="radiogroup" aria-label="Visual Direction">
              {(
                [
                  { value: "artist", label: "Artist Look" },
                  { value: "lyrics", label: "Lyrics-Led" },
                  { value: "theme", label: "Theme-Led" },
                ] as { value: VisualDirection; label: string }[]
              ).map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={state.visualDirection === value}
                  onClick={() => updateState({ visualDirection: value })}
                  className={`py-1.5 rounded text-[10px] font-semibold uppercase tracking-wide border transition-colors ${
                    state.visualDirection === value
                      ? "bg-amber-500 border-amber-500 text-black"
                      : "bg-[#151515] border-[#222] text-gray-400 hover:border-amber-500/50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-[9px] text-gray-500 italic">
              {state.visualDirection === "artist" && "Match the artist's existing visual identity"}
              {state.visualDirection === "lyrics" && "Imagery driven by this track's specific lyrics"}
              {state.visualDirection === "theme" && "Your theme overrides the artist's typical look"}
            </p>
          </div>
          {!state.lyrics.trim() && (
            <div className="space-y-1">
              <label className="input-label">Visual Concept / Arc</label>
              <textarea
                value={state.visualConcept}
                onChange={(e) => updateState({ visualConcept: e.target.value })}
                rows={4}
                className="w-full bg-[#151515] border border-amber-500/30 rounded px-3 py-2 text-xs focus:outline-none focus:border-amber-500 transition-colors resize-none font-mono"
                placeholder="Instrumental track — describe the emotional journey or visual narrative (e.g. builds from desolate emptiness to euphoric release, urban nightscapes, fragmented memories)"
              />
              <p className="text-[9px] text-gray-500 italic">Replaces lyrics for instrumental tracks</p>
            </div>
          )}
        </div>

        <div className="flex gap-4">
          <div className="flex-1 space-y-1">
            <label className="input-label">Frames ({state.numberOfFrames})</label>
            <input
              type="number"
              min="4"
              max="16"
              step="1"
              value={state.numberOfFrames}
              onChange={(e) => updateState({ numberOfFrames: parseInt(e.target.value) })}
              className="w-full bg-[#151515] border border-[#222] rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
            />
          </div>
          <div className="flex-1 space-y-1">
            <label className="input-label">Ratio</label>
            <select
              value={state.aspectRatio}
              onChange={(e) => updateState({ aspectRatio: e.target.value as AspectRatio })}
              className="w-full bg-[#151515] border border-[#222] rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
            >
              <option value="16:9">16:9</option>
              <option value="9:16">9:16</option>
              <option value="1:1">1:1</option>
            </select>
          </div>
        </div>
      </div>

      {state.isPlanning && (
        <PlanningProgress elapsed={planningElapsed} stepIndex={planningStepIndex} />
      )}

      {!servicesReady && health.ollama !== "loading" && health.comfyui !== "loading" && (
        <p className="text-[9px] text-red-400/80 text-center">
          {health.ollama === "offline" && health.comfyui === "offline"
            ? "Ollama and ComfyUI are offline"
            : health.ollama === "offline"
              ? "Ollama is offline — run: ollama serve"
              : "ComfyUI is offline — run: python main.py --listen"}
        </p>
      )}

      <button
        disabled={isDisabled}
        onClick={onGenerate}
        className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-3 rounded-md amber-glow uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {state.statusMessage ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> {state.statusMessage}
          </>
        ) : (
          <>
            <Activity className="w-4 h-4" /> Generate Blueprint
          </>
        )}
      </button>
    </div>
  );
}
