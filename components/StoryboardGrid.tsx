import Image from "next/image";
import { AlertTriangle, ChevronDown, ChevronRight, Copy, ImageIcon, Loader2 } from "lucide-react";
import type { AspectRatio, FrameData } from "@/lib/vidboard-types";

interface StoryboardGridProps {
  frames: FrameData[];
  aspectRatio: AspectRatio;
  expandedDescriptions: Record<number, boolean>;
  onToggleDescription: (idx: number) => void;
}

const calculateCanvasStyle = (aspectRatio: AspectRatio) => {
  if (aspectRatio === "16:9") return "aspect-video";
  if (aspectRatio === "9:16") return "aspect-[9/16]";
  return "aspect-square";
};

const FrameImageState = ({
  imageBase64,
  error,
  isGenerating,
  label,
  frameNumber,
  lyricLine,
  aspectRatio,
}: {
  imageBase64?: string;
  error?: string;
  isGenerating?: boolean;
  label: "START" | "END";
  frameNumber: number;
  lyricLine?: string;
  aspectRatio: AspectRatio;
}) => (
  <div
    className={`relative flex-1 flex items-center justify-center bg-gradient-to-br from-indigo-900/40 to-black ${calculateCanvasStyle(aspectRatio)}`}
  >
    {imageBase64 ? (
      <Image
        src={imageBase64.includes("data:image") ? imageBase64 : `data:image/png;base64,${imageBase64}`}
        alt={`${label === "START" ? "Start" : "End"} Frame ${frameNumber}`}
        fill
        sizes="(max-width: 768px) 50vw, 25vw"
        className="object-cover"
        unoptimized
      />
    ) : error ? (
      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-red-950/40 text-red-400 p-3 text-[9px]"
        title={error}
      >
        <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
        <span className="text-center leading-tight line-clamp-4 break-words">{error}</span>
      </div>
    ) : isGenerating ? (
      <div className="absolute inset-0 flex items-center justify-center bg-neutral-900/50">
        <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
      </div>
    ) : (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-neutral-900/50 text-neutral-500">
        <ImageIcon className="w-5 h-5" />
        <span className="text-[9px] uppercase font-bold tracking-widest">Image pending</span>
      </div>
    )}
    {label === "START" && (
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none"></div>
    )}
    <div className="absolute top-2 left-2 bg-black/60 text-white font-bold text-[9px] px-1.5 py-0.5 rounded uppercase">
      {label}
    </div>
    {label === "START" && lyricLine && (
      <div className="absolute bottom-2 left-2 right-2">
        <p className="text-[10px] italic text-amber-200 line-clamp-1">&quot;{lyricLine}&quot;</p>
      </div>
    )}
  </div>
);

export function StoryboardGrid({
  frames,
  aspectRatio,
  expandedDescriptions,
  onToggleDescription,
}: StoryboardGridProps) {
  return (
    <div
      className={`grid gap-6 flex-1 overflow-hidden ${
        aspectRatio === "9:16"
          ? "grid-cols-2 md:grid-cols-4 lg:grid-cols-5"
          : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      }`}
    >
      {frames.map((frame, idx) => (
        <div key={idx} className="glass rounded-xl overflow-hidden flex flex-col group relative">
          <div className="flex w-full overflow-hidden border-b border-[#222] relative">
            <FrameImageState
              imageBase64={frame.startImageBase64}
              error={frame.error}
              isGenerating={frame.isGenerating}
              label="START"
              frameNumber={frame.frame_number}
              lyricLine={frame.lyric_line}
              aspectRatio={aspectRatio}
            />

            <div className="w-6 flex items-center justify-center bg-[#0a0a0a] z-10 border-l border-r border-[#222]">
              <span className="text-amber-500 font-bold text-sm">→</span>
            </div>

            <FrameImageState
              imageBase64={frame.endImageBase64}
              error={frame.error}
              isGenerating={frame.isGenerating}
              label="END"
              frameNumber={frame.frame_number}
              aspectRatio={aspectRatio}
            />

            <div className="absolute top-2 right-2 bg-amber-500 text-black font-black text-[10px] px-2 py-1 rounded shadow-lg uppercase z-20">
              FRAME {String(frame.frame_number).padStart(2, "0")} - {frame.timestamp_hint}
            </div>
          </div>

          <div className="p-4 flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex flex-wrap gap-1 items-center">
                  {frame.character_present && (
                    <span className="text-[9px] bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded border border-purple-500/30 font-semibold uppercase">
                      Character Present
                    </span>
                  )}
                  <span className="text-[9px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded border border-blue-500/30 font-semibold uppercase">
                    {frame.camera_angle}
                  </span>
                  <span className="text-[9px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded border border-amber-500/30 font-semibold uppercase">
                    {frame.lighting}
                  </span>
                </div>

                <div className="flex gap-1 h-2 opacity-60 ml-2 shrink-0">
                  <div className="w-2 h-full bg-blue-600 rounded-full" title={frame.colour_palette}></div>
                  <div className="w-2 h-full bg-purple-700 rounded-full" title={frame.colour_palette}></div>
                  <div className="w-2 h-full bg-amber-500 rounded-full" title={frame.colour_palette}></div>
                </div>
              </div>

              <p className="text-[11px] text-gray-400 line-clamp-3 leading-relaxed mb-2">
                {frame.scene_description}
              </p>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(frame.flow_prompt);
                  alert("Flow prompt copied!");
                }}
                className="w-full text-left mt-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded cursor-pointer hover:bg-amber-500/20 transition-colors group/flow"
              >
                <div className="text-[9px] font-bold text-amber-500 uppercase tracking-widest mb-1 flex items-center justify-between">
                  Flow Prompt <Copy className="w-3 h-3 opacity-0 group-hover/flow:opacity-100 transition-opacity" />
                </div>
                <div className="text-[11px] text-gray-300 font-medium">{frame.flow_prompt}</div>
              </button>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(frame.image_prompt);
                  alert("Image prompt copied!");
                }}
                className="flex-1 py-1.5 border border-[#333] hover:border-amber-500 text-[9px] font-bold uppercase rounded transition-colors"
              >
                Copy Prompt
              </button>
              <button
                className="p-1.5 border border-[#333] hover:border-amber-500 rounded transition-colors"
                onClick={() => onToggleDescription(idx)}
                title="Toggle full details"
              >
                {expandedDescriptions[idx] ? (
                  <ChevronDown className="w-3 h-3 text-gray-400" />
                ) : (
                  <ChevronRight className="w-3 h-3 text-gray-400" />
                )}
              </button>
            </div>

            {expandedDescriptions[idx] && (
              <div className="mt-3 text-[10px] text-gray-400 bg-black/50 p-2 rounded border border-white/10 break-all font-mono">
                {frame.image_prompt}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
