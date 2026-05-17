"use client";

import { useEffect, useState } from "react";
import { Film } from "lucide-react";
import type { ProjectSummaryPayload } from "@/lib/vidboard-types";
import { NewProjectCard, ProjectCard } from "./ProjectCard";
import { UnsavedChangesModal } from "./UnsavedChangesModal";

interface ProjectsViewProps {
  isDirty: boolean;
  onNewProject: () => void;
  onOpenProject: (id: string) => void;
  onSaveCurrentAndOpen: (id: string) => void;
  onDiscardAndOpen: (id: string) => void;
}

export function ProjectsView({
  isDirty,
  onNewProject,
  onOpenProject,
  onSaveCurrentAndOpen,
  onDiscardAndOpen,
}: ProjectsViewProps) {
  const [projects, setProjects] = useState<ProjectSummaryPayload[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingOpenId, setPendingOpenId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data: ProjectSummaryPayload[]) => setProjects(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleOpen = (id: string) => {
    if (isDirty) {
      setPendingOpenId(id);
    } else {
      onOpenProject(id);
    }
  };

  const handleDelete = async (id: string) => {
    setShowDeleteConfirm(null);
    const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
    if (!res.ok) {
      console.error("Failed to delete project", id);
      return;
    }
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#111111]">
      {/* Header */}
      <div className="border-b border-[#252525] px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Film className="w-5 h-5 text-amber-500" />
          <h1 className="text-base font-bold text-[#e5e5e5] tracking-tight">Projects</h1>
        </div>
        <span className="text-xs text-neutral-500">
          {projects.length} {projects.length === 1 ? "project" : "projects"}
        </span>
      </div>

      {/* Grid */}
      <div className="p-8">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-neutral-600 text-sm">
            Loading projects...
          </div>
        ) : (
          <div className="grid gap-5 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            <NewProjectCard onClick={onNewProject} />
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onOpen={handleOpen}
                onDelete={(id) => setShowDeleteConfirm(id)}
              />
            ))}
          </div>
        )}

        {!loading && projects.length === 0 && (
          <div className="mt-16 flex flex-col items-center justify-center text-center opacity-40">
            <Film className="w-12 h-12 text-neutral-500 mb-3" />
            <p className="text-sm font-medium text-neutral-400">No projects yet</p>
            <p className="text-xs text-neutral-500 mt-1">Create your first project to get started</p>
          </div>
        )}
      </div>

      {/* Unsaved changes modal */}
      {pendingOpenId && (
        <UnsavedChangesModal
          onSave={() => {
            const id = pendingOpenId;
            setPendingOpenId(null);
            onSaveCurrentAndOpen(id);
          }}
          onDiscard={() => {
            const id = pendingOpenId;
            setPendingOpenId(null);
            onDiscardAndOpen(id);
          }}
          onCancel={() => setPendingOpenId(null)}
        />
      )}

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6"
          onClick={() => setShowDeleteConfirm(null)}
        >
          <div
            className="glass rounded-xl p-6 max-w-sm w-full flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-sm font-bold text-[#e5e5e5]">Delete Project?</h2>
            <p className="text-xs text-neutral-400 leading-relaxed">
              This will permanently delete the project and all its generated images. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                className="flex-1 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-bold uppercase tracking-wider transition-colors border border-red-500/30"
              >
                Delete
              </button>
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 py-2 rounded-lg border border-[#2a2a2a] hover:border-neutral-500 text-neutral-400 text-xs font-bold uppercase tracking-wider transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
