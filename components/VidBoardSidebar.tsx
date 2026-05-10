import { Activity, Loader2 } from "lucide-react";
import type { AppState, AspectRatio } from "@/lib/vidboard-types";
import { PlanningProgress } from "@/components/PlanningProgress";

interface VidBoardSidebarProps {
  state: AppState;
  planningElapsed: number;
  planningStepIndex: number;
  onGenerate: () => void;
  updateState: (updates: Partial<AppState>) => void;
}

export function VidBoardSidebar({
  state,
  planningElapsed,
  planningStepIndex,
  onGenerate,
  updateState,
}: VidBoardSidebarProps) {
  return (
    <div className="w-full md:w-[300px] flex-shrink-0 bg-[#0a0a0a] border-b md:border-b-0 md:border-r border-[#1a1a1a] flex flex-col z-10 transition-all md:h-full max-h-[50vh] md:max-h-full p-5 gap-5">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8 rounded bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center font-bold text-black text-xs italic">
          VB
        </div>
        <h1 className="text-xl font-black tracking-tighter text-white uppercase">VidBoard</h1>
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
            <p className="text-[9px] text-gray-500 italic">e.g. dark and ethereal, euphoric</p>
          </div>
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

      <button
        disabled={state.isPlanning || state.isGeneratingImages}
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
