import { NextRequest, NextResponse } from "next/server";
import { Ollama } from "ollama";

export const runtime = "nodejs";

type AspectRatio = "16:9" | "9:16" | "1:1";

type VisualDirection = "artist" | "lyrics" | "theme";

interface PlanRequest {
  artistName: string;
  trackTitle: string;
  lyrics: string;
  theme: string;
  visualDirection: VisualDirection;
  visualConcept: string;
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
          scene_end_state: { type: "string" },
          scene_story_beat: { type: "string" },
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
          "scene_end_state",
          "scene_story_beat",
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

const normalisePlanRequest = (body: Record<string, unknown>): PlanRequest => ({
  artistName: String(body.artistName ?? ""),
  trackTitle: String(body.trackTitle ?? ""),
  lyrics: String(body.lyrics ?? ""),
  theme: String(body.theme ?? ""),
  visualDirection: (["artist", "lyrics", "theme"] as VisualDirection[]).includes(
    body.visualDirection as VisualDirection
  )
    ? (body.visualDirection as VisualDirection)
    : "lyrics",
  visualConcept: typeof body.visualConcept === "string" ? body.visualConcept : "",
  numberOfFrames: (() => {
    const raw = Number(body.numberOfFrames);
    return Number.isFinite(raw) ? Math.min(16, Math.max(4, Math.round(raw))) : 8;
  })(),
  aspectRatio: body.aspectRatio as AspectRatio,
});

const buildVisualDirectionInstruction = (
  direction: VisualDirection,
  theme: string
): string => {
  if (direction === "theme") {
    return `The user-defined theme ("${theme}") MUST dominate the entire visual design. Use the artist context only to accurately describe the performer's physical appearance and wardrobe — do NOT let the artist's established setting, location aesthetic, or recurring visual motifs dictate the environment or atmosphere. The theme takes full precedence.`;
  }
  if (direction === "lyrics") {
    return `Draw visual inspiration primarily from the specific imagery and emotions of this track's lyrics. Be creative and song-specific — do NOT default to the artist's most familiar or commonly associated visual clichés. The Visual Bible should feel specific to this song, not to the artist's broader catalogue.`;
  }
  return `Draw from the artist's established visual identity, recurring motifs, and aesthetic signatures to create a Visual Bible consistent with their catalogue.`;
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

const isConnectionError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  const code = (error as NodeJS.ErrnoException).code;
  if (code === "ECONNREFUSED") return true;
  const cause = (error as { cause?: unknown }).cause;
  if (cause instanceof Error && (cause as NodeJS.ErrnoException).code === "ECONNREFUSED") return true;
  // Ollama SDK surfaces "fetch failed" when the socket is refused.
  if (error.message === "fetch failed") return true;
  return false;
};

const classifyOllamaError = (error: unknown): string => {
  if (!(error instanceof Error)) return "Failed to plan storyboard.";
  if (isConnectionError(error)) return "Ollama is not running. Start it with: ollama serve";
  if (error instanceof SyntaxError || error.message.toLowerCase().includes("json")) {
    return "Planning failed — the model returned invalid output. Try again or switch to a larger model in .env.";
  }
  return error.message;
};

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OLLAMA_API_KEY) {
      return NextResponse.json(
        { error: "OLLAMA_API_KEY is required for Ollama web search." },
        { status: 500 }
      );
    }

    const rawBody = await req.json();
    if (!isPlanRequest(rawBody)) {
      return NextResponse.json({ error: "Invalid planning request." }, { status: 400 });
    }
    const body = normalisePlanRequest(rawBody as unknown as Record<string, unknown>);

    const { artistName, trackTitle, lyrics, theme, visualDirection, visualConcept, numberOfFrames, aspectRatio } = body;
    const isInstrumental = !lyrics.trim();
    const lyricExcerpt = lyrics.slice(0, 600).trim();
    const lyricsOrConcept = isInstrumental
      ? visualConcept.trim()
        ? `Visual Concept / Arc (Instrumental):\n${visualConcept.trim()}`
        : "This is an instrumental track with no lyrics."
      : `Lyrics (excerpt — use to anchor visual imagery to this specific song):\n${lyricExcerpt}${lyrics.length > 600 ? "\n[…]" : ""}`;
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
1. PERFORMER DESCRIPTION: Physical appearance of the main performer(s) — face, build, hair, typical wardrobe style, any signature instruments or accessories. Be specific enough for a costume designer to recreate the look.
2. MUSICAL STYLE: Genre, era, tempo/energy character of the track (e.g. slow-burn, aggressive, anthemic).
3. SONG-SPECIFIC CONTENT: Based on the track title and any lyric references found, what is this specific song actually ABOUT? What emotions, narrative, or imagery does it describe? (Do not confuse the band's general genre identity with what this particular song communicates.)
4. CATALOGUE AESTHETIC: What visual settings and motifs appear in this artist's existing videos — note these clearly so they can be considered or deliberately avoided.

Search results:
${searchContext}

${!isInstrumental ? `Track lyrics for reference:\n${lyricExcerpt}${lyrics.length > 600 ? "\n[…]" : ""}` : visualConcept ? `Visual concept for this instrumental: ${visualConcept}` : ""}`,
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
          content: `You are a music video production designer. Create a locked "Visual Bible" for "${artistName}" — "${trackTitle}".

━━━ VISUAL DIRECTION ━━━
${buildVisualDirectionInstruction(visualDirection, theme)}
User Theme / Mood: "${theme || "not specified"}"

━━━ SONG CONTENT ━━━
${lyricsOrConcept}

━━━ ARTIST CONTEXT (use only what is instructed below) ━━━
${artistContext}

━━━ INSTRUCTIONS ━━━
The Visual Bible has TWO sources of truth. You must keep them strictly separate:

SOURCE A — CHARACTER (from artist context only):
Extract ONLY: performer's physical appearance, hair, wardrobe specifics, instruments, accessories. This is the only thing the artist context should contribute.

SOURCE B — ENVIRONMENT & ATMOSPHERE (from lyrics/theme ONLY — NOT from artist context):
Derive the location, setting, colour palette, and mood from the song's lyrics and the user's theme above.
${
  visualDirection !== "artist"
    ? `CRITICAL: Do NOT carry over any location, setting, or atmosphere from the artist's existing video catalogue or genre conventions into Source B. The environment must come from what the lyrics describe or imply, and from the user's theme. If the artist is associated with a particular genre's typical visual clichés (e.g. religious settings for Christian metal, forest scenes for folk metal, cityscapes for hip-hop), you must set those aside entirely unless a lyric line specifically places the scene there.`
    : `You may draw on the artist's established visual settings and motifs for the environment.`
}

Build the Visual Bible with:
1. FIXED COLOUR GRADE: Hex palette (3–5 colours) derived from the mood/lyrics/theme. Overall colour description.
2. FIXED ENVIRONMENT: One location family derived from the song content and theme — not the artist's typical setting. Enough detail for an art director to dress the set.
3. FIXED CHARACTER: Full visual description from Source A (appearance, wardrobe, instruments).
4. REALISM LOCK: Live-action cinematography only — no illustration, CGI, anime, or fantasy concept art.

Return as one concise, information-dense paragraph. No frame-by-frame description.`,
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
- Visual Direction: ${visualDirection === "artist" ? "Match artist's established aesthetic" : visualDirection === "lyrics" ? "Imagery driven by this track's specific lyrics — avoid generic artist clichés" : "User theme dominates — override artist's typical look"}
- Aspect Ratio: ${aspectRatio}
- Target Number of Frames: ${numberOfFrames}

Artist Context & Vibe:
${artistContext}

Visual Bible Constraints (MUST inform every image_prompt):
${visualBible}

${
  isInstrumental
    ? `${lyricsOrConcept}

Since this is an instrumental track, distribute frames across an emotional arc (e.g. build, peak, release, resolution). Set 'lyric_line' to an evocative phrase describing the musical energy or emotion at that moment rather than literal lyrics.`
    : `Lyrics:
${lyrics}

For each frame, anchor the 'image_prompt' to the specific imagery and emotion evoked by the assigned 'lyric_line'. Do not use generic artist-identity visuals when the lyric suggests something more specific or unexpected.`
}

Create a structured storyboard plan with exactly ${numberOfFrames} frames distributed evenly across the song structure (e.g. intro, verses, chorus, bridge, outro).
For each frame, provide:
1. 'frame_number': Sequence number.
2. 'timestamp_hint': Song section (e.g., 'Verse 1').
3. 'lyric_line': The lyric line representing this frame${isInstrumental ? " (or a phrase capturing the musical energy at this moment)" : ""}.
4. 'scene_description': Detailed visual description of what is happening in the shot.
5. 'camera_angle': Camera angle or shot type (e.g. close-up, wide, dutch angle, POV).
6. 'lighting': Lighting style (e.g. hard side-light, practical neon, golden hour).
7. 'colour_palette': Specific colours dominant in this frame.
8. 'motion_hint': Implied camera/subject movement for a video generation system.
9. 'flow_prompt': The transition brief for Google Flow (Veo 3.1 Frames-to-Video). Three clauses describing the visible action that bridges start frame to end frame. Format: "[shot size + camera movement]. [subject + concrete visible action from start position to end position]. [environment + lighting + style]." Use only concrete visible language — describe what is SEEN, not editorial intent. Preferred Veo camera terms: dolly in/out, crane up/down, push in, pull back, track left/right, pan, tilt, rack focus. BANNED: vague editorial words like emphasising, highlighting, suggesting, conveying — replace with visible facts (e.g. "head bowed, shoulders slumped" not "emphasising dejection"). Maximum 40 words. No placeholders, no markdown, no brackets.
10. 'scene_end_state': A 40–60 word cinematographer's shot note describing the EXACT final composition as a static tableau — subject's final position, body orientation, expression or gaze, key prop placement, camera angle and distance, environment state, lighting condition. Write as frozen frame: no motion verbs, no temporal language. This is WHERE things end up, not how they got there.
11. 'scene_story_beat': One sentence describing the emotional or narrative beat this clip represents in the music video's story arc — e.g. "The singer's resignation reaches its lowest point" or "The instrumental groove locks in and the atmosphere shifts from tension to release." High-level scene intent for editorial context, not a visual description.
12. 'image_prompt': A complete, self-contained generative AI image prompt for a text-to-image model. Must describe character details, environment, lighting, and style consistent with the Visual Bible. Must NOT repeat the full Visual Bible verbatim — instead, describe only this frame's specific composition, subject action, foreground props, and camera placement. Must not request visible text, captions, subtitles, lyrics, logos, or written words.
13. 'character_present': Boolean true if the frame features the main human subject (artist/character).

Rules:
- Each frame must be visually distinct: vary shot scale, blocking, pose, foreground action, prop focus, and camera movement.
- Keep character identity, wardrobe, instruments, environment family, and colour grade continuous across the whole storyboard.
- Avoid generic band-standing tableaux unless the lyric/section specifically demands a performance shot.
- If Visual Direction is lyrics-led or theme-led, treat the Visual Bible environment as a creative canvas — vary lighting, props, and framing to serve the lyric/mood rather than repeating a static scene.`,
        },
      ],
      format: storyboardSchema,
    });

    const plan = JSON.parse(planRes.message.content);
    if (!Array.isArray(plan.frames)) {
      throw new Error("Storyboard response did not include a frames array.");
    }

    const frames = (plan.frames as StoryboardFrame[]).map(normalizeFramePrompt);
    if (frames.length !== numberOfFrames) {
      throw new Error(`Storyboard returned ${frames.length} frames; expected ${numberOfFrames}.`);
    }
    logStep("storyboard JSON complete", startedAt);

    // Free VRAM before ComfyUI takes over — fire-and-forget, don't block the response.
    client.generate({ model: MODEL, prompt: "", keep_alive: 0 }).catch((err: unknown) => {
      console.warn("Ollama model unload failed (non-fatal)", err);
    });

    return NextResponse.json({ artistContext, visualBible, frames });
  } catch (error) {
    console.error("Ollama planning failed", error);
    return NextResponse.json({ error: classifyOllamaError(error) }, { status: 500 });
  }
}
