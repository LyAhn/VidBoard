"use client";

import React, { useEffect, useRef, useState } from "react";
import { PlaySquare, Sparkles } from "lucide-react";
import {
  checkPromptStatus,
  freeComfyMemory,
  getWorkflowInfo,
  requestGeneratedImage,
} from "@/lib/api/generate-image";
import { requestStoryboardPlan } from "@/lib/api/plan";
import { exportStoryboardPdf } from "@/lib/export-pdf";
import { exportStoryboardZip } from "@/lib/export-zip";
import { buildEndFramePrompt, buildStartFramePrompt } from "@/lib/storyboard-prompts";
import type { AppState, FrameData } from "@/lib/vidboard-types";
import { ArtistContextCard } from "@/components/ArtistContextCard";
import {
  CinematicLoader,
  WaveformLoader,
  DirectorLoader,
} from "@/components/PlanningLoader";
import { planningSteps } from "@/components/PlanningProgress";
import { StoryboardGrid } from "@/components/StoryboardGrid";
import { StoryboardToolbar } from "@/components/StoryboardToolbar";
import { VidBoardSidebar } from "@/components/VidBoardSidebar";
import { VisualBibleCard } from "@/components/VisualBibleCard";

const initialState: AppState = {
  artistName: "",
  trackTitle: "",
  lyrics: "",
  theme: "",
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
  const [state, setState] = useState<AppState>(initialState);
  const [expandedDescriptions, setExpandedDescriptions] = useState<Record<number, boolean>>({});
  const [planningElapsed, setPlanningElapsed] = useState(0);
  const [planningStepIndex, setPlanningStepIndex] = useState(0);
  const mainAreaRef = useRef<HTMLDivElement>(null);
  const hasLoadedSavedState = useRef(false);

  const updateState = (updates: Partial<AppState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  };

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;

      const saved = window.localStorage.getItem("vidboard_state");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setState((prev) => ({
            ...prev,
            artistName: parsed.artistName || "",
            trackTitle: parsed.trackTitle || "",
            lyrics: parsed.lyrics || "",
            theme: parsed.theme || "",
            numberOfFrames: parsed.numberOfFrames || 8,
            aspectRatio: parsed.aspectRatio || "16:9",
          }));
        } catch (error) {
          console.error("Failed to parse saved state", error);
        }
      }

      hasLoadedSavedState.current = true;
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedSavedState.current) {
      return;
    }

    const stateToSave = {
      artistName: state.artistName,
      trackTitle: state.trackTitle,
      lyrics: state.lyrics,
      theme: state.theme,
      numberOfFrames: state.numberOfFrames,
      aspectRatio: state.aspectRatio,
      artistContext: state.artistContext,
      visualBible: state.visualBible,
      frames: state.frames.map((frame) => ({
        ...frame,
        startImageBase64: undefined,
        endImageBase64: undefined,
      })),
    };

    try {
      window.localStorage.setItem("vidboard_state", JSON.stringify(stateToSave));
    } catch (error) {
      console.warn("Storage error", error);
    }
  }, [
    state.artistName,
    state.trackTitle,
    state.lyrics,
    state.theme,
    state.numberOfFrames,
    state.aspectRatio,
    state.artistContext,
    state.visualBible,
    state.frames,
  ]);

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
    setState((prev) => ({
      ...prev,
      frames: prev.frames.map((frame, frameIdx) =>
        frameIdx === idx ? { ...frame, ...updates } : frame
      ),
    }));
  };

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
      if (frame.startImageBase64 && frame.endImageBase64 && !frame.error) {
        continue;
      }

      const frameLabel = `Frame ${index + 1} of ${frames.length}`;
      updateFrame(index, { isGenerating: true, error: undefined });

      try {
        const startedAt = Date.now();
        const elapsedLabel = () => {
          const secs = Math.floor((Date.now() - startedAt) / 1000);
          return secs > 0 ? ` (${secs}s)` : "";
        };

        // Only pass the reference image for frames that actually feature the character.
        const frameRef = frame.character_present ? referenceImageBase64 : undefined;
        const startWorkflow = frame.character_present ? undefined : "flux2-klein-txt2img";
        // End frames always use the reference workflow (never the img2img one — we no longer use
        // the start frame as init conditioning; end frames are independent generations).
        const endWorkflow = frame.character_present ? "flux2-klein-reference" : "flux2-klein-txt2img";

        updateState({ statusMessage: `${frameLabel}: queuing start image...` });
        const startData = await requestGeneratedImage({
          prompt: buildStartFramePrompt(frame, visualBible),
          kind: "start",
          aspectRatio: state.aspectRatio,
          referenceImageBase64: frameRef,
          workflow: startWorkflow,
        });
        updateFrame(index, {
          startImageBase64: startData.imageBase64,
          startPromptId: startData.promptId,
        });

        updateState({ statusMessage: `${frameLabel}: queuing end image${elapsedLabel()}...` });
        const endData = await requestGeneratedImage({
          prompt: buildEndFramePrompt(frame, visualBible),
          kind: "end",
          aspectRatio: state.aspectRatio,
          referenceImageBase64: frameRef,
          workflow: endWorkflow,
        });
        updateFrame(index, {
          endImageBase64: endData.imageBase64,
          endPromptId: endData.promptId,
          isGenerating: false,
        });
      } catch (error) {
        updateFrame(index, {
          isGenerating: false,
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
  };

  const handleGenerate = async () => {
    if (!state.artistName || !state.trackTitle || !state.lyrics) {
      updateState({ error: "Please fill in artist name, track title, and lyrics." });
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
        numberOfFrames: state.numberOfFrames,
        aspectRatio: state.aspectRatio,
      });

      const plannedFrames = planData.frames.map((frame, index, frames) => ({
        ...frame,
        next_lyric_line: frames[index + 1]?.lyric_line,
        isGenerating: false,
      }));
      updateState({
        artistContext: planData.artistContext,
        visualBible: planData.visualBible,
        frames: plannedFrames,
        isPlanning: false,
        isGeneratingImages: false,
        statusMessage: null,
      });
    } catch (error) {
      updateState({
        error: error instanceof Error ? error.message : "Failed to plan storyboard.",
        isPlanning: false,
        isGeneratingImages: false,
        statusMessage: null,
      });
    }
  };

  const handleGenerateImages = async () => {
    if (!state.visualBible || !state.frames.length) return;
    await generateFrameImages(state.frames, state.visualBible, state.characterReferenceImage);
  };

  const handleRetryImages = async () => {
    if (!state.visualBible || !state.frames.length) return;

    updateState({ isGeneratingImages: true, statusMessage: "Checking previous jobs...", error: null });

    const recoveredFrames = await Promise.all(
      state.frames.map(async (frame) => {
        if (!frame.error && frame.startImageBase64 && frame.endImageBase64) {
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
              return { ...updated, isGenerating: false };
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
              return { ...updated, isGenerating: false };
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
          isGenerating: false,
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

  return (
    <div className="flex flex-col md:flex-row h-screen w-full overflow-hidden bg-[#050505] font-sans text-[#e5e5e5]">
      <VidBoardSidebar
        state={state}
        planningElapsed={planningElapsed}
        planningStepIndex={planningStepIndex}
        onGenerate={handleGenerate}
        updateState={updateState}
      />

      <div className="flex-1 overflow-y-auto flex flex-col relative bg-[#050505]" ref={mainAreaRef}>
        <StoryboardToolbar
          frames={state.frames}
          isGeneratingImages={state.isGeneratingImages}
          onRetryImages={handleRetryImages}
          onExportPdf={() =>
            exportStoryboardPdf({
              artistName: state.artistName,
              trackTitle: state.trackTitle,
              theme: state.theme,
              aspectRatio: state.aspectRatio,
              visualBible: state.visualBible,
              frames: state.frames,
            })
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

        {/* ── Planning loaders (shown in main area while AI works) ──────────────
            Switch the active variant by swapping which line is uncommented:
              <CinematicLoader …/>  — Variant A: scrolling film strip + progress rail
              <WaveformLoader …/>   — Variant B: audio-visualiser bars + stage dots
              <DirectorLoader …/>   — Variant C: CRT terminal monitor log
        ──────────────────────────────────────────────────────────────────── */}
        {state.isPlanning && (
          <div className="flex-1 flex items-center justify-center">
            <CinematicLoader elapsed={planningElapsed} stepIndex={planningStepIndex} />
            {/* <WaveformLoader elapsed={planningElapsed} stepIndex={planningStepIndex} /> */}
            {/* <DirectorLoader elapsed={planningElapsed} stepIndex={planningStepIndex} /> */}
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
            !state.frames.some((f) => f.startImageBase64 || f.endImageBase64 || f.isGenerating) && (
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
