"use client";

import { useState } from "react";
import { Activity, ChevronDown, ChevronRight } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface ArtistContextCardProps {
  artistContext: string;
}

export function ArtistContextCard({ artistContext }: ArtistContextCardProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="glass rounded-xl p-4 flex flex-col gap-4 shrink-0">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center justify-between w-full text-left group"
      >
        <h2 className="text-[10px] text-amber-500 uppercase font-black tracking-[0.2em] flex items-center gap-2">
          <Activity className="w-3 h-3" /> Artist Research (Ollama Web Search)
        </h2>
        {collapsed ? (
          <ChevronRight className="w-3 h-3 text-amber-500/60 group-hover:text-amber-500 transition-colors" />
        ) : (
          <ChevronDown className="w-3 h-3 text-amber-500/60 group-hover:text-amber-500 transition-colors" />
        )}
      </button>

      {!collapsed && (
        <div className="text-sm text-gray-400 leading-relaxed border-l-2 border-amber-500/30 pl-4 prose prose-sm prose-invert prose-headings:text-amber-400 prose-headings:font-bold prose-headings:uppercase prose-headings:tracking-wide prose-headings:text-xs prose-strong:text-gray-200 prose-ul:my-1 prose-li:my-0 max-w-none">
          <ReactMarkdown>{artistContext}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
