// IMPORTANT: Never call COMFYUI_BASE_URL directly from client code.
// All image generation must go via /api/generate-image.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import type { AspectRatio, GenerateImageRequestPayload } from "@/lib/vidboard-types";

export const runtime = "nodejs";

type WorkflowName = NonNullable<GenerateImageRequestPayload["workflow"]>;

interface WorkflowNodeMap {
  prompt: string;
  seed: string;
  scheduler?: string;
  latent?: string;
  saveImage?: string;
  referenceImage?: string;
  initImage?: string;
  negativePrompt?: string;
}

interface WorkflowDefinition {
  file: string;
  exampleFile?: string;
  capabilities?: {
    referenceImage?: boolean;
    initImage?: boolean;
  };
  nodes: WorkflowNodeMap;
}

interface WorkflowConfig {
  defaultWorkflow: WorkflowName;
  workflows: Record<string, WorkflowDefinition>;
}

interface ComfyImageOutput {
  filename: string;
  subfolder?: string;
  type?: string;
}

const COMFYUI_BASE_URL = process.env.COMFYUI_BASE_URL || "http://127.0.0.1:8188";
const WORKFLOW_DIR = process.env.COMFYUI_WORKFLOW_DIR
  ? path.resolve(process.cwd(), process.env.COMFYUI_WORKFLOW_DIR)
  : path.join(process.cwd(), "comfyui");
const CONFIG_FILE = process.env.COMFYUI_WORKFLOW_CONFIG || "workflows.json";
const EXAMPLE_CONFIG_FILE = "workflows.example.json";
// Short timeout for initial connection check and queue submission — these should be fast.
const CONNECTION_TIMEOUT_MS = Number(process.env.COMFYUI_CONNECTION_TIMEOUT_MS || 10_000);
// Generous timeout per individual poll request — ComfyUI HTTP can be slow while loading a model.
const POLL_TIMEOUT_MS = Number(process.env.COMFYUI_POLL_TIMEOUT_MS || 60_000);
// Total wall-clock budget per image — covers cold model load + generation on slow hardware.
const GENERATION_TIMEOUT_MS = Number(process.env.COMFYUI_GENERATION_TIMEOUT_MS || 900_000);

const ASPECT_SIZES: Record<AspectRatio, { width: number; height: number }> = {
  "16:9": { width: 1344, height: 768 },
  "9:16": { width: 768, height: 1344 },
  "1:1": { width: 1024, height: 1024 },
};

const isGenerateImageRequest = (value: unknown): value is GenerateImageRequestPayload => {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  return (
    typeof data.prompt === "string" &&
    data.prompt.trim().length > 0 &&
    ["16:9", "9:16", "1:1"].includes(String(data.aspectRatio)) &&
    (data.kind === undefined || ["start", "end"].includes(String(data.kind))) &&
    (data.referenceImageBase64 === undefined ||
      data.referenceImageBase64 === null ||
      typeof data.referenceImageBase64 === "string") &&
    (data.initImageBase64 === undefined ||
      data.initImageBase64 === null ||
      typeof data.initImageBase64 === "string") &&
    (data.workflow === undefined || typeof data.workflow === "string")
  );
};

const fetchWithTimeout = async (url: string, init?: RequestInit, timeoutMs = CONNECTION_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

const readJsonFile = async <T,>(filePath: string): Promise<T> => {
  const contents = await readFile(filePath, "utf8");
  return JSON.parse(contents) as T;
};

const loadWorkflowConfig = async (): Promise<WorkflowConfig> => {
  const configuredPath = path.join(WORKFLOW_DIR, CONFIG_FILE);
  const examplePath = path.join(WORKFLOW_DIR, EXAMPLE_CONFIG_FILE);

  try {
    return await readJsonFile<WorkflowConfig>(configuredPath);
  } catch {
    return readJsonFile<WorkflowConfig>(examplePath);
  }
};

const loadWorkflow = async (definition: WorkflowDefinition) => {
  const workflowPath = path.join(WORKFLOW_DIR, definition.file);

  try {
    return await readJsonFile<Record<string, { inputs?: Record<string, unknown> }>>(workflowPath);
  } catch (error) {
    if (!definition.exampleFile) throw error;
    return readJsonFile<Record<string, { inputs?: Record<string, unknown> }>>(
      path.join(WORKFLOW_DIR, definition.exampleFile)
    );
  }
};

const resolveWorkflowDefinition = async (requestedWorkflow?: string, kind?: "start" | "end") => {
  const config = await loadWorkflowConfig();
  const workflowName =
    requestedWorkflow ||
    (kind === "start" ? process.env.COMFYUI_START_WORKFLOW : undefined) ||
    (kind === "end" ? process.env.COMFYUI_END_WORKFLOW : undefined) ||
    process.env.COMFYUI_WORKFLOW ||
    config.defaultWorkflow;
  const definition = config.workflows[workflowName];

  if (!definition) {
    throw new Error(`Unknown ComfyUI workflow "${workflowName}".`);
  }

  return { workflowName, definition };
};

const summarizeWorkflow = (workflowName: string, definition: WorkflowDefinition) => ({
  workflow: workflowName,
  capabilities: {
    referenceImage: Boolean(definition.capabilities?.referenceImage && definition.nodes.referenceImage),
    initImage: Boolean(definition.capabilities?.initImage && definition.nodes.initImage),
  },
});

const requireWorkflowNode = (
  workflow: Record<string, { inputs?: Record<string, unknown> }>,
  id: string,
  label: string
) => {
  const node = workflow[id];
  if (!node) {
    throw new Error(`Workflow is missing configured ${label} node "${id}".`);
  }

  node.inputs ??= {};
  return node;
};

const setInputIfPresent = (
  workflow: Record<string, { inputs?: Record<string, unknown> }>,
  nodeId: string | undefined,
  input: string,
  value: unknown
) => {
  if (!nodeId || !workflow[nodeId]) return;
  workflow[nodeId].inputs ??= {};
  workflow[nodeId].inputs[input] = value;
};

const injectWorkflowInputs = (
  workflowName: string,
  workflow: Record<string, { inputs?: Record<string, unknown> }>,
  nodes: WorkflowNodeMap,
  prompt: string,
  aspectRatio: AspectRatio,
  referenceFilename?: string,
  initFilename?: string
) => {
  const size = ASPECT_SIZES[aspectRatio];

  requireWorkflowNode(workflow, nodes.prompt, "prompt").inputs!.text = prompt;
  requireWorkflowNode(workflow, nodes.seed, "seed").inputs!.noise_seed = Math.floor(
    Math.random() * Number.MAX_SAFE_INTEGER
  );

  setInputIfPresent(workflow, nodes.scheduler, "width", size.width);
  setInputIfPresent(workflow, nodes.scheduler, "height", size.height);
  setInputIfPresent(workflow, nodes.latent, "width", size.width);
  setInputIfPresent(workflow, nodes.latent, "height", size.height);
  setInputIfPresent(workflow, nodes.latent, "batch_size", 1);
  setInputIfPresent(workflow, nodes.saveImage, "filename_prefix", "VidBoard/frame");
  if (nodes.negativePrompt && workflow[nodes.negativePrompt]) {
    const isFlux = /flux/i.test(workflowName);
    if (!isFlux) {
      requireWorkflowNode(workflow, nodes.negativePrompt, "negative prompt").inputs!.text =
        process.env.COMFYUI_NEGATIVE_PROMPT ?? "";
    }
  }

  if (referenceFilename && nodes.referenceImage) {
    requireWorkflowNode(workflow, nodes.referenceImage, "reference image").inputs!.image =
      referenceFilename;
  }

  if (initFilename && nodes.initImage) {
    requireWorkflowNode(workflow, nodes.initImage, "init image").inputs!.image = initFilename;
  }
};

const ensureComfyReachable = async () => {
  try {
    const response = await fetchWithTimeout(
      `${COMFYUI_BASE_URL}/system_stats`,
      undefined,
      CONNECTION_TIMEOUT_MS
    );
    if (!response.ok) {
      throw new Error(`ComfyUI responded with HTTP ${response.status}.`);
    }
  } catch (error) {
    throw new Error(
      `ComfyUI is not reachable at ${COMFYUI_BASE_URL}. Start ComfyUI or set COMFYUI_BASE_URL in .env.local. ${
        error instanceof Error ? error.message : ""
      }`.trim()
    );
  }
};

const uploadReferenceImage = async (referenceImageBase64?: string | null) => {
  if (!referenceImageBase64) return undefined;

  const imageBase64 = referenceImageBase64.includes(",")
    ? referenceImageBase64.split(",").at(-1) || ""
    : referenceImageBase64;
  const buffer = Buffer.from(imageBase64, "base64");
  const formData = new FormData();
  const filename = `vidboard-reference-${crypto.randomUUID()}.png`;

  formData.append("image", new Blob([buffer], { type: "image/png" }), filename);
  formData.append("type", "input");
  formData.append("overwrite", "true");

  const response = await fetchWithTimeout(
    `${COMFYUI_BASE_URL}/upload/image`,
    { method: "POST", body: formData },
    CONNECTION_TIMEOUT_MS
  );

  if (!response.ok) {
    throw new Error(`ComfyUI reference upload failed: ${await response.text()}`);
  }

  const data = (await response.json()) as { name?: string };
  return data.name || filename;
};

const assertWorkflowCapabilities = (
  definition: WorkflowDefinition,
  hasReferenceImage: boolean,
  hasInitImage: boolean
) => {
  if (hasReferenceImage && (!definition.capabilities?.referenceImage || !definition.nodes.referenceImage)) {
    throw new Error(
      "A character reference image was provided, but the selected ComfyUI workflow does not map a reference image node. Add a workflow with capabilities.referenceImage=true and nodes.referenceImage."
    );
  }

  if (hasInitImage && (!definition.capabilities?.initImage || !definition.nodes.initImage)) {
    throw new Error(
      "An end-frame continuity image was provided, but the selected ComfyUI workflow does not map an init/start image node. Add an img2img/reference workflow with capabilities.initImage=true and nodes.initImage."
    );
  }
};

const queueWorkflow = async (workflow: Record<string, unknown>) => {
  const response = await fetchWithTimeout(
    `${COMFYUI_BASE_URL}/prompt`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: workflow, client_id: crypto.randomUUID() }),
    },
    CONNECTION_TIMEOUT_MS
  );

  const data = await response.json();
  if (!response.ok) {
    const parts: string[] = [];
    if (data.error?.message) parts.push(data.error.message);
    if (data.error?.details) parts.push(data.error.details);
    if (data.node_errors && typeof data.node_errors === "object") {
      const nodeMessages = Object.values(data.node_errors as Record<string, { class_type?: string; errors?: Array<{ message?: string }> }>)
        .flatMap((n) => (n.errors ?? []).map((e) => `${n.class_type ?? "node"}: ${e.message ?? "unknown"}`));
      if (nodeMessages.length) parts.push(nodeMessages.join("; "));
    }
    throw new Error(
      `ComfyUI workflow validation failed: ${parts.length ? parts.join(" — ") : JSON.stringify(data)}`
    );
  }

  if (!data.prompt_id) {
    throw new Error("ComfyUI did not return a prompt_id.");
  }

  return data.prompt_id as string;
};

interface ComfyHistoryEntry {
  outputs?: Record<string, { images?: ComfyImageOutput[] }>;
  status?: { status_str?: string; completed?: boolean };
}

const findFirstImage = (historyItem: unknown): ComfyImageOutput | undefined => {
  const entry = historyItem as ComfyHistoryEntry | undefined;
  if (!entry) return undefined;

  // Surface ComfyUI execution errors immediately rather than polling until timeout.
  if (entry.status?.status_str === "error") {
    throw new Error("ComfyUI reported a workflow execution error.");
  }

  if (!entry.outputs) return undefined;

  for (const nodeOutput of Object.values(entry.outputs)) {
    const image = nodeOutput.images?.[0];
    if (image) return image;
  }

  return undefined;
};

const pollForImage = async (promptId: string) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < GENERATION_TIMEOUT_MS) {
    await new Promise((resolve) => setTimeout(resolve, 2000));

    try {
      const response = await fetchWithTimeout(
        `${COMFYUI_BASE_URL}/history/${promptId}`,
        undefined,
        POLL_TIMEOUT_MS
      );

      if (!response.ok) {
        // Non-OK from history endpoint — ComfyUI may be momentarily busy. Keep polling.
        continue;
      }

      const history = await response.json();
      const image = findFirstImage(history[promptId]);
      if (image) return image;
    } catch (error) {
      // AbortError (poll timeout) or network hiccup while model is loading — keep polling.
      if (error instanceof Error && error.message.includes("ComfyUI reported")) {
        throw error;
      }
      // Otherwise swallow and retry within the generation window.
    }
  }

  throw new Error(`ComfyUI generation timed out after ${GENERATION_TIMEOUT_MS / 1000}s.`);
};

const classifyComfyError = (error: unknown): string => {
  if (!(error instanceof Error)) return "Failed to generate image.";
  const msg = error.message;
  if (msg.includes("not reachable")) {
    return `ComfyUI is not running. Start it with: python main.py --listen`;
  }
  if (msg.includes("timed out")) {
    return `Frame generation timed out. Check ComfyUI's queue at ${COMFYUI_BASE_URL}.`;
  }
  return msg;
};

const downloadImageAsBase64 = async (image: ComfyImageOutput) => {
  const params = new URLSearchParams({
    filename: image.filename,
    subfolder: image.subfolder || "",
    type: image.type || "output",
  });
  const response = await fetchWithTimeout(`${COMFYUI_BASE_URL}/view?${params}`);

  if (!response.ok) {
    throw new Error(`ComfyUI image fetch failed: HTTP ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer.toString("base64");
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!isGenerateImageRequest(body)) {
      return NextResponse.json({ error: "Invalid image generation request." }, { status: 400 });
    }

    await ensureComfyReachable();

    const { workflowName, definition } = await resolveWorkflowDefinition(body.workflow, body.kind);

    assertWorkflowCapabilities(
      definition,
      Boolean(body.referenceImageBase64),
      Boolean(body.initImageBase64)
    );

    const workflow = await loadWorkflow(definition);
    const referenceFilename = await uploadReferenceImage(body.referenceImageBase64);
    const initFilename = await uploadReferenceImage(body.initImageBase64);
    injectWorkflowInputs(
      workflowName,
      workflow,
      definition.nodes,
      body.prompt,
      body.aspectRatio,
      referenceFilename,
      initFilename
    );

    const promptId = await queueWorkflow(workflow);
    const outputImage = await pollForImage(promptId);
    const imageBase64 = await downloadImageAsBase64(outputImage);

    return NextResponse.json({ imageBase64, promptId, workflow: workflowName });
  } catch (error) {
    console.error("ComfyUI generation failed", error);
    return NextResponse.json({ error: classifyComfyError(error) }, { status: 500 });
  }
}

/**
 * DELETE /api/generate-image
 *
 * Instructs ComfyUI to unload all models from VRAM and free GPU memory.
 * Call this after a storyboard generation run is fully complete.
 * Non-fatal — a failure here does not affect already-generated images.
 */
export async function DELETE() {
  try {
    await ensureComfyReachable();
    const response = await fetchWithTimeout(
      `${COMFYUI_BASE_URL}/free`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unload_models: true, free_memory: true }),
      },
      CONNECTION_TIMEOUT_MS
    );

    if (!response.ok) {
      throw new Error(`ComfyUI /free responded with HTTP ${response.status}`);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.warn("ComfyUI VRAM free failed (non-fatal)", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/generate-image?promptId=<id>
 *
 * Checks a previously queued ComfyUI job by its prompt ID.
 * Returns:
 *   { status: "done", imageBase64, promptId }   — job completed, image ready
 *   { status: "pending" }                        — job still in queue or running
 *   { status: "not_found" }                      — unknown prompt ID
 */
export async function GET(req: NextRequest) {
  const promptId = req.nextUrl.searchParams.get("promptId");
  if (!promptId) {
    try {
      const startWorkflow = await resolveWorkflowDefinition(undefined, "start");
      const endWorkflow = await resolveWorkflowDefinition(undefined, "end");
      return NextResponse.json({
        start: summarizeWorkflow(startWorkflow.workflowName, startWorkflow.definition),
        end: summarizeWorkflow(endWorkflow.workflowName, endWorkflow.definition),
      });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Failed to read workflow info." },
        { status: 500 }
      );
    }
  }

  try {
    await ensureComfyReachable();

    // Check history first — completed jobs live here.
    const historyRes = await fetchWithTimeout(
      `${COMFYUI_BASE_URL}/history/${promptId}`,
      undefined,
      POLL_TIMEOUT_MS
    );

    if (historyRes.ok) {
      const history = await historyRes.json();
      const entry = history[promptId] as ComfyHistoryEntry | undefined;

      if (entry?.status?.status_str === "error") {
        return NextResponse.json(
          { error: "ComfyUI reported a workflow execution error for this job." },
          { status: 500 }
        );
      }

      if (entry?.outputs) {
        const image = findFirstImage(entry);
        if (image) {
          const imageBase64 = await downloadImageAsBase64(image);
          return NextResponse.json({ status: "done", imageBase64, promptId });
        }
      }
    }

    // Check the live queue — job may still be pending or running.
    const queueRes = await fetchWithTimeout(
      `${COMFYUI_BASE_URL}/queue`,
      undefined,
      CONNECTION_TIMEOUT_MS
    );

    if (queueRes.ok) {
      const queue = (await queueRes.json()) as {
        queue_running?: unknown[][];
        queue_pending?: unknown[][];
      };
      const allJobs = [...(queue.queue_running ?? []), ...(queue.queue_pending ?? [])];
      const isActive = allJobs.some((job) => Array.isArray(job) && job[1] === promptId);
      if (isActive) {
        return NextResponse.json({ status: "pending" });
      }
    }

    return NextResponse.json({ status: "not_found" });
  } catch (error) {
    console.error("ComfyUI status check failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to check job status." },
      { status: 500 }
    );
  }
}
