import { buildProjectArchiveBytes, toArrayBuffer } from "@/lib/export-package";
import { projectRepository } from "@/server/project-repository";
import { loadSupabaseProject } from "@/server/supabase-project";

export const runtime = "nodejs";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const project = projectRepository.getProject(id) ?? await loadSupabaseProject(id).catch(() => undefined);
  if (!project) return Response.json({ error: "not_found" }, { status: 404 });
  const archive = await buildProjectArchiveBytes(project);
  const filename = `${project.config.title.replace(/[\\/:*?"<>|]/g, "_")}_StoryForge.zip`;
  return new Response(toArrayBuffer(archive), {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "cache-control": "private, no-store",
    },
  });
}
