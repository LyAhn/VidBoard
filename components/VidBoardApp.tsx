"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { PlaySquare, Sparkles } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import {
  checkPromptStatus,
  freeComfyMemory,
  getWorkflowInfo,
  requestGeneratedImage,
} from "@/lib/api/generate-image";
import { createProject, loadProject, updateProject } from "@/lib/api/projects";
import { requestStoryboardPlan } from "@/lib/api/plan";
import { exportStoryboardPdf } from "@/lib/export-pdf";
import { exportStoryboardZip } from "@/lib/export-zip";
import { buildEditFramePrompt, buildEndFramePrompt, buildNegativePrompt, buildStartFramePrompt } from "@/lib/storyboard-prompts";
import type { AppState, FrameData } from "@/lib/vidboard-types";
import type { CardLayout } from "@/components/StoryboardGrid";
import { useServiceHealth } from "@/hooks/use-service-health";
import { ArtistContextCard } from "@/components/ArtistContextCard";
import { CinematicLoader } from "@/components/PlanningLoader";
import { planningSteps } from "@/components/PlanningProgress";
import { ProjectsView } from "@/components/ProjectsView";
import { StoryboardGrid } from "@/components/StoryboardGrid";
import { StoryboardToolbar } from "@/components/StoryboardToolbar";
import { VidBoardSidebar } from "@/components/VidBoardSidebar";
import { VisualBibleCard } from "@/components/VisualBibleCard";

type AppView = "projects" | "storyboard";

const initialState: AppState = {
  artistName: "",
  trackTitle: "",
  lyrics: "",
  theme: "",
  visualDirection: "lyrics",
  visualConcept: "",
  negativePrompt: "",
  numberOfFrames: 8,
  aspectRatio: "16:9",
  artistContext: null,
  visualBible: null,
  characterReferenceImage: null,
  frames: [],
  isPlanning: false,
  isGeneratingImages: false,
  error: null,
  statusMessage: null,
};

export default function VidBoardApp() {
  const [view, setView] = useState<AppView>("projects");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>("");
  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [state, setState] = useState<AppState>(initialState);
  const latestStateRef = useRef<AppState>(initialState);
  const [expandedDescriptions, setExpandedDescriptions] = useState<Record<number, boolean>>({});
  const [planningElapsed, setPlanningElapsed] = useState(0);
  const [planningStepIndex, setPlanningStepIndex] = useState(0);
  const [cardLayout, setCardLayout] = useState<CardLayout>("vertical");
  const [negativePromptCapable, setNegativePromptCapable] = useState(false);
  const [editCapable, setEditCapable] = useState(false);
  const mainAreaRef = useRef<HTMLDivElement>(null);
  const hasLoadedSavedState = useRef(false);
  const health = useServiceHealth();

  const updateState = (updates: Partial<AppState>) => {
    setState((prev) => {
      const next = { ...prev, ...updates };
      latestStateRef.current = next;
      return next;
    });
    setIsDirty(true);
  };

  // ── Serialise current state for DB (strip in-memory base64 — images are on disk) ──
  const serialiseState = useCallback(
    (currentState: AppState) =>
      JSON.stringify({
        ...currentState,
        isPlanning: false,
        isGeneratingImages: false,
        error: null,
        statusMessage: null,
        frames: currentState.frames.map((f) => ({
          ...f,
          startImageBase64: undefined,
          endImageBase64: undefined,
          isGeneratingStart: false,
          isGeneratingEnd: false,
          error: undefined,
        })),
      }),
    []
  );

  // ── Save current project to DB ────────────────────────────────────────────────────
  const saveCurrentProject = useCallback(
    async (currentState: AppState, currentProjectId: string | null, explicitName?: string): Promise<string> => {
      const derived =
        currentState.artistName && currentState.trackTitle
          ? `${currentState.artistName} — ${currentState.trackTitle}`
          : currentState.artistName || currentState.trackTitle || "Untitled Project";
      const name = explicitName?.trim() || projectName.trim() || derived;

      const stateJson = serialiseState(currentState);
      setSaveStatus("saving");

      try {
        if (currentProjectId) {
          await updateProject(currentProjectId, {
            name,
            artistName: currentState.artistName,
            trackTitle: currentState.trackTitle,
            stateJson,
          });
          setIsDirty(false);
          setSaveStatus("saved");
          return currentProjectId;
        } else {
          const id = uuidv4();
          await createProject({ id, name, artistName: currentState.artistName, trackTitle: currentState.trackTitle, stateJson });
          setProjectId(id);
          setIsDirty(false);
          setSaveStatus("saved");
          return id;
        }
      } catch (err) {
        setSaveStatus("idle");
        throw err;
      }
    },
    [serialiseState, projectName]
  );

  // ── Load a project from DB ────────────────────────────────────────────────────────
  const openProject = useCallback(async (id: string) => {
    try {
      const project = await loadProject(id);
      const loaded = JSON.parse(project.stateJson) as Partial<AppState>;
      const loadedState: AppState = {
        ...initialState,
        artistName: loaded.artistName ?? "",
        trackTitle: loaded.trackTitle ?? "",
        lyrics: loaded.lyrics ?? "",
        theme: loaded.theme ?? "",
        visualDirection: loaded.visualDirection ?? "lyrics",
        visualConcept: loaded.visualConcept ?? "",
        negativePrompt: loaded.negativePrompt ?? "",
        numberOfFrames: loaded.numberOfFrames ?? 8,
        aspectRatio: loaded.aspectRatio ?? "16:9",
        artistContext: loaded.artistContext ?? null,
        visualBible: loaded.visualBible ?? null,
        characterReferenceImage: loaded.characterReferenceImage ?? null,
        frames: (loaded.frames ?? []).map((f) => ({ ...f, isGeneratingStart: false, isGeneratingEnd: false, error: undefined })),
      };
      latestStateRef.current = loadedState;
      setState(loadedState);
      setProjectId(id);
      setProjectName(project.name);
      setExpandedDescriptions({});
      setIsDirty(false);
      setView("storyboard");
    } catch (error) {
      console.error("Failed to open project", error);
    }
  }, []);

  useEffect(() => {
    const savedLayout = window.localStorage.getItem("vidboard_card_layout");
    if (savedLayout === "horizontal" || savedLayout === "vertical") {
      setCardLayout(savedLayout);
    }
    hasLoadedSavedState.current = true;
  }, []);

  useEffect(() => {
    if (!hasLoadedSavedState.current) return;
    try {
      window.localStorage.setItem("vidboard_card_layout", cardLayout);
    } catch (error) {
      console.warn("Storage error", error);
    }
  }, [cardLayout]);

  useEffect(() => {
    if (health.comfyui !== "online") return;
    getWorkflowInfo()
      .then((info) => {
        setNegativePromptCapable(
          info.start.capabilities.negativePrompt || info.end.capabilities.negativePrompt
        );
        setEditCapable(Boolean(info.edit));
      })
      .catch(() => undefined);
  }, [health.comfyui]);

  // Auto-clear "saved" indicator after 2.5s
  useEffect(() => {
    if (saveStatus !== "saved") return;
    const t = window.setTimeout(() => setSaveStatus("idle"), 2500);
    return () => window.clearTimeout(t);
  }, [saveStatus]);

  useEffect(() => {
    if (!state.isPlanning) return;

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      setPlanningElapsed(elapsed);
      setPlanningStepIndex(Math.min(planningSteps.length - 1, Math.floor(elapsed / 25)));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [state.isPlanning]);

  const toggleDescription = (idx: number) => {
    setExpandedDescriptions((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  const updateFrame = (idx: number, updates: Partial<FrameData>) => {
    setState((prev) => {
      const frames = prev.frames.map((frame, frameIdx) =>
        frameIdx === idx ? { ...frame, ...updates } : frame
      );
      const next = { ...prev, frames };
      latestStateRef.current = next;
      return next;
    });
    setIsDirty(true);
  };

  // Ensure a project ID exists before generating — creates the DB record if needed
  const ensureProjectId = useCallback(
    async (currentState: AppState): Promise<string> => {
      if (projectId) return projectId;
      return saveCurrentProject(currentState, null);
    },
    [projectId, saveCurrentProject]
  );

  const generateFrameImages = async (
    frames: FrameData[],
    visualBible: string,
    referenceImageBase64?: string | null
  ) => {
    if (!frames.length) return;

    updateState({
      isGeneratingImages: true,
      statusMessage: "Checking image workflow...",
      error: null,
    });

    const currentProjectId = await ensureProjectId(state);

    const workflowInfo = await getWorkflowInfo();
    if (referenceImageBase64 && !workflowInfo.start.capabilities.referenceImage) {
      updateState({
        isGeneratingImages: false,
        statusMessage: null,
        error: `The selected Start workflow "${workflowInfo.start.workflow}" cannot use the uploaded character reference image. Export a reference-capable Start workflow or remove the reference image.`,
      });
      return;
    }

    updateState({ statusMessage: "Generating frames..." });

    for (let index = 0; index < frames.length; index++) {
      const frame = frames[index];
      if ((frame.startImageBase64 || frame.startImagePath) && (frame.endImageBase64 || frame.endImagePath) && !frame.error) {
        continue;
      }

      const frameLabel = `Frame ${index + 1} of ${frames.length}`;
      updateFrame(index, { isGeneratingStart: true, isGeneratingEnd: false, error: undefined });

      try {
        const startedAt = Date.now();
        const elapsedLabel = () => {
          const secs = Math.floor((Date.now() - startedAt) / 1000);
          return secs > 0 ? ` (${secs}s)` : "";
        };

        const useReferenceWorkflow = frame.character_present && Boolean(referenceImageBase64);
        const frameRef = useReferenceWorkflow ? referenceImageBase64 : undefined;
        const startWorkflow = useReferenceWorkflow ? undefined : "flux2-klein-txt2img";
        const endWorkflow = useReferenceWorkflow ? "flux2-klein-reference" : "flux2-klein-txt2img";

        updateState({ statusMessage: `${frameLabel}: queuing start image...` });
        const startData = await requestGeneratedImage({
          prompt: buildStartFramePrompt(frame, visualBible),
          negativePrompt: buildNegativePrompt(frame, state.negativePrompt),
          kind: "start",
          projectId: currentProjectId,
          aspectRatio: state.aspectRatio,
          referenceImageBase64: frameRef,
          workflow: startWorkflow,
        });
        updateFrame(index, {
          startImageBase64: startData.imageBase64,
          startImagePath: startData.imagePath,
          startPromptId: startData.promptId,
          startSeed: startData.seed,
          startImageHistory: startData.imagePath
            ? [...(frame.startImageHistory ?? []), startData.imagePath]
            : frame.startImageHistory,
          isGeneratingStart: false,
          isGeneratingEnd: true,
        });

        updateState({ statusMessage: `${frameLabel}: queuing end image${elapsedLabel()}...` });
        const endData = await requestGeneratedImage({
          prompt: buildEndFramePrompt(frame, visualBible),
          negativePrompt: buildNegativePrompt(frame, state.negativePrompt),
          kind: "end",
          projectId: currentProjectId,
          aspectRatio: state.aspectRatio,
          referenceImageBase64: frameRef,
          workflow: endWorkflow,
          seed: startData.seed !== undefined ? startData.seed + 1 : undefined,
        });
        updateFrame(index, {
          endImageBase64: endData.imageBase64,
          endImagePath: endData.imagePath,
          endPromptId: endData.promptId,
          endImageHistory: endData.imagePath
            ? [...(frame.endImageHistory ?? []), endData.imagePath]
            : frame.endImageHistory,
          isGeneratingEnd: false,
        });
      } catch (error) {
        updateFrame(index, {
          isGeneratingStart: false,
          isGeneratingEnd: false,
          error: error instanceof Error ? error.message : "Image generation failed.",
        });
      }
    }

    // Free ComfyUI VRAM now that the storyboard run is complete — fire-and-forget.
    freeComfyMemory().catch(() => undefined);

    updateState({
      isGeneratingImages: false,
      statusMessage: null,
    });

    // Auto-save after generation completes
    saveCurrentProject(latestStateRef.current, currentProjectId).catch(console.error);
  };

  const handleGenerate = async () => {
    const hasLyrics = state.lyrics.trim().length > 0;
    const hasVisualConcept = state.visualConcept.trim().length > 0;
    if (!state.artistName || !state.trackTitle || (!hasLyrics && !hasVisualConcept)) {
      updateState({
        error:
          "Please fill in artist name, track title, and either lyrics or a visual concept for instrumental tracks.",
      });
      return;
    }

    setPlanningElapsed(0);
    setPlanningStepIndex(0);
    updateState({
      isPlanning: true,
      isGeneratingImages: false,
      error: null,
      artistContext: null,
      visualBible: null,
      frames: [],
      statusMessage: "Planning blueprint...",
    });

    try {
      const planData = await requestStoryboardPlan({
        artistName: state.artistName,
        trackTitle: state.trackTitle,
        lyrics: state.lyrics,
        theme: state.theme,
        visualDirection: state.visualDirection,
        visualConcept: state.visualConcept,
        numberOfFrames: state.numberOfFrames,
        aspectRatio: state.aspectRatio,
      });

      const plannedFrames = planData.frames.map((frame, index, frames) => ({
        ...frame,
        next_lyric_line: frames[index + 1]?.lyric_line,
        isGeneratingStart: false,
        isGeneratingEnd: false,
      }));
      const nextState: Partial<AppState> = {
        artistContext: planData.artistContext,
        visualBible: planData.visualBible,
        frames: plannedFrames,
        isPlanning: false,
        isGeneratingImages: false,
        statusMessage: null,
      };
      // updateState marks dirty, so call setState directly then save manually
      setState((prev) => {
        const merged = { ...prev, ...nextState };
        latestStateRef.current = merged;
        return merged;
      });
      setIsDirty(false);
      saveCurrentProject(latestStateRef.current, projectId).catch(console.error);
    } catch (error) {
      updateState({
        error: error instanceof Error ? error.message : "Failed to plan storyboard.",
        isPlanning: false,
        isGeneratingImages: false,
        statusMessage: null,
      });
    }
  };

  const regenerateSingleFrame = async (frameIdx: number, side: "start" | "end") => {
    const frame = state.frames[frameIdx];
    if (!frame || !state.visualBible) return;

    updateFrame(frameIdx, {
      isGeneratingStart: side === "start",
      isGeneratingEnd: side === "end",
      error: undefined,
    });

    try {
      const currentProjectId = await ensureProjectId(state);
      const referenceImageBase64 = state.characterReferenceImage;
      const useReferenceWorkflow = frame.character_present && Boolean(referenceImageBase64);

      if (useReferenceWorkflow && side === "start") {
        const workflowInfo = await getWorkflowInfo();
        if (!workflowInfo.start.capabilities.referenceImage) {
          updateFrame(frameIdx, {
            isGeneratingStart: false,
            error: `The selected Start workflow "${workflowInfo.start.workflow}" cannot use the character reference image.`,
          });
          return;
        }
      }
      const frameRef = useReferenceWorkflow ? referenceImageBase64 : undefined;

      if (side === "start") {
        const startData = await requestGeneratedImage({
          prompt: buildStartFramePrompt(frame, state.visualBible),
          negativePrompt: buildNegativePrompt(frame, state.negativePrompt),
          kind: "start",
          projectId: currentProjectId,
          aspectRatio: state.aspectRatio,
          referenceImageBase64: frameRef,
          workflow: useReferenceWorkflow ? undefined : "flux2-klein-txt2img",
        });
        updateFrame(frameIdx, {
          startImageBase64: startData.imageBase64,
          startImagePath: startData.imagePath,
          startPromptId: startData.promptId,
          startSeed: startData.seed,
          startImageHistory: startData.imagePath
            ? [...(frame.startImageHistory ?? (frame.startImagePath ? [frame.startImagePath] : [])), startData.imagePath]
            : frame.startImageHistory,
          isGeneratingStart: false,
        });
      } else {
        const endData = await requestGeneratedImage({
          prompt: buildEndFramePrompt(frame, state.visualBible),
          negativePrompt: buildNegativePrompt(frame, state.negativePrompt),
          kind: "end",
          projectId: currentProjectId,
          aspectRatio: state.aspectRatio,
          referenceImageBase64: frameRef,
          workflow: useReferenceWorkflow ? "flux2-klein-reference" : "flux2-klein-txt2img",
          seed: frame.startSeed !== undefined
            ? frame.startSeed + 1 + (frame.endImageHistory?.length ?? 0)
            : undefined,
        });
        updateFrame(frameIdx, {
          endImageBase64: endData.imageBase64,
          endImagePath: endData.imagePath,
          endPromptId: endData.promptId,
          endImageHistory: endData.imagePath
            ? [...(frame.endImageHistory ?? (frame.endImagePath ? [frame.endImagePath] : [])), endData.imagePath]
            : frame.endImageHistory,
          isGeneratingEnd: false,
        });
      }
      freeComfyMemory().catch(() => undefined);
      // Auto-save so the new image path is persisted immediately
      saveCurrentProject(latestStateRef.current, currentProjectId).catch(console.error);
    } catch (error) {
      updateFrame(frameIdx, {
        isGeneratingStart: false,
        isGeneratingEnd: false,
        error: error instanceof Error ? error.message : "Regeneration failed.",
      });
    }
  };

  const editFrame = async (frameIdx: number, side: "start" | "end", instruction: string) => {
    const frame = state.frames[frameIdx];
    if (!frame) return;

    const currentImage = side === "start"
      ? (frame.startImageBase64 ?? (frame.startImagePath ? `/api/images/${frame.startImagePath}` : undefined))
      : (frame.endImageBase64 ?? (frame.endImagePath ? `/api/images/${frame.endImagePath}` : undefined));
    if (!currentImage) return;

    updateFrame(frameIdx, {
      isGeneratingStart: side === "start",
      isGeneratingEnd: side === "end",
      error: undefined,
    });

    try {
      const currentProjectId = await ensureProjectId(state);

      // Fetch as base64 if we only have a path
      let initImageBase64 = frame[side === "start" ? "startImageBase64" : "endImageBase64"];
      if (!initImageBase64) {
        const imagePath = frame[side === "start" ? "startImagePath" : "endImagePath"];
        if (imagePath) {
          const res = await fetch(`/api/images/${imagePath}`);
          const blob = await res.blob();
          initImageBase64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve((reader.result as string).split(",").at(-1) ?? "");
            reader.readAsDataURL(blob);
          });
        }
      }
      if (!initImageBase64) throw new Error("No source image to edit.");

      const editData = await requestGeneratedImage({
        prompt: state.visualBible
          ? buildEditFramePrompt(instruction, frame, state.visualBible)
          : instruction,
        kind: "edit",
        workflow: "flux2-klein-edit",
        projectId: currentProjectId,
        aspectRatio: state.aspectRatio,
        initImageBase64,
      });

      if (side === "start") {
        updateFrame(frameIdx, {
          startImageBase64: editData.imageBase64,
          startImagePath: editData.imagePath,
          startPromptId: editData.promptId,
          startSeed: editData.seed,
          startImageHistory: editData.imagePath
            ? [...(frame.startImageHistory ?? (frame.startImagePath ? [frame.startImagePath] : [])), editData.imagePath]
            : frame.startImageHistory,
          isGeneratingStart: false,
        });
      } else {
        updateFrame(frameIdx, {
          endImageBase64: editData.imageBase64,
          endImagePath: editData.imagePath,
          endPromptId: editData.promptId,
          endImageHistory: editData.imagePath
            ? [...(frame.endImageHistory ?? (frame.endImagePath ? [frame.endImagePath] : [])), editData.imagePath]
            : frame.endImageHistory,
          isGeneratingEnd: false,
        });
      }

      freeComfyMemory().catch(() => undefined);
      saveCurrentProject(latestStateRef.current, currentProjectId).catch(console.error);
    } catch (error) {
      updateFrame(frameIdx, {
        isGeneratingStart: false,
        isGeneratingEnd: false,
        error: error instanceof Error ? error.message : "Edit failed.",
      });
    }
  };

  const handleGenerateImages = async () => {
    if (!state.visualBible || !state.frames.length) return;
    await generateFrameImages(state.frames, state.visualBible, state.characterReferenceImage);
  };

  const handleRegenerateAll = async () => {
    if (!state.visualBible || !state.frames.length) return;
    const clearedFrames = state.frames.map((f) => ({
      ...f,
      startImagePath: undefined,
      endImagePath: undefined,
      startImageBase64: undefined,
      endImageBase64: undefined,
      startPromptId: undefined,
      endPromptId: undefined,
      isGeneratingStart: false,
      isGeneratingEnd: false,
      error: undefined,
    }));
    updateState({ frames: clearedFrames, error: null });
    await generateFrameImages(clearedFrames, state.visualBible, state.characterReferenceImage);
  };

  const handleRetryImages = async () => {
    if (!state.visualBible || !state.frames.length) return;

    updateState({ isGeneratingImages: true, statusMessage: "Checking previous jobs...", error: null });

    const recoveredFrames = await Promise.all(
      state.frames.map(async (frame) => {
        if (!frame.error && (frame.startImageBase64 || frame.startImagePath) && (frame.endImageBase64 || frame.endImagePath)) {
          return frame;
        }

        let updated = { ...frame, error: undefined };

        // Try to recover the start image from ComfyUI before re-queuing.
        if (!updated.startImageBase64 && updated.startPromptId) {
          try {
            const result = await checkPromptStatus(updated.startPromptId);
            if (result.status === "done") {
              updated = { ...updated, startImageBase64: result.imageBase64 };
            } else if (result.status === "pending") {
              // Still running — leave promptId in place so generateFrameImages skips re-queue.
              return { ...updated, isGeneratingStart: false, isGeneratingEnd: false };
            }
          } catch {
            // Status check failed — will re-queue below.
          }
        }

        // Try to recover the end image from ComfyUI before re-queuing.
        if (!updated.endImageBase64 && updated.endPromptId) {
          try {
            const result = await checkPromptStatus(updated.endPromptId);
            if (result.status === "done") {
              updated = { ...updated, endImageBase64: result.imageBase64 };
            } else if (result.status === "pending") {
              return { ...updated, isGeneratingStart: false, isGeneratingEnd: false };
            }
          } catch {
            // Status check failed — will re-queue below.
          }
        }

        // Clear stale prompt IDs for images that still need generating.
        return {
          ...updated,
          startImageBase64: updated.startImageBase64,
          endImageBase64: updated.endImageBase64,
          startPromptId: updated.startImageBase64 ? updated.startPromptId : undefined,
          endPromptId: updated.endImageBase64 ? updated.endPromptId : undefined,
          isGeneratingStart: false,
          isGeneratingEnd: false,
        };
      })
    );

    updateState({ frames: recoveredFrames });
    await generateFrameImages(recoveredFrames, state.visualBible, state.characterReferenceImage);
  };

  const copyFlowPrompts = async () => {
    const prompts = state.frames.map((frame, index) => `${index + 1}. ${frame.flow_prompt}`).join("\n\n");
    await navigator.clipboard.writeText(prompts);
    alert("Copied all Flow prompts to clipboard!");
  };

  const handleNewProject = () => {
    latestStateRef.current = initialState;
    setState(initialState);
    setProjectId(null);
    setProjectName("");
    setExpandedDescriptions({});
    setIsDirty(false);
    setView("storyboard");
  };

  const handleRenameProject = async (newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setProjectName(trimmed);
    setIsDirty(true);
    await saveCurrentProject(state, projectId, trimmed);
  };

  const handleGoToProjects = async () => {
    const hasContent = state.artistName || state.trackTitle || state.frames.length > 0;
    if (hasContent && (isDirty || !projectId)) {
      await saveCurrentProject(state, projectId);
    }
    setView("projects");
  };

  const handleManualSave = async () => {
    await saveCurrentProject(state, projectId);
  };

  if (view === "projects") {
    return (
      <div className="flex h-screen w-full overflow-hidden bg-[#111111] font-sans text-[#e5e5e5]">
        <ProjectsView
          isDirty={false}
          onNewProject={handleNewProject}
          onOpenProject={openProject}
          onSaveCurrentAndOpen={async (id) => {
            await saveCurrentProject(state, projectId);
            await openProject(id);
          }}
          onDiscardAndOpen={async (id) => {
            await openProject(id);
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-screen w-full overflow-hidden bg-[#111111] font-sans text-[#e5e5e5]">
      <VidBoardSidebar
        state={state}
        planningElapsed={planningElapsed}
        planningStepIndex={planningStepIndex}
        negativePromptCapable={negativePromptCapable}
        onGenerate={handleGenerate}
        updateState={updateState}
      />

      <div className="flex-1 overflow-y-auto flex flex-col relative bg-[#111111]" ref={mainAreaRef}>
        <StoryboardToolbar
          frames={state.frames}
          isGeneratingImages={state.isGeneratingImages}
          cardLayout={cardLayout}
          onCardLayoutChange={setCardLayout}
          onGoToProjects={handleGoToProjects}
          onManualSave={handleManualSave}
          onRenameProject={handleRenameProject}
          saveStatus={saveStatus}
          projectName={
            projectName ||
            (state.artistName && state.trackTitle
              ? `${state.artistName} — ${state.trackTitle}`
              : state.artistName || state.trackTitle || "Untitled Project")
          }
          onRetryImages={handleRetryImages}
          onRegenerateAll={handleRegenerateAll}
          onExportPdf={() =>
            exportStoryboardPdf({
              artistName: state.artistName,
              trackTitle: state.trackTitle,
              theme: state.theme,
              aspectRatio: state.aspectRatio,
              visualBible: state.visualBible,
              frames: state.frames,
            }).catch(console.error)
          }
          onDownloadZip={() =>
            exportStoryboardZip({
              artistName: state.artistName,
              trackTitle: state.trackTitle,
              frames: state.frames,
            })
          }
          onCopyFlowPrompts={copyFlowPrompts}
        />

        {state.isPlanning && (
          <div className="flex-1 flex items-center justify-center">
            <CinematicLoader elapsed={planningElapsed} stepIndex={planningStepIndex} />
          </div>
        )}

        <div className="p-8 max-w-7xl mx-auto w-full space-y-12 pb-24">
          {state.error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg text-sm">
              <span className="font-semibold block mb-1">Error Occurred</span>
              {state.error}
            </div>
          )}

          {state.artistContext && !state.isPlanning && <ArtistContextCard artistContext={state.artistContext} />}

          {state.visualBible && (
            <VisualBibleCard
              visualBible={state.visualBible}
              characterReferenceImage={state.characterReferenceImage}
              updateState={updateState}
            />
          )}

          {state.frames.length === 0 &&
            !state.isPlanning &&
            !state.isGeneratingImages &&
            !state.artistContext && (
              <div className="h-full flex flex-col items-center justify-center opacity-40 mt-32">
                <PlaySquare className="w-16 h-16 mb-4 text-neutral-500" />
                <h2 className="text-xl font-medium tracking-tight mb-2">No Storyboard Yet</h2>
                <p className="text-sm max-w-md text-center text-neutral-500">
                  Fill in the track details on the left and hit &quot;Generate Blueprint&quot; to
                  let AI plan your music video sequence.
                </p>
              </div>
            )}

          {state.frames.length > 0 &&
            !state.isPlanning &&
            !state.isGeneratingImages &&
            !state.frames.some((f) => f.startImageBase64 || f.startImagePath || f.endImageBase64 || f.endImagePath || f.isGeneratingStart || f.isGeneratingEnd) && (
              <div className="rounded-xl border border-[#2a2a2a] bg-[#0d0d0d] p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-[#e5e5e5] mb-1">Blueprint ready</p>
                  <p className="text-xs text-neutral-500 max-w-lg">
                    Optionally add a character reference image in the Visual Bible above, then
                    generate your frame images when ready.
                  </p>
                </div>
                <button
                  onClick={handleGenerateImages}
                  className="shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-black text-sm font-semibold hover:bg-neutral-200 transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  Generate Images
                </button>
              </div>
            )}

          <StoryboardGrid
            frames={state.frames}
            aspectRatio={state.aspectRatio}
            expandedDescriptions={expandedDescriptions}
            onToggleDescription={toggleDescription}
            cardLayout={cardLayout}
            onRegenerateFrame={regenerateSingleFrame}
            onUpdateFrame={updateFrame}
            editCapable={editCapable}
            onEditFrame={editFrame}
          />
        </div>

        {state.frames.length > 0 && !state.isGeneratingImages && (
          <div className="mt-auto shrink-0 h-12 border-t border-[#1a1a1a] flex items-center justify-between px-6 opacity-50 bg-[#050505]">
            <p className="text-[10px] uppercase tracking-widest text-[#e5e5e5]">
              Status: All Frames Optimized for local video workflow
            </p>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
              <span className="text-[10px] font-bold uppercase text-[#e5e5e5]">
                Local FLUX Engine Active
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
