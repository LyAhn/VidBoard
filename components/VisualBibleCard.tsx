"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Settings2 } from "lucide-react";
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

  return (
    <div className="glass rounded-xl p-4 flex flex-col gap-4">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center justify-between w-full text-left group"
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

      {!collapsed && (
        <>
          <div className="text-sm text-gray-300 leading-relaxed bg-black/50 p-4 rounded border border-amber-500/10 prose prose-sm prose-invert prose-headings:text-amber-400 prose-headings:font-bold prose-headings:uppercase prose-headings:tracking-wide prose-headings:text-xs prose-strong:text-gray-200 prose-ul:my-1 prose-li:my-0 max-w-none">
            <ReactMarkdown>{visualBible}</ReactMarkdown>
          </div>
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
        </>
      )}
    </div>
  );
}
