import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const DATA_DIR = path.join(process.cwd(), "data");

export async function GET(_req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;

  // Prevent path traversal
  const relative = segments.join("/");
  const resolved = path.resolve(DATA_DIR, relative);
  if (!resolved.startsWith(DATA_DIR)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  try {
    const buffer = await readFile(resolved);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Image not found." }, { status: 404 });
  }
}
