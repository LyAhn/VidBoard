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

const prependVisualBible = (frame: StoryboardFrame, visualBible: string) => {
  const imagePrompt = frame.image_prompt.trim();
  const trimmedVisualBible = visualBible.trim();

  return {
    ...frame,
    image_prompt: imagePrompt.startsWith(trimmedVisualBible)
      ? imagePrompt
      : `${trimmedVisualBible}\n\n${imagePrompt}`,
  };
};

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

    console.log("Ollama planning: artist context started");
    const contextRes = await client.chat({
      model: MODEL,
      think: false,
      options: { num_ctx: 32768 },
      messages: [
        {
          role: "user",
          content: `Using the following web search results, write a concise music video director's context guide for "${artistName}" - "${trackTitle}". Cover: genre, visual aesthetics, music video style, band members if relevant, and key visual themes.\n\nSearch results:\n${searchContext}`,
        },
      ],
    });
    const artistContext = contextRes.message.content;
    logStep("artist context complete", startedAt);

    console.log("Ollama planning: visual bible started");
    const vbRes = await client.chat({
      model: MODEL,
      think: false,
      options: { num_ctx: 32768 },
      messages: [
        {
          role: "user",
          content: `Based on this artist context:\n${artistContext}\n\nCreate a Visual Bible for a "${artistName} - ${trackTitle}" music video. Theme: "${theme}".\nMust include:\n1. FIXED COLOUR GRADE: specific hex palette and overall colour mood.\n2. FIXED ENVIRONMENT ANCHOR: e.g. "all scenes occur in or around a decayed gothic cathedral".\n3. FIXED CHARACTER DESCRIPTION: detailed visual description of main subject/artist appearance.\n\nReturn as a concise paragraph.`,
        },
      ],
    });
    const visualBible = vbRes.message.content;
    logStep("visual bible complete", startedAt);

    console.log("Ollama planning: storyboard JSON started");
    const planRes = await client.chat({
      model: MODEL,
      think: false,
      options: { num_ctx: 32768 },
      messages: [
        {
          role: "user",
          content: `You are an expert music video director. Plan a ${numberOfFrames}-frame storyboard for "${artistName} - ${trackTitle}".\nTheme: ${theme}. Aspect ratio: ${aspectRatio}.\n\nVisual Bible (prepend to every image_prompt only):\n${visualBible}\n\nLyrics:\n${lyrics}\n\nDistribute frames across song structure (intro, verses, chorus, bridge, outro).\n\nRules:\n- image_prompt must be fully self-contained, cinematic, and begin with the Visual Bible constraints verbatim.\n- flow_prompt must be only a short video motion instruction. Maximum 20 words.\n- flow_prompt must not include the Visual Bible, image prompt, markdown, placeholders, brackets, or scene_description text.\n- Use concrete camera/subject movement, e.g. "Performer turns toward camera as fog rolls through stained glass."`,
        },
      ],
      format: storyboardSchema,
    });

    const plan = JSON.parse(planRes.message.content);
    if (!Array.isArray(plan.frames)) {
      throw new Error("Storyboard response did not include a frames array.");
    }

    const frames = (plan.frames as StoryboardFrame[]).map((frame) =>
      prependVisualBible(frame, visualBible)
    );
    logStep("storyboard JSON complete", startedAt);

    return NextResponse.json({ artistContext, visualBible, frames });
  } catch (error) {
    console.error("Ollama planning failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to plan storyboard." },
      { status: 500 }
    );
  }
}
