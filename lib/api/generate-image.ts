import type {
  GenerateImageRequestPayload,
  GenerateImageResponsePayload,
  PromptStatusResponsePayload,
  WorkflowInfoResponsePayload,
} from "@/lib/vidboard-types";

export const requestGeneratedImage = async (
  payload: GenerateImageRequestPayload
): Promise<GenerateImageResponsePayload> => {
  const response = await fetch("/api/generate-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Failed to generate image.");
  }

  return data as GenerateImageResponsePayload;
};

export const checkPromptStatus = async (
  promptId: string
): Promise<PromptStatusResponsePayload> => {
  const response = await fetch(`/api/generate-image?promptId=${encodeURIComponent(promptId)}`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Failed to check prompt status.");
  }
  return data as PromptStatusResponsePayload;
};

export const getWorkflowInfo = async (): Promise<WorkflowInfoResponsePayload> => {
  const response = await fetch("/api/generate-image");
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Failed to read workflow info.");
  }
  return data as WorkflowInfoResponsePayload;
};

export const freeComfyMemory = async (): Promise<void> => {
  try {
    await fetch("/api/generate-image", { method: "DELETE" });
  } catch {
    // Non-fatal — VRAM will be reclaimed when ComfyUI next loads a model.
  }
};
