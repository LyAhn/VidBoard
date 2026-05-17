import { Check, ChevronLeft, LayoutGrid, LayoutList, Pencil, Save } from "lucide-react";
import { useRef, useState } from "react";
import type { FrameData } from "@/lib/vidboard-types";
import type { CardLayout } from "@/components/StoryboardGrid";

interface StoryboardToolbarProps {
  frames: FrameData[];
  isGeneratingImages: boolean;
  cardLayout: CardLayout;
  onCardLayoutChange: (layout: CardLayout) => void;
  onGoToProjects: () => void;
  onManualSave: () => void;
  onRenameProject: (name: string) => void;
  saveStatus: "idle" | "saving" | "saved";
  projectName: string;
  onRetryImages: () => void;
  onExportPdf: () => void;
  onDownloadZip: () => void;
  onCopyFlowPrompts: () => void;
}

export function StoryboardToolbar({
  frames,
  isGeneratingImages,
  cardLayout,
  onCardLayoutChange,
  onGoToProjects,
  onManualSave,
  onRenameProject,
  saveStatus,
  projectName,
  onRetryImages,
  onExportPdf,
  onDownloadZip,
  onCopyFlowPrompts,
}: StoryboardToolbarProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelledRef = useRef(false);

  const startEdit = () => {
    cancelledRef.current = false;
    setDraft(projectName);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const commitEdit = () => {
    if (cancelledRef.current) return;
    setEditing(false);
    if (draft.trim() && draft.trim() !== projectName) {
      onRenameProject(draft.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") commitEdit();
    if (e.key === "Escape") { cancelledRef.current = true; setEditing(false); }
  };

  return (
    <header className="sticky top-0 z-20 h-16 border-b border-[#252525] flex items-center justify-between px-8 bg-[#171717]/70 backdrop-blur-md">
      <div className="flex items-center gap-6">
        <button
          aria-label="Back to projects"
          onClick={onGoToProjects}
          className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors shrink-0"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Projects
        </button>

        <div className="h-4 w-px bg-neutral-800 shrink-0" />

        {/* Project name + save indicator */}
        <div className="flex items-center gap-1.5 min-w-0 group/name">
          {editing ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={handleKeyDown}
              className="text-sm font-semibold bg-[#1e1e1e] border border-amber-500/50 rounded px-2 py-0.5 text-[#e5e5e5] outline-none w-48 max-w-[220px]"
              maxLength={80}
            />
          ) : (
            <button
              aria-label="Rename project"
              onClick={startEdit}
              className="flex items-center gap-1.5 min-w-0 text-left"
            >
              <span className="text-sm font-semibold text-[#e5e5e5] truncate max-w-[180px]" title={projectName}>
                {projectName}
              </span>
              <Pencil className="w-3 h-3 text-neutral-600 opacity-0 group-hover/name:opacity-100 transition-opacity shrink-0" />
            </button>
          )}

          {saveStatus === "saving" && (
            <span className="text-[9px] uppercase tracking-widest text-neutral-500 shrink-0">Saving…</span>
          )}
          {saveStatus === "saved" && (
            <span className="flex items-center gap-1 text-[9px] uppercase tracking-widest text-green-500 shrink-0">
              <Check className="w-3 h-3" /> Saved
            </span>
          )}
          {saveStatus === "idle" && !editing && (
            <button
              aria-label="Save project"
              onClick={onManualSave}
              title="Save project"
              className="shrink-0 p-1 rounded text-neutral-600 hover:text-amber-400 transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {frames.length > 0 && (
          <>
            <div className="h-4 w-px bg-neutral-800 shrink-0" />
            <div className="flex items-center gap-2 text-xs font-medium text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              Blueprint Ready
            </div>
            <span className="text-xs text-gray-500 hidden sm:block">{frames.length} Frames</span>
          </>
        )}

        {/* Layout toggle */}
        <div className="flex items-center gap-1 bg-[#1c1c1c] border border-[#2a2a2a] rounded p-0.5">
          <button
            aria-label="Switch to grid view"
            aria-pressed={cardLayout === "vertical"}
            onClick={() => onCardLayoutChange("vertical")}
            className={`p-1.5 rounded transition-colors ${
              cardLayout === "vertical"
                ? "bg-amber-500 text-black"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
          <button
            aria-label="Switch to list view"
            aria-pressed={cardLayout === "horizontal"}
            onClick={() => onCardLayoutChange("horizontal")}
            className={`p-1.5 rounded transition-colors ${
              cardLayout === "horizontal"
                ? "bg-amber-500 text-black"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            <LayoutList className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {frames.length > 0 && (
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
      )}
    </header>
  );
}
