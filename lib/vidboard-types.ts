export type AspectRatio = "16:9" | "9:16" | "1:1";

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
  isGenerating?: boolean;
  error?: string;
}

export interface AppState {
  artistName: string;
  trackTitle: string;
  lyrics: string;
  theme: string;
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
  numberOfFrames: number;
  aspectRatio: AspectRatio;
}

export interface PlanResponsePayload {
  artistContext: string;
  visualBible: string;
  frames: FramePlan[];
}
