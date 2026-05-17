import { desc, eq } from "drizzle-orm";
import { db } from "./index";
import { projects } from "./schema";
import type { ProjectRow } from "./schema";

export interface ProjectSummary {
  id: string;
  name: string;
  artistName: string;
  trackTitle: string;
  createdAt: Date;
  updatedAt: Date;
  thumbnailImagePath: string | null;
}

export interface ProjectDetail extends ProjectSummary {
  stateJson: string;
}

function toSummary(row: ProjectRow): ProjectSummary {
  let thumbnailImagePath: string | null = null;
  try {
    const state = JSON.parse(row.stateJson) as { frames?: Array<{ startImagePath?: string; endImagePath?: string }> };
    const frames = state.frames ?? [];
    const withImage = frames.filter((f) => f.startImagePath || f.endImagePath);
    if (withImage.length > 0) {
      const pick = withImage[withImage.length - 1];
      thumbnailImagePath = pick.startImagePath ?? pick.endImagePath ?? null;
    }
  } catch {
    // stateJson malformed — thumbnail stays null
  }
  return {
    id: row.id,
    name: row.name,
    artistName: row.artistName,
    trackTitle: row.trackTitle,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    thumbnailImagePath,
  };
}

export function listProjects(): ProjectSummary[] {
  const rows = db.select().from(projects).orderBy(desc(projects.updatedAt)).all();
  return rows.map(toSummary);
}

export function getProject(id: string): ProjectDetail | null {
  const row = db.select().from(projects).where(eq(projects.id, id)).get();
  if (!row) return null;
  return { ...toSummary(row), stateJson: row.stateJson };
}

function assertValidStateJson(stateJson: string): void {
  try {
    JSON.parse(stateJson);
  } catch {
    throw new Error("Invalid stateJson: not valid JSON");
  }
}

export function createProject(data: {
  id: string;
  name: string;
  artistName: string;
  trackTitle: string;
  stateJson: string;
}): ProjectDetail {
  assertValidStateJson(data.stateJson);
  const now = new Date();
  db.insert(projects).values({ ...data, createdAt: now, updatedAt: now }).run();
  return getProject(data.id)!;
}

export function updateProject(
  id: string,
  data: { name?: string; artistName?: string; trackTitle?: string; stateJson?: string }
): ProjectDetail | null {
  if (data.stateJson !== undefined) assertValidStateJson(data.stateJson);
  db.update(projects)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(projects.id, id))
    .run();
  return getProject(id);
}

export function deleteProject(id: string): void {
  db.delete(projects).where(eq(projects.id, id)).run();
}
