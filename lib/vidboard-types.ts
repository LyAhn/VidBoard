export type AspectRatio = "16:9" | "9:16" | "1:1";
export type VisualDirection = "artist" | "lyrics" | "theme";

export interface FramePlan {
  frame_number: number;
  timestamp_hint: string;
  lyric_line: string;
  scene_description: string;
  camera_angle: string;
  lighting: string;
  colour_palette: string;
  motion_hint: string;
  flow_prompt: string;
  image_prompt: string;
  character_present: boolean;
}

export interface FrameData extends FramePlan {
  startImageBase64?: string;
  endImageBase64?: string;
  startImagePath?: string;
  endImagePath?: string;
  startImageHistory?: string[];
  endImageHistory?: string[];
  startPromptId?: string;
  endPromptId?: string;
  next_lyric_line?: string;
  isGeneratingStart?: boolean;
  isGeneratingEnd?: boolean;
  error?: string;
}

export interface AppState {
  artistName: string;
  trackTitle: string;
  lyrics: string;
  theme: string;
  visualDirection: VisualDirection;
  visualConcept: string;
  numberOfFrames: number;
  aspectRatio: AspectRatio;
  artistContext: string | null;
  visualBible: string | null;
  characterReferenceImage: string | null;
  frames: FrameData[];
  isPlanning: boolean;
  isGeneratingImages: boolean;
  error: string | null;
  statusMessage: string | null;
}

export interface PlanRequestPayload {
  artistName: string;
  trackTitle: string;
  lyrics: string;
  theme: string;
  visualDirection: VisualDirection;
  visualConcept: string;
  numberOfFrames: number;
  aspectRatio: AspectRatio;
}

export interface PlanResponsePayload {
  artistContext: string;
  visualBible: string;
  frames: FramePlan[];
}

export interface GenerateImageRequestPayload {
  prompt: string;
  aspectRatio: AspectRatio;
  kind?: "start" | "end";
  projectId?: string;
  referenceImageBase64?: string | null;
  initImageBase64?: string | null;
  workflow?: string;
}

export interface GenerateImageResponsePayload {
  imageBase64: string;
  promptId: string;
  workflow: string;
  imagePath?: string;
}

export interface ProjectSummaryPayload {
  id: string;
  name: string;
  artistName: string;
  trackTitle: string;
  createdAt: string;
  updatedAt: string;
  thumbnailImagePath: string | null;
}

export interface ProjectDetailPayload extends ProjectSummaryPayload {
  stateJson: string;
}

export type PromptStatusResponsePayload =
  | { status: "done"; imageBase64: string; promptId: string }
  | { status: "pending" }
  | { status: "not_found" };

export interface WorkflowInfoResponsePayload {
  start: {
    workflow: string;
    capabilities: {
      referenceImage: boolean;
      initImage: boolean;
    };
  };
  end: {
    workflow: string;
    capabilities: {
      referenceImage: boolean;
      initImage: boolean;
    };
  };
}
