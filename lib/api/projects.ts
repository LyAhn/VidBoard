import type { ProjectDetailPayload, ProjectSummaryPayload } from "@/lib/vidboard-types";

export const createProject = async (data: {
  id: string;
  name: string;
  artistName: string;
  trackTitle: string;
  stateJson: string;
}): Promise<ProjectDetailPayload> => {
  const res = await fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create project.");
  return res.json() as Promise<ProjectDetailPayload>;
};

export const updateProject = async (
  id: string,
  data: { name?: string; artistName?: string; trackTitle?: string; stateJson?: string }
): Promise<ProjectDetailPayload> => {
  const res = await fetch(`/api/projects/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update project.");
  return res.json() as Promise<ProjectDetailPayload>;
};

export const loadProject = async (id: string): Promise<ProjectDetailPayload> => {
  const res = await fetch(`/api/projects/${id}`);
  if (!res.ok) throw new Error("Project not found.");
  return res.json() as Promise<ProjectDetailPayload>;
};

export const listProjects = async (): Promise<ProjectSummaryPayload[]> => {
  const res = await fetch("/api/projects");
  if (!res.ok) throw new Error("Failed to load projects.");
  return res.json() as Promise<ProjectSummaryPayload[]>;
};
