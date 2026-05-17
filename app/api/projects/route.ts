import { NextRequest, NextResponse } from "next/server";
import { createProject, listProjects } from "@/lib/db/projects";

export const runtime = "nodejs";

export function GET() {
  try {
    const summaries = listProjects();
    return NextResponse.json(summaries);
  } catch (error) {
    console.error("Failed to list projects", error);
    return NextResponse.json({ error: "Failed to load projects." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { id: string; name: string; artistName: string; trackTitle: string; stateJson: string };
    if (!body.id || !body.name || !body.stateJson) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }
    const project = createProject(body);
    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error("Failed to create project", error);
    return NextResponse.json({ error: "Failed to create project." }, { status: 500 });
  }
}
