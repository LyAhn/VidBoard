import type { PlanRequestPayload, PlanResponsePayload } from "@/lib/vidboard-types";

export const requestStoryboardPlan = async (
  payload: PlanRequestPayload
): Promise<PlanResponsePayload> => {
  const response = await fetch("/api/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Failed to plan storyboard.");
  }

  return data as PlanResponsePayload;
};
