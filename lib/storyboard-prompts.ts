import type { FrameData } from "@/lib/vidboard-types";

const cleanPrompt = (value: string) =>
  value
    .replace(/\s+/g, " ")
    .replace(/Visual Bible:/gi, "")
    .replace(/hyper-detailed photograph\.?/gi, "")
    .replace(/cinematic,?\s*16:9,?\s*grainy film quality\.?/gi, "")
    .trim();

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
    return "shot on a Canon EOS R5 with an 85mm f/1.4 lens, shallow depth of field, natural skin texture";
  }

  if (lower.includes("wide") || lower.includes("establish")) {
    return "shot on an ARRI Alexa Mini LF with a 24mm cinema lens, realistic deep focus, natural perspective";
  }

  if (lower.includes("hand") || lower.includes("pov") || lower.includes("shoulder")) {
    return "shot on a Fujifilm X-T5 with a 35mm lens, handheld documentary realism, available light";
  }

  return "shot on an ARRI Alexa Mini LF with a 35mm cinema lens, realistic live-action texture";
};

const buildSharedPrompt = (frame: FrameData, visualBible: string) => {
  const scenePrompt = stripVisualBible(frame.image_prompt, visualBible);

  return `A photograph of ${cleanPrompt(scenePrompt)}, ${cameraPackage(frame.camera_angle)}. The setting follows this locked production design: ${cleanPrompt(visualBible)}. The lighting is ${cleanPrompt(frame.lighting).toLowerCase()}, with ${cleanPrompt(frame.colour_palette).toLowerCase()} colour. The image should feel like an imperfect live-action music video frame with real lens behaviour, subtle film grain, natural shadows, believable faces, and physical texture. Preserve the same character identity, costume, instruments, props, environment, and colour grade across the sequence. Do not render any text, subtitles, captions, lettering, logos, labels, posters, watermarks, cartoon styling, illustration, CGI, anime, fantasy concept art, duplicated faces, changed instruments, deformed eyes, distorted mouths, or mutated hands.`;
};

const lyricMood = (lyric?: string) =>
  lyric ? `Emotional cue from lyric, do not render as text: ${cleanPrompt(lyric)}` : undefined;

export const buildStartFramePrompt = (frame: FrameData, visualBible: string) =>
  [
    buildSharedPrompt(frame, visualBible),
    "This is the Start frame of the shot. It shows the exact initial pose, composition, prop placement, and scene state before motion begins.",
    lyricMood(frame.lyric_line),
    "If a character reference image is provided, match the reference identity and wardrobe as closely as the workflow allows.",
  ]
    .filter(Boolean)
    .join("\n");

export const buildEndFramePrompt = (frame: FrameData, visualBible: string) =>
  [
    buildSharedPrompt(frame, visualBible),
    `This is the End frame of the same shot, photographed a few seconds later after this visible motion has happened: ${cleanPrompt(frame.flow_prompt)}.`,
    lyricMood(frame.next_lyric_line || frame.lyric_line),
    "Use the Start frame as the continuity anchor, but do not recreate it exactly. The End frame must be a noticeably later moment in the same shot.",
    "Change at least two visible elements in a physically plausible way: pose, hand position, prop position, body placement, camera distance, focus plane, foreground particles, light direction, or environmental motion.",
    "Keep the same character identity, costume, instrument, environment, and camera language while making the progression obvious enough for a storyboard.",
  ]
    .filter(Boolean)
    .join("\n");
