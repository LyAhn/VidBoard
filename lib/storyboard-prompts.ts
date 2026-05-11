import type { FrameData } from "@/lib/vidboard-types";

const VISUAL_BIBLE_MAX_CHARS = 200;

const cleanPrompt = (value: string) =>
  value
    .replace(/\s+/g, " ")
    .replace(/Visual Bible:/gi, "")
    .trim();

const truncateVisualBible = (visualBible: string) => {
  const cleaned = cleanPrompt(visualBible);
  if (cleaned.length <= VISUAL_BIBLE_MAX_CHARS) return cleaned;
  const truncated = cleaned.slice(0, VISUAL_BIBLE_MAX_CHARS);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 100 ? truncated.slice(0, lastSpace) : truncated) + ".";
};

const stripVisualBible = (imagePrompt: string, visualBible: string) => {
  const trimmedVisualBible = visualBible.trim();
  const trimmedPrompt = imagePrompt.trim();
  if (!trimmedVisualBible) return trimmedPrompt;
  if (trimmedPrompt.startsWith(trimmedVisualBible)) {
    return trimmedPrompt.slice(trimmedVisualBible.length).trim();
  }
  return trimmedPrompt;
};

const cameraPackage = (cameraAngle: string) => {
  const lower = cameraAngle.toLowerCase();
  if (lower.includes("close") || lower.includes("portrait")) {
    return "Canon EOS R5, 85mm f/1.4, shallow depth of field, natural skin texture, bokeh background";
  }
  if (lower.includes("wide") || lower.includes("establish")) {
    return "ARRI Alexa Mini LF, 24mm cinema lens, deep focus, natural perspective, environment visible";
  }
  if (lower.includes("hand") || lower.includes("pov") || lower.includes("shoulder")) {
    return "Fujifilm X-T5, 35mm lens, handheld documentary realism, available light, slight motion blur";
  }
  if (lower.includes("medium") || lower.includes("mid")) {
    return "ARRI Alexa Mini LF, 50mm cinema lens, waist-up framing, shallow focus, natural light";
  }
  if (lower.includes("two") || lower.includes("over")) {
    return "Canon EOS R5, 50mm f/1.8, two-person framing, foreground shoulder soft, mid-depth focus";
  }
  if (lower.includes("aerial") || lower.includes("drone") || lower.includes("bird")) {
    return "DJI Inspire 3, wide rectilinear lens, aerial perspective, sharp throughout frame";
  }
  return "ARRI Alexa Mini LF, 35mm cinema lens, realistic live-action texture, natural grain";
};

const buildSharedPrompt = (frame: FrameData, visualBible: string) => {
  const scenePrompt = cleanPrompt(stripVisualBible(frame.image_prompt, visualBible));
  const vbSummary = truncateVisualBible(visualBible);
  const camera = cameraPackage(frame.camera_angle);
  const lighting = cleanPrompt(frame.lighting).toLowerCase();
  const colour = cleanPrompt(frame.colour_palette).toLowerCase();

  return [
    `${scenePrompt}.`,
    `Production design: ${vbSummary}`,
    `${camera}.`,
    `Lighting: ${lighting}.`,
    `Colour grade: ${colour}.`,
    "Photorealistic live-action music video frame. Real lens behaviour, subtle film grain, natural shadows, symmetrical faces with correct anatomy, consistent costume and instruments across the sequence.",
  ].join(" ");
};

const lyricMood = (lyric?: string) =>
  lyric ? `Emotional tone of this moment: ${cleanPrompt(lyric)}` : undefined;

export const buildStartFramePrompt = (frame: FrameData, visualBible: string) =>
  [
    buildSharedPrompt(frame, visualBible),
    "Start frame: exact initial pose, composition, prop placement, and scene state before motion begins.",
    lyricMood(frame.lyric_line),
    frame.character_present
      ? "If a character reference image is provided, match the reference identity and wardrobe exactly."
      : undefined,
  ]
    .filter(Boolean)
    .join(" ");

export const buildEndFramePrompt = (frame: FrameData, visualBible: string) =>
  [
    buildSharedPrompt(frame, visualBible),
    `End frame of the same shot, a few seconds later. Visible motion: ${cleanPrompt(frame.flow_prompt)}.`,
    lyricMood(frame.next_lyric_line || frame.lyric_line),
    "Continuity with Start frame required. Change at least two visible elements in a physically plausible way: pose, hand position, prop placement, focus plane, foreground particles, or light direction. Same character identity, costume, instrument, and environment.",
  ]
    .filter(Boolean)
    .join(" ");
