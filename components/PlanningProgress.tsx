import { Loader2 } from "lucide-react";

export const planningSteps = [
  "Searching the web for artist context",
  "Writing the director context guide",
  "Building the visual bible",
  "Structuring the storyboard JSON",
  "Checking prompts and finishing blueprint",
];

interface PlanningProgressProps {
  elapsed: number;
  stepIndex: number;
}

export function PlanningProgress({ elapsed, stepIndex }: PlanningProgressProps) {
  return (
    <div className="rounded-md border border-amber-500/25 bg-amber-500/10 p-3 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-amber-400">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Planning
        </div>
        <span className="text-[10px] font-mono text-amber-200/80">{elapsed}s</span>
      </div>
      <div className="space-y-2">
        {planningSteps.map((step, idx) => (
          <div key={step} className="flex items-center gap-2 text-[10px]">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                idx <= stepIndex ? "bg-amber-400" : "bg-neutral-700"
              }`}
            ></span>
            <span
              className={
                idx === stepIndex
                  ? "text-amber-100"
                  : idx < stepIndex
                    ? "text-neutral-400"
                    : "text-neutral-600"
              }
            >
              {step}
            </span>
          </div>
        ))}
      </div>
      <p className="text-[10px] leading-relaxed text-neutral-500">
        Local planning can take a minute or two while Ollama reads web results and writes structured
        JSON.
      </p>
    </div>
  );
}
