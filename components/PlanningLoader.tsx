"use client";

import { planningSteps } from "./PlanningProgress";

interface PlanningLoaderProps {
  elapsed: number;
  stepIndex: number;
}

// ─── Variant A: CinematicLoader ─────────────────────────────────────────────
// Film strip scrolling across the top; amber progress rail; stage list below.
export function CinematicLoader({ elapsed, stepIndex }: PlanningLoaderProps) {
  const progress = Math.round(((stepIndex + 1) / planningSteps.length) * 100);
  const frames = Array.from({ length: 14 }, (_, i) => i);

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] w-full select-none">
      {/* ── Scrolling film strip ── */}
      <div className="relative w-full overflow-hidden mb-14" style={{ height: 70 }}>
        <div
          className="flex gap-2 items-center"
          style={{ width: "max-content", animation: "filmScroll 20s linear infinite" }}
        >
          {[...frames, ...frames].map((_, i) => (
            <div key={i} className="shrink-0" style={{ width: 80 }}>
              <div className="flex justify-around mb-1">
                {[0, 1, 2, 3].map((h) => (
                  <div key={h} className="w-2 h-1.5 rounded-sm bg-neutral-800" />
                ))}
              </div>
              <div
                className="border border-neutral-800 rounded-sm"
                style={{
                  height: 44,
                  background: `linear-gradient(${(i * 67 + 13) % 360}deg, #0a0a0a 0%, #171717 100%)`,
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
        {/* fade edges */}
        <div
          className="absolute inset-y-0 left-0 w-24 pointer-events-none"
          style={{ background: "linear-gradient(to right, #050505, transparent)" }}
        />
        <div
          className="absolute inset-y-0 right-0 w-24 pointer-events-none"
          style={{ background: "linear-gradient(to left, #050505, transparent)" }}
        />
      </div>

      {/* ── Status header ── */}
      <div className="flex items-center gap-2.5 mb-6">
        <div
          className="w-1.5 h-1.5 rounded-full bg-amber-400"
          style={{ animation: "dotPulse 1.5s ease-in-out infinite" }}
        />
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-400">
          Planning Blueprint
        </span>
        <span className="ml-1 text-[10px] font-mono text-neutral-600">{elapsed}s</span>
      </div>

      {/* ── Progress rail ── */}
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

      {/* ── Stage list ── */}
      <div className="space-y-3.5 w-full max-w-sm">
        {planningSteps.map((step, idx) => (
          <div
            key={step}
            className="flex items-center gap-3"
            style={idx === stepIndex ? { animation: "stageSlideIn 0.4s ease-out" } : {}}
          >
            <div
              className="shrink-0 rounded-full transition-all duration-500"
              style={{
                width: 6,
                height: 6,
                background:
                  idx < stepIndex ? "#78350f" : idx === stepIndex ? "#fbbf24" : "#1c1c1c",
                animation: idx === stepIndex ? "amberGlow 1.8s ease-in-out infinite" : undefined,
              }}
            />
            <span
              className="text-sm transition-colors duration-500"
              style={{
                color: idx < stepIndex ? "#404040" : idx === stepIndex ? "#fef3c7" : "#2a2a2a",
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
    </div>
  );
}

// ─── Variant B: WaveformLoader ───────────────────────────────────────────────
// Audio-visualiser bars pulse in amber; stage names sit below as a progress row.
const BAR_CONFIGS: Array<{ delay: string; minH: number; maxH: number }> = [
  { delay: "0s",     minH: 6,  maxH: 22 },
  { delay: "0.15s",  minH: 10, maxH: 40 },
  { delay: "0.05s",  minH: 16, maxH: 56 },
  { delay: "0.25s",  minH: 22, maxH: 70 },
  { delay: "0.35s",  minH: 28, maxH: 80 },
  { delay: "0.10s",  minH: 32, maxH: 88 },
  { delay: "0.45s",  minH: 26, maxH: 76 },
  { delay: "0.20s",  minH: 20, maxH: 64 },
  { delay: "0.30s",  minH: 24, maxH: 72 },
  { delay: "0.40s",  minH: 18, maxH: 58 },
  { delay: "0.08s",  minH: 14, maxH: 46 },
  { delay: "0.50s",  minH: 10, maxH: 36 },
  { delay: "0.18s",  minH: 7,  maxH: 24 },
  { delay: "0.38s",  minH: 4,  maxH: 16 },
];

export function WaveformLoader({ elapsed, stepIndex }: PlanningLoaderProps) {
  const activeBarCount = Math.round(((stepIndex + 1) / planningSteps.length) * BAR_CONFIGS.length);

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] w-full px-8 select-none">
      {/* ── Label ── */}
      <div className="flex items-center gap-2 mb-10">
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-400">
          Planning Blueprint
        </span>
        <span className="text-[10px] font-mono text-neutral-600">{elapsed}s</span>
      </div>

      {/* ── Waveform bars ── */}
      <div
        className="flex items-end gap-1 mb-12"
        style={{ height: 96 }}
        aria-hidden="true"
      >
        {BAR_CONFIGS.map((bar, i) => {
          const isActive = i < activeBarCount;
          const duration = isActive ? `${0.55 + (i % 4) * 0.1}s` : `${1.2 + (i % 3) * 0.2}s`;
          return (
            <div
              key={i}
              className="rounded-sm origin-bottom"
              style={{
                width: 6,
                minHeight: bar.minH,
                height: bar.maxH,
                background: isActive
                  ? `linear-gradient(to top, #b45309, #fbbf24)`
                  : "#1c1c1c",
                boxShadow: isActive ? "0 0 6px rgba(251,191,36,0.35)" : "none",
                animation: `waveBar ${duration} ease-in-out infinite`,
                animationDelay: bar.delay,
                transition: "background 0.8s ease, box-shadow 0.8s ease",
              }}
            />
          );
        })}
      </div>

      {/* ── Stage dots row ── */}
      <div className="flex items-start gap-0 w-full max-w-lg">
        {planningSteps.map((step, idx) => {
          const isDone = idx < stepIndex;
          const isCurrent = idx === stepIndex;
          return (
            <div key={step} className="flex-1 flex flex-col items-center gap-2">
              {/* connector line + dot */}
              <div className="flex items-center w-full">
                <div
                  className="flex-1 h-px transition-colors duration-700"
                  style={{ background: isDone || isCurrent ? "#b45309" : "#1c1c1c" }}
                />
                <div
                  className="shrink-0 rounded-full border transition-all duration-500"
                  style={{
                    width: 10,
                    height: 10,
                    borderColor: isDone ? "#b45309" : isCurrent ? "#fbbf24" : "#2a2a2a",
                    background: isDone ? "#78350f" : isCurrent ? "#fbbf24" : "transparent",
                    animation: isCurrent ? "amberGlow 1.8s ease-in-out infinite" : undefined,
                  }}
                />
                <div
                  className="flex-1 h-px transition-colors duration-700"
                  style={{ background: isDone ? "#b45309" : "#1c1c1c" }}
                />
              </div>
              {/* label */}
              <span
                className="text-[9px] text-center leading-tight px-0.5 transition-colors duration-500"
                style={{
                  color: isDone ? "#525252" : isCurrent ? "#fef3c7" : "#2a2a2a",
                  fontWeight: isCurrent ? 600 : 400,
                  maxWidth: 80,
                }}
              >
                {step}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Variant C: DirectorLoader ───────────────────────────────────────────────
// CRT-style terminal monitor with scanline effect and typewriter stage entries.
export function DirectorLoader({ elapsed, stepIndex }: PlanningLoaderProps) {
  const minutes = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const timestamp = `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] w-full px-8 select-none">
      {/* ── Monitor shell ── */}
      <div
        className="relative w-full max-w-lg rounded-lg overflow-hidden"
        style={{
          background: "#050505",
          border: "1px solid #1f1f1f",
          boxShadow: "0 0 40px rgba(251,191,36,0.05), inset 0 0 60px rgba(0,0,0,0.5)",
        }}
      >
        {/* Title bar */}
        <div
          className="flex items-center justify-between px-4 py-2.5 border-b"
          style={{ borderColor: "#1a1a1a", background: "#0a0a0a" }}
        >
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-neutral-800" />
            <div className="w-2.5 h-2.5 rounded-full bg-neutral-800" />
            <div className="w-2.5 h-2.5 rounded-full bg-neutral-800" />
          </div>
          <span className="text-[9px] font-mono tracking-widest text-neutral-600 uppercase">
            VidBoard AI — Planning
          </span>
          <span className="text-[9px] font-mono text-neutral-700">{timestamp}</span>
        </div>

        {/* Terminal body */}
        <div className="relative px-5 py-5 space-y-2.5" style={{ minHeight: 200 }}>
          {/* CRT scanline overlay */}
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none overflow-hidden"
            style={{ borderRadius: "inherit" }}
          >
            {/* repeating horizontal lines */}
            <div
              className="absolute inset-0"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.18) 3px, rgba(0,0,0,0.18) 4px)",
              }}
            />
            {/* moving scan highlight */}
            <div
              className="absolute left-0 right-0"
              style={{
                height: "6%",
                background:
                  "linear-gradient(to bottom, transparent, rgba(251,191,36,0.03), transparent)",
                animation: "scanline 4s linear infinite",
              }}
            />
          </div>

          {planningSteps.map((step, idx) => {
            const isDone = idx < stepIndex;
            const isCurrent = idx === stepIndex;
            const isPending = idx > stepIndex;

            if (isPending) {
              return (
                <div key={step} className="flex items-center gap-2.5">
                  <span className="text-[11px] font-mono text-neutral-800">{"·"}</span>
                  <span className="text-[11px] font-mono text-neutral-800">{step}</span>
                </div>
              );
            }

            if (isDone) {
              return (
                <div
                  key={step}
                  className="flex items-center gap-2.5"
                  style={{ animation: "typeIn 0.3s ease-out" }}
                >
                  <span className="text-[11px] font-mono text-amber-800">{"✓"}</span>
                  <span className="text-[11px] font-mono text-neutral-600">{step}</span>
                </div>
              );
            }

            // current
            return (
              <div
                key={step}
                className="flex items-center gap-2.5"
                style={{ animation: "typeIn 0.3s ease-out" }}
              >
                <span className="text-[11px] font-mono text-amber-400">{">"}</span>
                <span className="text-[11px] font-mono text-amber-200">{step}</span>
                <span
                  className="text-[11px] font-mono text-amber-400 ml-0.5"
                  style={{ animation: "cursorBlink 0.9s step-end infinite" }}
                >
                  ▌
                </span>
              </div>
            );
          })}

          {/* bottom status line */}
          <div className="pt-3 border-t mt-4" style={{ borderColor: "#1a1a1a" }}>
            <span className="text-[9px] font-mono text-neutral-700">
              {"[ollama]"} reading context · elapsed {elapsed}s
            </span>
          </div>
        </div>
      </div>

      <p className="mt-5 text-[10px] font-mono text-neutral-700 tracking-wider">
        Local planning can take a minute or two
      </p>
    </div>
  );
}
