import { projectRepository } from "@/server/project-repository";
import { loadSupabaseProject } from "@/server/supabase-project";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const project = projectRepository.getProject(id);
  if (project) return Response.json(project);
  try {
    const liveProject = await loadSupabaseProject(id);
    return liveProject ? Response.json(liveProject) : Response.json({ error: "not_found" }, { status: 404 });
  } catch {
    return Response.json({ error: "live_backend_unavailable" }, { status: 503 });
  }
}
