import { NextRequest, NextResponse } from "next/server";
import { Ollama } from "ollama";

export const runtime = "nodejs";

type AspectRatio = "16:9" | "9:16" | "1:1";

interface PlanRequest {
  artistName: string;
  trackTitle: string;
  lyrics: string;
  theme: string;
  numberOfFrames: number;
  aspectRatio: AspectRatio;
}

interface SearchResult {
  title?: string;
  url?: string;
  content: string;
}

interface StoryboardFrame {
  image_prompt: string;
  [key: string]: unknown;
}

const MODEL = process.env.OLLAMA_MODEL || "qwen3:8b";

const client = new Ollama({
  host: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
  headers: process.env.OLLAMA_API_KEY
    ? { Authorization: `Bearer ${process.env.OLLAMA_API_KEY}` }
    : undefined,
});

const storyboardSchema = {
  type: "object",
  properties: {
    track: { type: "string" },
    artist: { type: "string" },
    mood: { type: "string" },
    genre: { type: "string" },
    frames: {
      type: "array",
      items: {
        type: "object",
        properties: {
          frame_number: { type: "integer" },
          timestamp_hint: { type: "string" },
          lyric_line: { type: "string" },
          scene_description: { type: "string" },
          camera_angle: { type: "string" },
          lighting: { type: "string" },
          colour_palette: { type: "string" },
          motion_hint: { type: "string" },
          flow_prompt: { type: "string" },
          image_prompt: { type: "string" },
          character_present: { type: "boolean" },
        },
        required: [
          "frame_number",
          "timestamp_hint",
          "lyric_line",
          "scene_description",
          "camera_angle",
          "lighting",
          "colour_palette",
          "motion_hint",
          "flow_prompt",
          "image_prompt",
          "character_present",
        ],
      },
    },
  },
  required: ["track", "artist", "mood", "genre", "frames"],
};

const isPlanRequest = (value: unknown): value is PlanRequest => {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  return (
    typeof data.artistName === "string" &&
    typeof data.trackTitle === "string" &&
    typeof data.lyrics === "string" &&
    typeof data.theme === "string" &&
    typeof data.numberOfFrames === "number" &&
    ["16:9", "9:16", "1:1"].includes(String(data.aspectRatio))
  );
};

const formatSearchResult = (result: SearchResult) => {
  const heading = result.title || result.url || "Search result";
  return `[${heading}]\n${result.content}`;
};

const normalizeFramePrompt = (frame: StoryboardFrame) => ({
  ...frame,
  image_prompt: frame.image_prompt.trim(),
});

const logStep = (label: string, startedAt: number) => {
  console.log(`Ollama planning: ${label}`, {
    seconds: Number(((Date.now() - startedAt) / 1000).toFixed(1)),
  });
};

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OLLAMA_API_KEY) {
      return NextResponse.json(
        { error: "OLLAMA_API_KEY is required for Ollama web search." },
        { status: 500 }
      );
    }

    const body = await req.json();
    if (!isPlanRequest(body)) {
      return NextResponse.json({ error: "Invalid planning request." }, { status: 400 });
    }

    const { artistName, trackTitle, lyrics, theme, numberOfFrames, aspectRatio } = body;
    const searchQuery = `${artistName} ${trackTitle} music video style genre aesthetics`;
    const startedAt = Date.now();

    // Step 1: Web search
    console.log("Ollama planning: web search started", { query: searchQuery });
    const searchResults = await client.webSearch({
      query: searchQuery,
      maxResults: 5,
    });
    console.log("Ollama web search results", {
      query: searchQuery,
      count: searchResults.results.length,
    });
    logStep("web search complete", startedAt);

    const searchContext = (searchResults.results as SearchResult[])
      .map(formatSearchResult)
      .join("\n\n");

    // Step 1: Research — rich artist/track context guide
    console.log("Ollama planning: artist context started");
    const contextRes = await client.chat({
      model: MODEL,
      think: false,
      options: { num_ctx: 32768 },
      messages: [
        {
          role: "user",
          content: `Research the artist "${artistName}" and their track "${trackTitle}" using the web search results below.
Provide a concise but detailed overview containing:
- Genre, era, and core musical style.
- Visual aesthetics associated with the artist (e.g. from existing music videos, live performances, album artwork).
- Band members or key figures involved if relevant.
- Common visual themes they rely on (recurring motifs, colour palettes, locations, styling).
- Any notable directorial or cinematographic signatures from their video catalogue.

Synthesize this into a structured context guide to inform the pre-production storyboard for a new music video for this track.

Search results:
${searchContext}`,
        },
      ],
    });
    const artistContext = contextRes.message.content;
    logStep("artist context complete", startedAt);

    // Step 1.5: Visual Bible — locked production design document
    console.log("Ollama planning: visual bible started");
    const vbRes = await client.chat({
      model: MODEL,
      think: false,
      options: { num_ctx: 32768 },
      messages: [
        {
          role: "user",
          content: `Based on the following artist context for "${artistName}" - "${trackTitle}", create a locked "Visual Bible" for a music video. Theme: "${theme}".

This Visual Bible is a production design document that EVERY frame in the storyboard must adhere to. It must include:
1. FIXED COLOUR GRADE: Specific hex palette (3–5 colours) and an overall colour mood description (e.g. "desaturated teal and amber, heavy shadows, cinematic 2.39:1 crop").
2. FIXED ENVIRONMENT ANCHOR: One repeatable location family that all scenes inhabit or orbit (e.g. "all scenes occur in or around a derelict industrial warehouse at night"). Describe the environment with enough detail that an art director could dress the set.
3. FIXED CHARACTER DESCRIPTION: Detailed visual description of the main subject/artist — face, build, hair colour and style, wardrobe including specific garment types, footwear, accessories, and any instruments or props they carry.
4. REALISM LOCK: Explicitly state this is live-action cinematography — not illustration, fantasy concept art, anime, CGI, or album artwork.

Return as one concise but information-dense summary paragraph. Do not describe frame-by-frame actions here; leave that to the storyboard.

Artist context:
${artistContext}`,
        },
      ],
    });
    const visualBible = vbRes.message.content;
    logStep("visual bible complete", startedAt);

    // Step 2: Storyboard planning
    console.log("Ollama planning: storyboard JSON started");
    const planRes = await client.chat({
      model: MODEL,
      think: false,
      options: { num_ctx: 32768 },
      messages: [
        {
          role: "user",
          content: `You are an expert music video director and storyboard artist.
Your task is to plan a storyboard sequence for a music video.

Track Info:
- Artist: ${artistName}
- Track: ${trackTitle}
- Target Theme/Mood: ${theme}
- Aspect Ratio: ${aspectRatio}
- Target Number of Frames: ${numberOfFrames}

Artist Context & Vibe:
${artistContext}

Visual Bible Constraints (MUST inform every image_prompt):
${visualBible}

Lyrics:
${lyrics}

Create a structured storyboard plan with exactly ${numberOfFrames} frames distributed evenly across the song structure (e.g. intro, verses, chorus, bridge, outro).
For each frame, provide:
1. 'frame_number': Sequence number.
2. 'timestamp_hint': Song section (e.g., 'Verse 1').
3. 'lyric_line': The lyric line representing this frame.
4. 'scene_description': Detailed visual description of what is happening in the shot.
5. 'camera_angle': Camera angle or shot type (e.g. close-up, wide, dutch angle, POV).
6. 'lighting': Lighting style (e.g. hard side-light, practical neon, golden hour).
7. 'colour_palette': Specific colours dominant in this frame.
8. 'motion_hint': Implied camera/subject movement for a video generation system.
9. 'flow_prompt': A short, motion-optimised description in the format: "[Subject] [action verb] [direction/manner], [camera movement if any]". Maximum 20 words. Must be concrete and physical — no placeholders, no markdown, no brackets.
10. 'image_prompt': A complete, self-contained generative AI image prompt for a text-to-image model. Must describe character details, environment, lighting, and style consistent with the Visual Bible. Must NOT repeat the full Visual Bible verbatim — instead, describe only this frame's specific composition, subject action, foreground props, and camera placement. Must not request visible text, captions, subtitles, lyrics, logos, or written words.
11. 'character_present': Boolean true if the frame features the main human subject (artist/character).

Rules:
- Each frame must be visually distinct: vary shot scale, blocking, pose, foreground action, prop focus, and camera movement.
- Keep character identity, wardrobe, instruments, environment family, and colour grade continuous across the whole storyboard.
- Avoid generic band-standing tableaux unless the lyric/section specifically demands a performance shot.`,
        },
      ],
      format: storyboardSchema,
    });

    const plan = JSON.parse(planRes.message.content);
    if (!Array.isArray(plan.frames)) {
      throw new Error("Storyboard response did not include a frames array.");
    }

    const frames = (plan.frames as StoryboardFrame[]).map(normalizeFramePrompt);
    logStep("storyboard JSON complete", startedAt);

    // Free VRAM before ComfyUI takes over — fire-and-forget, don't block the response.
    client.generate({ model: MODEL, prompt: "", keep_alive: 0 }).catch((err: unknown) => {
      console.warn("Ollama model unload failed (non-fatal)", err);
    });

    return NextResponse.json({ artistContext, visualBible, frames });
  } catch (error) {
    console.error("Ollama planning failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to plan storyboard." },
      { status: 500 }
    );
  }
}
