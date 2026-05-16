import type { FrameData } from "@/lib/vidboard-types";

interface StoryboardToolbarProps {
  frames: FrameData[];
  isGeneratingImages: boolean;
  onRetryImages: () => void;
  onExportPdf: () => void;
  onDownloadZip: () => void;
  onCopyFlowPrompts: () => void;
}

export function StoryboardToolbar({
  frames,
  isGeneratingImages,
  onRetryImages,
  onExportPdf,
  onDownloadZip,
  onCopyFlowPrompts,
}: StoryboardToolbarProps) {
  if (!frames.length) return null;

  return (
    <header className="sticky top-0 z-20 h-16 border-b border-[#252525] flex items-center justify-between px-8 bg-[#171717]/70 backdrop-blur-md">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 text-xs font-medium text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
          Blueprint Ready
        </div>
        <span className="text-xs text-gray-500 hidden sm:block">{frames.length} Frames Generated</span>
      </div>
      <div className="flex items-center gap-3">
        {frames.some((frame) => frame.error) && !isGeneratingImages && (
          <button
            onClick={onRetryImages}
            className="text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/30 hover:bg-amber-500/20 px-4 py-2 rounded uppercase tracking-tighter transition-colors"
          >
            Retry Failed
          </button>
        )}
        <button
          onClick={onExportPdf}
          className="text-[10px] font-bold border border-[#333] hover:border-amber-500 px-4 py-2 rounded uppercase tracking-tighter transition-colors"
        >
          PDF Export
        </button>
        <button
          onClick={onDownloadZip}
          className="text-[10px] hidden sm:block font-bold border border-[#333] hover:border-amber-500 px-4 py-2 rounded uppercase tracking-tighter transition-colors"
        >
          ZIP Frames
        </button>
        <button
          onClick={onCopyFlowPrompts}
          className="text-[10px] font-bold bg-[#eee] hover:bg-white text-black px-4 py-2 rounded uppercase tracking-tighter transition-colors"
        >
          Copy Flow Prompts
        </button>
      </div>
    </header>
  );
}
