"use client";

import { planningSteps } from "./PlanningProgress";

interface PlanningLoaderProps {
  elapsed: number;
  stepIndex: number;
}

function StatusHeader({ elapsed }: { elapsed: number }) {
  return (
    <div className="flex items-center gap-2.5 mb-6">
      <div
        className="w-1.5 h-1.5 rounded-full bg-amber-400"
        style={{ animation: "dot-pulse 1.5s ease-in-out infinite" }}
      />
      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-400">
        Planning Blueprint
      </span>
      <span className="ml-1 text-[10px] font-mono text-neutral-600">{elapsed}s</span>
    </div>
  );
}

function ProgressRail({ stepIndex }: { stepIndex: number }) {
  const safeIndex = Math.min(Math.max(stepIndex, 0), Math.max(planningSteps.length - 1, 0));
  const progress =
    planningSteps.length === 0 ? 0 : Math.round(((safeIndex + 1) / planningSteps.length) * 100);
  return (
    <div className="w-full max-w-sm mb-8">
      <div className="h-px bg-neutral-800 relative overflow-hidden rounded-full">
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${progress}%`,
            background: "linear-gradient(to right, #b45309, #fbbf24)",
            boxShadow: "0 0 8px 1px rgba(251,191,36,0.5)",
            transition: "width 1.5s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
      </div>
    </div>
  );
}

function StageList({ stepIndex }: { stepIndex: number }) {
  return (
    <div className="space-y-3.5 w-full max-w-sm">
      {planningSteps.map((step, idx) => (
        <div
          key={step}
          className="flex items-center gap-3"
          style={idx === stepIndex ? { animation: "stage-slide-in 0.4s ease-out" } : {}}
        >
          <div
            className="shrink-0 rounded-full transition-all duration-500"
            style={{
              width: 6,
              height: 6,
              background: idx < stepIndex ? "#78350f" : idx === stepIndex ? "#fbbf24" : "#303030",
              animation: idx === stepIndex ? "amber-glow 1.8s ease-in-out infinite" : undefined,
            }}
          />
          <span
            className="text-sm transition-colors duration-500"
            style={{
              color: idx < stepIndex ? "#525252" : idx === stepIndex ? "#fef3c7" : "#444444",
              fontWeight: idx === stepIndex ? 500 : 400,
            }}
          >
            {step}
          </span>
          {idx < stepIndex && (
            <span className="ml-auto text-[10px] text-neutral-700 font-mono">done</span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── CinematicLoader ──────────────────────────────────────────────────────────
// Scrolling horizontal film strip above a progress rail and stage list.
//
// Seamless-loop maths:
//   FRAME_W + FRAME_GAP = 88px per slot (both copies identical)
//   Total strip width   = FRAME_COUNT × 2 × 88px
//   filmScroll keyframe = exactly FRAME_COUNT × 88px  →  no jump on repeat
const FRAME_COUNT = 24;
const FRAME_W = 80; // px
const FRAME_GAP = 8; // px — marginRight so every slot contributes equally to width

export function CinematicLoader({ elapsed, stepIndex }: PlanningLoaderProps) {
  const stripItems = [
    ...Array.from({ length: FRAME_COUNT }, (_, i) => i),
    ...Array.from({ length: FRAME_COUNT }, (_, i) => i),
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] w-full select-none">
      {/* ── Scrolling film strip ── */}
      <div className="relative w-full overflow-hidden mb-14" style={{ height: 70 }}>
        <div
          className="flex items-center"
          style={{
            width: stripItems.length * (FRAME_W + FRAME_GAP),
            animation: "film-scroll 22s linear infinite",
          }}
        >
          {stripItems.map((frameIdx, i) => (
            <div
              key={i}
              className="shrink-0"
              style={{ width: FRAME_W, marginRight: FRAME_GAP }}
            >
              <div className="flex justify-around mb-1">
                {[0, 1, 2, 3].map((h) => (
                  <div key={h} className="w-2 h-1.5 rounded-sm bg-neutral-800" />
                ))}
              </div>
              <div
                className="border border-neutral-800 rounded-sm"
                style={{
                  height: 44,
                  background: `linear-gradient(${(frameIdx * 67 + 13) % 360}deg, #171717 0%, #1e1e1e 100%)`,
                }}
              />
              <div className="flex justify-around mt-1">
                {[0, 1, 2, 3].map((h) => (
                  <div key={h} className="w-2 h-1.5 rounded-sm bg-neutral-800" />
                ))}
              </div>
            </div>
          ))}
        </div>
        {/* Fade edges */}
        <div
          className="absolute inset-y-0 left-0 w-24 pointer-events-none"
          style={{ background: "linear-gradient(to right, #111111, transparent)" }}
        />
        <div
          className="absolute inset-y-0 right-0 w-24 pointer-events-none"
          style={{ background: "linear-gradient(to left, #111111, transparent)" }}
        />
      </div>

      <StatusHeader elapsed={elapsed} />
      <ProgressRail stepIndex={stepIndex} />
      <StageList stepIndex={stepIndex} />
    </div>
  );
}
