"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  AlertTriangle,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  ImageIcon,
  Loader2,
  Palette,
  Pencil,
  RefreshCw,
  Sun,
  User,
  X,
  ZoomIn,
} from "lucide-react";
import type { AspectRatio, FrameData } from "@/lib/vidboard-types";
import { useCopyFeedback } from "@/hooks/use-copy-feedback";

export type CardLayout = "vertical" | "horizontal";

interface StoryboardGridProps {
  frames: FrameData[];
  aspectRatio: AspectRatio;
  expandedDescriptions: Record<number, boolean>;
  onToggleDescription: (idx: number) => void;
  cardLayout: CardLayout;
  onRegenerateFrame: (frameIdx: number, side: "start" | "end") => void;
  onUpdateFrame: (frameIdx: number, updates: Partial<FrameData>) => void;
  editCapable?: boolean;
  onEditFrame?: (frameIdx: number, side: "start" | "end", instruction: string) => void;
}

// ── Helpers ───────────────────────────────────────────────

const canvasClass = (aspectRatio: AspectRatio) => {
  if (aspectRatio === "16:9") return "aspect-video";
  if (aspectRatio === "9:16") return "aspect-[9/16]";
  return "aspect-square";
};

const toSrc = (b64OrPath: string) => {
  if (b64OrPath.startsWith("/api/images/") || b64OrPath.startsWith("http")) return b64OrPath;
  if (b64OrPath.includes("data:image")) return b64OrPath;
  return `data:image/png;base64,${b64OrPath}`;
};

const resolveImageSrc = (imageBase64?: string, imagePath?: string): string | undefined => {
  if (imageBase64) return toSrc(imageBase64);
  if (imagePath) return `/api/images/${imagePath}`;
  return undefined;
};

// ── EditableText ──────────────────────────────────────────
// Click-to-edit textarea. Commits on blur or Ctrl+Enter, cancels on Escape.

function EditableText({
  value,
  onCommit,
  label,
  className,
}: {
  value: string;
  onCommit: (v: string) => void;
  label: string;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);
  const cancelledRef = useRef(false);

  const start = () => {
    cancelledRef.current = false;
    setDraft(value);
    setEditing(true);
    setTimeout(() => {
      ref.current?.focus();
      ref.current?.select();
    }, 0);
  };

  const commit = () => {
    if (cancelledRef.current) return;
    setEditing(false);
    if (draft.trim() !== value.trim()) onCommit(draft.trim());
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") { cancelledRef.current = true; setEditing(false); setDraft(value); }
    if (e.key === "Enter" && e.ctrlKey) commit();
  };

  if (editing) {
    return (
      <textarea
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKey}
        aria-label={label}
        rows={3}
        className={`w-full resize-none rounded border border-amber-500/40 bg-[#1e1e1e] px-2 py-1.5 text-[11px] text-gray-200 outline-none focus:border-amber-500/70 ${className ?? ""}`}
      />
    );
  }

  return (
    <button
      aria-label={`Edit ${label}`}
      onClick={start}
      className={`w-full text-left rounded border border-transparent hover:border-neutral-700 px-1 py-0.5 transition-colors group/edit ${className ?? ""}`}
    >
      <span className="text-[11px] text-gray-300 leading-relaxed">{value}</span>
      <span className="ml-1 text-[9px] text-neutral-600 opacity-0 group-hover/edit:opacity-100 transition-opacity uppercase tracking-wider">edit</span>
    </button>
  );
}

// ── Lightbox ──────────────────────────────────────────────

interface LightboxState {
  src: string;
  alt: string;
}

function Lightbox({ src, alt, onClose }: LightboxState & { onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-6 cursor-zoom-out"
      onClick={onClose}
    >
      <button
        aria-label="Close lightbox"
        className="absolute top-4 right-4 bg-neutral-800 hover:bg-neutral-700 rounded-full p-2 transition-colors cursor-pointer"
        onClick={onClose}
      >
        <X className="w-5 h-5 text-white" />
      </button>
      <div
        className="relative max-h-[90vh] max-w-5xl w-full flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <Image
          src={toSrc(src)}
          alt={alt}
          width={1920}
          height={1080}
          className="object-contain max-h-[90vh] w-auto rounded"
          unoptimized
        />
      </div>
    </div>
  );
}

// ── FrameImageState ───────────────────────────────────────

function FrameImageState({
  imageBase64,
  imagePath,
  error,
  isGenerating,
  label,
  frameNumber,
  lyricLine,
  aspectRatio,
  onLightbox,
  onRegenerate,
  onEdit,
  history,
  onRestoreFromHistory,
}: {
  imageBase64?: string;
  imagePath?: string;
  error?: string;
  isGenerating?: boolean;
  label: "START" | "END";
  frameNumber: number;
  lyricLine?: string;
  aspectRatio: AspectRatio;
  onLightbox?: (src: string, alt: string) => void;
  onRegenerate?: () => void;
  onEdit?: (instruction: string) => void;
  history?: string[];
  onRestoreFromHistory?: (path: string) => void;
}) {
  // Initialise to wherever imagePath sits in history, falling back to the last entry.
  // The component is keyed on imagePath in parent cards, so it remounts when the
  // active image changes (new regen or "Use"), keeping this initializer as the only
  // source of truth and avoiding a setState-inside-effect anti-pattern.
  const [historyIdx, setHistoryIdx] = useState(() => {
    if (history && history.length > 0) {
      const idx = imagePath ? history.lastIndexOf(imagePath) : -1;
      return idx >= 0 ? idx : history.length - 1;
    }
    return 0;
  });

  const [editOpen, setEditOpen] = useState(false);
  const [editInstruction, setEditInstruction] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  const submitEdit = () => {
    const instruction = editInstruction.trim();
    if (!instruction || !onEdit) return;
    onEdit(instruction);
    setEditInstruction("");
    setEditOpen(false);
  };

  const hasHistory = history && history.length > 1;
  const alt = `${label === "START" ? "Start" : "End"} Frame ${frameNumber}`;
  // When at the last entry, prefer in-memory base64 to avoid a round-trip to disk.
  const src = history && history.length > 0
    ? historyIdx === history.length - 1
      ? resolveImageSrc(imageBase64, history[historyIdx])
      : `/api/images/${history[historyIdx]}`
    : resolveImageSrc(imageBase64, imagePath);
  // Is the currently-viewed history entry the one marked active (imagePath)?
  const isActiveEntry = !history || !imagePath || history[historyIdx] === imagePath;
  const clickable = !!src && !!onLightbox;

  return (
    <div
      className={`group/img relative flex-1 flex items-center justify-center bg-gradient-to-br from-indigo-900/40 to-black ${canvasClass(aspectRatio)} ${clickable ? "cursor-zoom-in" : ""}`}
      onClick={clickable ? () => onLightbox!(src, alt) : undefined}
    >
      {src ? (
        <>
          <Image
            src={src}
            alt={alt}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-cover"
            unoptimized
          />
          {isGenerating ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 pointer-events-none">
              <div className="relative flex items-center justify-center">
                <div className="absolute w-10 h-10 rounded-full border-2 border-amber-500/30 animate-ping" />
                <div
                  className="w-8 h-8 rounded-full border-2 border-transparent border-t-amber-400"
                  style={{ animation: "spin 0.8s linear infinite" }}
                />
              </div>
            </div>
          ) : clickable && (
            <div className="absolute inset-0 bg-black/0 hover:bg-black/25 transition-colors flex items-center justify-center opacity-0 hover:opacity-100 pointer-events-none">
              <ZoomIn className="w-7 h-7 text-white drop-shadow-lg" />
            </div>
          )}
        </>
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
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
      )}
      <div className="absolute top-2 left-2 bg-black/60 text-white font-bold text-[9px] px-1.5 py-0.5 rounded uppercase pointer-events-none">
        {label}
      </div>
      {label === "START" && lyricLine && !hasHistory && (
        <div className="absolute bottom-2 left-2 right-2 pointer-events-none">
          <p className="text-[10px] italic text-amber-200 line-clamp-1">&quot;{lyricLine}&quot;</p>
        </div>
      )}

      {/* History navigation — appears on hover when more than one iteration exists */}
      {hasHistory && (
        <div className="absolute bottom-2 left-0 right-0 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity z-10">
          <div
            className="flex items-center gap-1 bg-black/80 rounded-full px-2 py-1"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              aria-label="Previous iteration"
              disabled={historyIdx === 0}
              onClick={() => setHistoryIdx((i) => Math.max(0, i - 1))}
              className="disabled:opacity-30 hover:text-amber-400 transition-colors"
            >
              <ChevronLeft className="w-3 h-3 text-white" />
            </button>
            <span className="text-[9px] font-bold tabular-nums select-none text-white">
              {historyIdx + 1}/{history.length}
            </span>
            {isActiveEntry && (
              <span className="text-[9px] text-amber-400" title="Active">✓</span>
            )}
            <button
              aria-label="Next iteration"
              disabled={historyIdx === history.length - 1}
              onClick={() => setHistoryIdx((i) => Math.min(history.length - 1, i + 1))}
              className="disabled:opacity-30 hover:text-amber-400 transition-colors"
            >
              <ChevronRight className="w-3 h-3 text-white" />
            </button>
            {!isActiveEntry && onRestoreFromHistory && (
              <button
                onClick={() => onRestoreFromHistory(history[historyIdx])}
                className="ml-1 text-[9px] font-bold text-amber-400 hover:text-amber-300 uppercase tracking-wide transition-colors"
              >
                Use
              </button>
            )}
          </div>
        </div>
      )}

      {onRegenerate && !isGenerating && (
        <button
          aria-label={`Regenerate ${label.toLowerCase()} frame`}
          onClick={(e) => { e.stopPropagation(); onRegenerate(); }}
          className="absolute top-2 right-2 opacity-0 group-hover/img:opacity-100 group-focus-within/img:opacity-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500 transition-opacity bg-black/70 hover:bg-black/90 rounded p-1 z-10"
        >
          <RefreshCw className="w-3 h-3 text-white" />
        </button>
      )}

      {onEdit && src && !isGenerating && !editOpen && (
        <button
          aria-label={`Edit ${label.toLowerCase()} frame`}
          onClick={(e) => {
            e.stopPropagation();
            setEditOpen(true);
            setTimeout(() => editInputRef.current?.focus(), 0);
          }}
          className="absolute top-2 right-8 opacity-0 group-hover/img:opacity-100 group-focus-within/img:opacity-100 focus-visible:opacity-100 transition-opacity bg-black/70 hover:bg-black/90 rounded p-1 z-10"
        >
          <Pencil className="w-3 h-3 text-white" />
        </button>
      )}

      {editOpen && (
        <div
          className="absolute inset-0 z-20 flex flex-col items-center justify-end pb-3 px-2 bg-black/70"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-full flex gap-1">
            <input
              ref={editInputRef}
              type="text"
              value={editInstruction}
              onChange={(e) => setEditInstruction(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitEdit();
                if (e.key === "Escape") { setEditOpen(false); setEditInstruction(""); }
              }}
              placeholder="Describe the edit…"
              className="flex-1 min-w-0 bg-[#111] border border-amber-500/50 rounded px-2 py-1 text-[10px] text-white placeholder-neutral-500 outline-none focus:border-amber-400"
            />
            <button
              onClick={submitEdit}
              disabled={!editInstruction.trim()}
              className="shrink-0 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black rounded px-2 py-1 text-[10px] font-bold transition-colors"
            >
              Edit
            </button>
            <button
              onClick={() => { setEditOpen(false); setEditInstruction(""); }}
              className="shrink-0 bg-neutral-700 hover:bg-neutral-600 text-white rounded p-1 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────

function FrameLabel({ frame }: { frame: FrameData }) {
  return (
    <div className="flex items-center justify-between px-0.5">
      <span className="text-[10px] font-black text-amber-500 uppercase tracking-wider">
        Frame {String(frame.frame_number).padStart(2, "0")}
      </span>
      <span className="text-[10px] font-semibold text-amber-400/60 uppercase tracking-wide">
        {frame.timestamp_hint}
      </span>
    </div>
  );
}

function BadgeStrip({ frame }: { frame: FrameData }) {
  return (
    <div className="flex flex-wrap gap-1 items-center">
      {frame.character_present && (
        <span className="flex items-center gap-1 text-[9px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded border border-purple-500/30 font-semibold uppercase">
          <User className="w-2.5 h-2.5 shrink-0" />
          Character
        </span>
      )}
      <span
        className="flex items-center gap-1 text-[9px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/30 font-semibold uppercase max-w-[130px]"
        title={frame.camera_angle}
      >
        <Camera className="w-2.5 h-2.5 shrink-0" />
        <span className="truncate">{frame.camera_angle}</span>
      </span>
      <span
        className="flex items-center gap-1 text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/30 font-semibold uppercase max-w-[130px]"
        title={frame.lighting}
      >
        <Sun className="w-2.5 h-2.5 shrink-0" />
        <span className="truncate">{frame.lighting}</span>
      </span>
      <span
        className="flex items-center gap-1 text-[9px] text-neutral-500 px-1.5 py-0.5 rounded border border-neutral-700/40 font-medium max-w-[140px]"
        title={frame.colour_palette}
      >
        <Palette className="w-2.5 h-2.5 shrink-0" />
        <span className="truncate">{frame.colour_palette}</span>
      </span>
    </div>
  );
}

function CardFooter({
  frame,
  idx,
  expanded,
  onToggleDescription,
  onUpdateFrame,
}: {
  frame: FrameData;
  idx: number;
  expanded: boolean;
  onToggleDescription: (idx: number) => void;
  onUpdateFrame: (frameIdx: number, updates: Partial<FrameData>) => void;
}) {
  const [flowCopied, copyFlow] = useCopyFeedback();
  const [imgCopied, copyImg] = useCopyFeedback();

  return (
    <>
      <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded">
        <div className="text-[9px] font-bold text-amber-500 uppercase tracking-widest mb-1 flex items-center justify-between">
          Flow Prompt
          <button
            aria-label="Copy flow prompt"
            onClick={() => copyFlow(frame.flow_prompt)}
            className="opacity-40 hover:opacity-100 transition-opacity"
          >
            {flowCopied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
        <EditableText
          value={frame.flow_prompt}
          onCommit={(v) => onUpdateFrame(idx, { flow_prompt: v })}
          label="flow prompt"
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => copyImg(frame.image_prompt)}
          className="flex-1 py-1.5 border border-[#2a2a2a] hover:border-amber-500 text-[9px] font-bold uppercase rounded transition-colors"
        >
          {imgCopied ? "Copied ✓" : "Copy Image Prompt"}
        </button>
        <button
          aria-label={expanded ? "Collapse image prompt" : "Expand image prompt"}
          aria-expanded={expanded}
          className="p-1.5 border border-[#2a2a2a] hover:border-amber-500 rounded transition-colors"
          onClick={() => onToggleDescription(idx)}
        >
          {expanded ? (
            <ChevronDown className="w-3 h-3 text-gray-400" />
          ) : (
            <ChevronRight className="w-3 h-3 text-gray-400" />
          )}
        </button>
      </div>

      {expanded && (
        <div className="bg-neutral-900/60 p-2 rounded border border-white/10 flex flex-col gap-2">
          {frame.scene_story_beat && (
            <div>
              <div className="text-[9px] font-bold text-purple-400 uppercase tracking-widest mb-1">Story Beat</div>
              <p className="text-[10px] text-neutral-400 italic leading-relaxed">{frame.scene_story_beat}</p>
            </div>
          )}
          <div>
          <div className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Image Prompt</div>
          <EditableText
            value={frame.image_prompt}
            onCommit={(v) => onUpdateFrame(idx, { image_prompt: v })}
            label="image prompt"
            className="font-mono"
          />
          </div>
        </div>
      )}
    </>
  );
}

// ── Vertical card footer (extracted so hooks run per-card) ──

function VerticalCardFooter({
  frame,
  idx,
  expanded,
  onToggleDescription,
  onUpdateFrame,
}: {
  frame: FrameData;
  idx: number;
  expanded: boolean;
  onToggleDescription: (idx: number) => void;
  onUpdateFrame: (frameIdx: number, updates: Partial<FrameData>) => void;
}) {
  const [flowCopied, copyFlow] = useCopyFeedback();
  const [imgCopied, copyImg] = useCopyFeedback();

  return (
    <div className="px-2.5 py-2 flex flex-col gap-1.5 border-t border-[#2a2a2a]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {frame.character_present && (
            <span title="Character present" className="text-purple-400">
              <User className="w-3 h-3" />
            </span>
          )}
          <span title={frame.camera_angle} className="text-blue-400">
            <Camera className="w-3 h-3" />
          </span>
          <span title={frame.lighting} className="text-amber-400">
            <Sun className="w-3 h-3" />
          </span>
          <span title={frame.colour_palette} className="text-neutral-500">
            <Palette className="w-3 h-3" />
          </span>
          <span className="text-[9px] text-neutral-600 truncate min-w-0 ml-1" title={frame.colour_palette}>
            {frame.colour_palette}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => copyFlow(frame.flow_prompt)}
            title="Copy Flow prompt"
            className="p-1 border border-[#2a2a2a] hover:border-amber-500 rounded transition-colors"
          >
            {flowCopied
              ? <Check className="w-3 h-3 text-green-400" />
              : <Copy className="w-3 h-3 text-amber-500" />}
          </button>
          <button
            onClick={() => copyImg(frame.image_prompt)}
            title="Copy image prompt"
            className="p-1 border border-[#2a2a2a] hover:border-amber-500 rounded transition-colors text-[8px] font-bold uppercase px-1.5"
          >
            {imgCopied
              ? <Check className="w-3 h-3 text-green-400" />
              : <span className="text-neutral-500">IMG</span>}
          </button>
          <button
            aria-label={expanded ? "Collapse details" : "Expand details"}
            aria-expanded={expanded}
            className="p-1 border border-[#2a2a2a] hover:border-amber-500 rounded transition-colors"
            onClick={() => onToggleDescription(idx)}
          >
            {expanded
              ? <ChevronDown className="w-3 h-3 text-gray-500" />
              : <ChevronRight className="w-3 h-3 text-gray-500" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="flex flex-col gap-1.5 pt-1 border-t border-[#2a2a2a]">
          <p className="text-[10px] text-gray-400 leading-relaxed">{frame.scene_description}</p>
          {frame.scene_story_beat && (
            <div>
              <div className="text-[9px] font-bold text-purple-400 uppercase tracking-widest mb-0.5">Story Beat</div>
              <p className="text-[10px] text-neutral-400 italic leading-relaxed">{frame.scene_story_beat}</p>
            </div>
          )}
          <div className="text-[9px] font-bold text-amber-500 uppercase tracking-widest">Flow Prompt</div>
          <EditableText
            value={frame.flow_prompt}
            onCommit={(v) => onUpdateFrame(idx, { flow_prompt: v })}
            label="flow prompt"
          />
          <div className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest">Image Prompt</div>
          <EditableText
            value={frame.image_prompt}
            onCommit={(v) => onUpdateFrame(idx, { image_prompt: v })}
            label="image prompt"
            className="font-mono"
          />
        </div>
      )}
    </div>
  );
}

// ── Vertical card (Option A — image-heavy) ────────────────
// Images dominate. Footer is a compact strip — icon-only badges,
// truncated flow prompt, and copy actions. Description hidden by default.

function VerticalFrameCard({
  frame,
  idx,
  aspectRatio,
  expanded,
  onToggleDescription,
  onLightbox,
  onRegenerateFrame,
  onUpdateFrame,
  onEditFrame,
}: {
  frame: FrameData;
  idx: number;
  aspectRatio: AspectRatio;
  expanded: boolean;
  onToggleDescription: (idx: number) => void;
  onLightbox: (src: string, alt: string) => void;
  onRegenerateFrame: (frameIdx: number, side: "start" | "end") => void;
  onUpdateFrame: (frameIdx: number, updates: Partial<FrameData>) => void;
  onEditFrame?: (frameIdx: number, side: "start" | "end", instruction: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <FrameLabel frame={frame} />
      <div className="glass rounded-xl overflow-hidden flex flex-col">
        {/* Image pair — stacked full-width so thumbnails are as large as possible */}
        <div className="flex flex-col w-full">
          <FrameImageState
            key={frame.startImagePath ?? `start-${frame.frame_number}`}
            imageBase64={frame.startImageBase64}
            imagePath={frame.startImagePath}
            error={frame.error}
            isGenerating={frame.isGeneratingStart}
            label="START"
            frameNumber={frame.frame_number}
            lyricLine={frame.lyric_line}
            aspectRatio={aspectRatio}
            onLightbox={onLightbox}
            onRegenerate={() => onRegenerateFrame(idx, "start")}
            onEdit={onEditFrame ? (instruction) => onEditFrame(idx, "start", instruction) : undefined}
            history={frame.startImageHistory}
            onRestoreFromHistory={(path) => onUpdateFrame(idx, { startImagePath: path, startImageBase64: undefined })}
          />
          <div className="h-5 flex items-center justify-center bg-[#171717] border-y border-[#2a2a2a] shrink-0">
            <span className="text-amber-500 font-bold text-xs">↓</span>
          </div>
          <FrameImageState
            key={frame.endImagePath ?? `end-${frame.frame_number}`}
            imageBase64={frame.endImageBase64}
            imagePath={frame.endImagePath}
            error={frame.error}
            isGenerating={frame.isGeneratingEnd}
            label="END"
            frameNumber={frame.frame_number}
            aspectRatio={aspectRatio}
            onLightbox={onLightbox}
            onRegenerate={() => onRegenerateFrame(idx, "end")}
            onEdit={onEditFrame ? (instruction) => onEditFrame(idx, "end", instruction) : undefined}
            history={frame.endImageHistory}
            onRestoreFromHistory={(path) => onUpdateFrame(idx, { endImagePath: path, endImageBase64: undefined })}
          />
        </div>

        {/* Compact footer strip */}
        <VerticalCardFooter
          frame={frame}
          idx={idx}
          expanded={expanded}
          onToggleDescription={onToggleDescription}
          onUpdateFrame={onUpdateFrame}
        />
      </div>
    </div>
  );
}

// ── Horizontal card (Option B — side-by-side) ─────────────

function HorizontalFrameCard({
  frame,
  idx,
  aspectRatio,
  expanded,
  onToggleDescription,
  onLightbox,
  onRegenerateFrame,
  onUpdateFrame,
  onEditFrame,
}: {
  frame: FrameData;
  idx: number;
  aspectRatio: AspectRatio;
  expanded: boolean;
  onToggleDescription: (idx: number) => void;
  onLightbox: (src: string, alt: string) => void;
  onRegenerateFrame: (frameIdx: number, side: "start" | "end") => void;
  onUpdateFrame: (frameIdx: number, updates: Partial<FrameData>) => void;
  onEditFrame?: (frameIdx: number, side: "start" | "end", instruction: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <FrameLabel frame={frame} />
      <div className="glass rounded-xl overflow-hidden flex flex-row">
        {/* Left: stacked image pair */}
        <div className="w-2/5 flex-shrink-0 flex flex-col border-r border-[#2a2a2a]">
          <FrameImageState
            key={frame.startImagePath ?? `start-${frame.frame_number}`}
            imageBase64={frame.startImageBase64}
            imagePath={frame.startImagePath}
            error={frame.error}
            isGenerating={frame.isGeneratingStart}
            label="START"
            frameNumber={frame.frame_number}
            lyricLine={frame.lyric_line}
            aspectRatio={aspectRatio}
            onLightbox={onLightbox}
            onRegenerate={() => onRegenerateFrame(idx, "start")}
            onEdit={onEditFrame ? (instruction) => onEditFrame(idx, "start", instruction) : undefined}
            history={frame.startImageHistory}
            onRestoreFromHistory={(path) => onUpdateFrame(idx, { startImagePath: path, startImageBase64: undefined })}
          />
          <div className="h-5 flex items-center justify-center bg-[#171717] border-y border-[#2a2a2a] shrink-0">
            <span className="text-amber-500 font-bold text-xs">↓</span>
          </div>
          <FrameImageState
            key={frame.endImagePath ?? `end-${frame.frame_number}`}
            imageBase64={frame.endImageBase64}
            imagePath={frame.endImagePath}
            error={frame.error}
            isGenerating={frame.isGeneratingEnd}
            label="END"
            frameNumber={frame.frame_number}
            aspectRatio={aspectRatio}
            onLightbox={onLightbox}
            onRegenerate={() => onRegenerateFrame(idx, "end")}
            onEdit={onEditFrame ? (instruction) => onEditFrame(idx, "end", instruction) : undefined}
            history={frame.endImageHistory}
            onRestoreFromHistory={(path) => onUpdateFrame(idx, { endImagePath: path, endImageBase64: undefined })}
          />
        </div>

        {/* Right: metadata panel */}
        <div className="flex-1 p-3 flex flex-col gap-2 min-w-0 overflow-hidden">
          <BadgeStrip frame={frame} />
          <p className="text-[11px] text-gray-400 line-clamp-4 leading-relaxed">
            {frame.scene_description}
          </p>
          <CardFooter
            frame={frame}
            idx={idx}
            expanded={expanded}
            onToggleDescription={onToggleDescription}
            onUpdateFrame={onUpdateFrame}
          />
        </div>
      </div>
    </div>
  );
}

// ── StoryboardGrid ────────────────────────────────────────

export function StoryboardGrid({
  frames,
  aspectRatio,
  expandedDescriptions,
  onToggleDescription,
  cardLayout,
  onRegenerateFrame,
  onUpdateFrame,
  editCapable,
  onEditFrame,
}: StoryboardGridProps) {
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);

  const openLightbox = (src: string, alt: string) => setLightbox({ src, alt });
  const closeLightbox = () => setLightbox(null);

  const gridClass =
    cardLayout === "horizontal"
      ? "grid gap-6 flex-1 grid-cols-1 lg:grid-cols-2"
      : aspectRatio === "9:16"
        ? "grid gap-6 flex-1 grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
        : "grid gap-6 flex-1 grid-cols-1 md:grid-cols-2 lg:grid-cols-3";

  return (
    <>
      {lightbox && <Lightbox {...lightbox} onClose={closeLightbox} />}
      <div className={gridClass}>
        {frames.map((frame, idx) =>
          cardLayout === "horizontal" ? (
            <HorizontalFrameCard
              key={idx}
              frame={frame}
              idx={idx}
              aspectRatio={aspectRatio}
              expanded={!!expandedDescriptions[idx]}
              onToggleDescription={onToggleDescription}
              onLightbox={openLightbox}
              onRegenerateFrame={onRegenerateFrame}
              onUpdateFrame={onUpdateFrame}
              onEditFrame={editCapable ? onEditFrame : undefined}
            />
          ) : (
            <VerticalFrameCard
              key={idx}
              frame={frame}
              idx={idx}
              aspectRatio={aspectRatio}
              expanded={!!expandedDescriptions[idx]}
              onToggleDescription={onToggleDescription}
              onLightbox={openLightbox}
              onRegenerateFrame={onRegenerateFrame}
              onUpdateFrame={onUpdateFrame}
              onEditFrame={editCapable ? onEditFrame : undefined}
            />
          )
        )}
      </div>
    </>
  );
}
