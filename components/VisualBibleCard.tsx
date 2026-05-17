"use client";

import { useRef, useState } from "react";
import { Check, ChevronDown, ChevronRight, Pencil, Settings2, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { AppState } from "@/lib/vidboard-types";

interface VisualBibleCardProps {
  visualBible: string;
  characterReferenceImage: string | null;
  updateState: (updates: Partial<AppState>) => void;
}

export function VisualBibleCard({
  visualBible,
  characterReferenceImage,
  updateState,
}: VisualBibleCardProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const startEdit = () => {
    setDraft(visualBible);
    setEditing(true);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const commitEdit = () => {
    setEditing(false);
    if (draft.trim() !== visualBible.trim()) {
      updateState({ visualBible: draft.trim() });
    }
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraft("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") cancelEdit();
    if (e.key === "Enter" && e.ctrlKey) commitEdit();
  };

  return (
    <div className="glass rounded-xl p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between w-full">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
          aria-controls="visual-bible-content"
          className="flex items-center gap-2 text-left group"
        >
          <h2 className="text-[10px] text-amber-500 uppercase font-black tracking-[0.2em] flex items-center gap-2">
            <Settings2 className="w-3 h-3" /> Visual Bible & Style Lock
          </h2>
          {collapsed ? (
            <ChevronRight className="w-3 h-3 text-amber-500/60 group-hover:text-amber-500 transition-colors" />
          ) : (
            <ChevronDown className="w-3 h-3 text-amber-500/60 group-hover:text-amber-500 transition-colors" />
          )}
        </button>

        {!collapsed && !editing && (
          <button
            aria-label="Edit visual bible"
            onClick={startEdit}
            className="flex items-center gap-1 text-[10px] text-neutral-500 hover:text-amber-400 transition-colors px-2 py-1 rounded border border-transparent hover:border-neutral-700"
          >
            <Pencil className="w-3 h-3" /> Edit
          </button>
        )}
        {!collapsed && editing && (
          <div className="flex items-center gap-1">
            <button
              aria-label="Save visual bible"
              onClick={commitEdit}
              className="flex items-center gap-1 text-[10px] text-green-400 hover:text-green-300 transition-colors px-2 py-1 rounded border border-green-500/30 hover:border-green-400/50"
            >
              <Check className="w-3 h-3" /> Save
            </button>
            <button
              aria-label="Cancel editing"
              onClick={cancelEdit}
              className="flex items-center gap-1 text-[10px] text-neutral-500 hover:text-neutral-300 transition-colors px-2 py-1 rounded border border-transparent hover:border-neutral-700"
            >
              <X className="w-3 h-3" /> Cancel
            </button>
          </div>
        )}
      </div>

      {!collapsed && (
        <div id="visual-bible-content" className="flex flex-col gap-4">
          {editing ? (
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={16}
              aria-label="Visual Bible editor"
              className="w-full resize-y rounded border border-amber-500/40 bg-[#0d0d0d] px-4 py-3 text-sm text-gray-200 font-mono leading-relaxed outline-none focus:border-amber-500/70 min-h-[200px]"
            />
          ) : (
            <div className="text-sm text-gray-300 leading-relaxed bg-black/50 p-4 rounded border border-amber-500/10 prose prose-sm prose-invert prose-headings:text-amber-400 prose-headings:font-bold prose-headings:uppercase prose-headings:tracking-wide prose-headings:text-xs prose-strong:text-gray-200 prose-ul:my-1 prose-li:my-0 max-w-none">
              <ReactMarkdown>{visualBible}</ReactMarkdown>
            </div>
          )}

          <div className="flex items-center gap-4 mt-2">
            <label className="text-xs uppercase tracking-wider text-gray-400">
              Character Reference Image:
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    updateState({ characterReferenceImage: event.target?.result as string });
                  };
                  reader.readAsDataURL(file);
                }
              }}
              className="text-xs text-gray-300 file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-bold file:bg-amber-500/20 file:text-amber-500 hover:file:bg-amber-500/30 transition-colors"
            />
            {characterReferenceImage && (
              <span className="text-xs text-green-400 font-medium">Uploaded ✓</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
