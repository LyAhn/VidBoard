"use client";

import Image from "next/image";
import { Film, Trash2 } from "lucide-react";
import type { ProjectSummaryPayload } from "@/lib/vidboard-types";

interface ProjectCardProps {
  project: ProjectSummaryPayload;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}

function FilmStripPlaceholder() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-neutral-900 to-[#111]">
      <div className="flex items-center gap-1 opacity-30">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex flex-col gap-1">
            <div className="flex justify-around mb-0.5">
              {[0, 1].map((h) => (
                <div key={h} className="w-1.5 h-1 rounded-sm bg-neutral-600" />
              ))}
            </div>
            <div
              className="w-10 h-14 rounded-sm border border-neutral-700"
              style={{
                background: `linear-gradient(${(i * 67 + 13) % 360}deg, #1a1a1a 0%, #222 100%)`,
              }}
            />
            <div className="flex justify-around mt-0.5">
              {[0, 1].map((h) => (
                <div key={h} className="w-1.5 h-1 rounded-sm bg-neutral-600" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProjectCard({ project, onOpen, onDelete }: ProjectCardProps) {
  const updatedAt = new Date(project.updatedAt);
  const relativeTime = formatRelative(updatedAt);

  return (
    <div className="group glass rounded-xl overflow-hidden flex flex-col cursor-pointer hover:border-neutral-600 transition-colors border border-transparent">
      {/* Thumbnail */}
      <div
        className="relative aspect-video bg-neutral-900 overflow-hidden"
        onClick={() => onOpen(project.id)}
      >
        {project.thumbnailImagePath ? (
          <Image
            src={`/api/images/${project.thumbnailImagePath}`}
            alt={`${project.name} thumbnail`}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            unoptimized
          />
        ) : (
          <FilmStripPlaceholder />
        )}
        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
          <span className="opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold uppercase tracking-widest text-white bg-black/60 px-3 py-1.5 rounded">
            Open Project
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="px-3 py-2.5 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1" onClick={() => onOpen(project.id)}>
          <p className="text-sm font-semibold text-[#e5e5e5] truncate">{project.name}</p>
          <p className="text-[10px] text-neutral-500 truncate mt-0.5">
            {project.artistName && project.trackTitle
              ? `${project.artistName} — ${project.trackTitle}`
              : project.artistName || project.trackTitle || "Untitled"}
          </p>
          <p className="text-[9px] text-neutral-600 mt-1 uppercase tracking-wider font-medium">
            {relativeTime}
          </p>
        </div>
        <button
          aria-label="Delete project"
          onClick={(e) => { e.stopPropagation(); onDelete(project.id); }}
          className="shrink-0 p-1.5 rounded text-neutral-600 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export function NewProjectCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="glass rounded-xl overflow-hidden flex flex-col items-center justify-center aspect-video cursor-pointer border border-dashed border-neutral-700 hover:border-amber-500/50 hover:bg-amber-500/5 transition-colors group"
    >
      <Film className="w-8 h-8 text-neutral-600 group-hover:text-amber-500/70 transition-colors mb-2" />
      <span className="text-xs font-bold uppercase tracking-widest text-neutral-600 group-hover:text-amber-500/70 transition-colors">
        New Project
      </span>
    </button>
  );
}

function formatRelative(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}
