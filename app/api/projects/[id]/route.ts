import { rm } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { deleteProject, getProject, updateProject } from "@/lib/db/projects";

export const runtime = "nodejs";

export function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return params.then(({ id }) => {
    const project = getProject(id);
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    return NextResponse.json(project);
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await req.json() as { name?: string; artistName?: string; trackTitle?: string; stateJson?: string };
    const updated = updateProject(id, body);
    if (!updated) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update project", error);
    return NextResponse.json({ error: "Failed to update project." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const projectsRoot = path.resolve(process.cwd(), "data", "projects");
    const projectDir = path.resolve(projectsRoot, id);
    const rel = path.relative(projectsRoot, projectDir);
    if (rel.startsWith("..") || path.isAbsolute(rel)) {
      return NextResponse.json({ error: "Invalid project id." }, { status: 400 });
    }
    deleteProject(id);
    await rm(projectDir, { recursive: true, force: true });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete project", error);
    return NextResponse.json({ error: "Failed to delete project." }, { status: 500 });
  }
}
