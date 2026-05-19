import type { FrameData } from "@/lib/vidboard-types";

const VISUAL_BIBLE_MAX_CHARS = 600;

const cleanPrompt = (value: string) =>
  value
    .replace(/\s+/g, " ")
    .replace(/Visual Bible:/gi, "")
    .trim();

// Attempt to pull the two highest-value anchors (colour grade + environment) from a
// structured Visual Bible before falling back to a plain character slice. This ensures
// the model always sees the scene-consistency anchors even when the full VB is long.
const truncateVisualBible = (visualBible: string): string => {
  const cleaned = cleanPrompt(visualBible);
  if (cleaned.length <= VISUAL_BIBLE_MAX_CHARS) return cleaned;

  const extract = (pattern: RegExp): string | undefined => {
    const m = cleaned.match(pattern);
    if (!m) return undefined;
    // Take up to two sentences from the matched section.
    return m[0].replace(/\*{1,2}/g, "").replace(/#+\s*/g, "").trim();
  };

  const colour = extract(/(?:Fixed\s+Colou?r\s+Grade[^:]*:)[^*#]{0,300}/i);
  const env = extract(/(?:Fixed\s+Environment[^:]*:)[^*#]{0,300}/i);
  const sections = [colour, env].filter(Boolean) as string[];

  if (sections.length > 0) {
    const extracted = sections.join(" ").slice(0, VISUAL_BIBLE_MAX_CHARS);
    const lastSpace = extracted.lastIndexOf(" ");
    return (lastSpace > 50 ? extracted.slice(0, lastSpace) : extracted).trim();
  }

  // Fallback: plain slice at word boundary.
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
  const scenePrompt =
    cleanPrompt(stripVisualBible(frame.image_prompt, visualBible)) ||
    cleanPrompt(frame.image_prompt);
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

// Base negative for any workflow that supports negative prompts. Targets the most
// common failure modes: blown-out colour grade, anatomy errors, modern/stock look.
const BASE_NEGATIVE = [
  "daylight, bright sunlight, outdoor lighting, overexposed, washed out, blown highlights",
  "modern interior, contemporary setting, clean minimalist space",
  "stock photo, commercial photography, professional headshot",
  "cartoon, illustration, painting, anime, cgi, render, 3d",
  "extra limbs, deformed hands, mutated fingers, bad anatomy, disfigured, ugly",
  "watermark, signature, text, logo, border, frame",
  "low quality, blurry, jpeg artifacts, noise, grainy, pixelated",
].join(", ");

export const buildNegativePrompt = (frame: FrameData, userNegative: string): string => {
  const parts: string[] = [BASE_NEGATIVE];
  if (userNegative.trim()) parts.push(userNegative.trim());
  if (!frame.character_present) parts.push("people, human figures, person, face, body");
  return parts.join(", ");
};

export const buildEditFramePrompt = (instruction: string, frame: FrameData, visualBible: string) => {
  const vbSummary = truncateVisualBible(visualBible);
  const camera = cameraPackage(frame.camera_angle);
  const lighting = cleanPrompt(frame.lighting).toLowerCase();
  const colour = cleanPrompt(frame.colour_palette).toLowerCase();
  return [
    `${cleanPrompt(instruction)}.`,
    `Production design: ${vbSummary}`,
    `${camera}.`,
    `Lighting: ${lighting}.`,
    `Colour grade: ${colour}.`,
    "Photorealistic live-action music video frame.",
  ].join(" ");
};

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
    `End frame: the concluded state of this scene after the motion has played out. ${cleanPrompt(frame.flow_prompt)}.`,
    frame.scene_end_state ? `Final composition: ${cleanPrompt(frame.scene_end_state)}.` : undefined,
    lyricMood(frame.next_lyric_line || frame.lyric_line),
    frame.character_present
      ? "If a character reference image is provided, match the reference identity and wardrobe exactly. Subject has reached the final pose of this motion — position, eyeline, and hand placement should reflect the end of the action."
      : "No human subject. Pure environment, atmosphere, or object focus at the conclusion of the described motion.",
  ]
    .filter(Boolean)
    .join(" ");
