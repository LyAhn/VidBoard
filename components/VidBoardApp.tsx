"use client";

import React, { useEffect, useRef, useState } from "react";
import { PlaySquare } from "lucide-react";
import { requestStoryboardPlan } from "@/lib/api/plan";
import { exportStoryboardPdf } from "@/lib/export-pdf";
import { exportStoryboardZip } from "@/lib/export-zip";
import type { AppState } from "@/lib/vidboard-types";
import { ArtistContextCard } from "@/components/ArtistContextCard";
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

      updateState({
        artistContext: planData.artistContext,
        visualBible: planData.visualBible,
        frames: planData.frames.map((frame) => ({ ...frame, isGenerating: false })),
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

  const handleRetryImages = async () => {
    updateState({
      error: "Local AI backend not yet connected. See issues #2, #3, #4.",
      isGeneratingImages: false,
      statusMessage: null,
    });
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

        <div className="p-8 max-w-7xl mx-auto w-full space-y-12 pb-24">
          {state.error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg text-sm">
              <span className="font-semibold block mb-1">Error Occurred</span>
              {state.error}
            </div>
          )}

          {state.artistContext && <ArtistContextCard artistContext={state.artistContext} />}

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
