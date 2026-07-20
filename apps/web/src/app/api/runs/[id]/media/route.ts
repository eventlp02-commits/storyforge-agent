import { createSupabaseServerClient } from "@/lib/supabase/server";
import { stopMediaGeneration } from "@storyforge/agent-core";
import { projectRepository } from "@/server/project-repository";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const local = projectRepository.getProjectByRun(id);
  if (local) {
    projectRepository.updateRun(id, (project) => {
      const sequence = Math.max(0, ...project.events.map((event) => event.sequence)) + 1;
      const now = new Date().toISOString();
      return {
        ...project,
        assets: stopMediaGeneration(project.assets),
        shots: project.shots.map((shot) => shot.generationStatus === "generating" ? { ...shot, generationStatus: "deferred" as const } : shot),
        events: [...project.events, { id: `${id}:media-stopped`, sequence, runId: id, type: "tool.called", title: "媒体生成已停止", detail: "未开始的媒体任务保留为提示词", timestamp: now, sanitized: true }],
        updatedAt: now,
      };
    });
    return Response.json({ runId: id, mediaGenerationStopped: true, backend: "local" });
  }
  try {
    const supabase = await createSupabaseServerClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub;
    if (!userId) return Response.json({ error: "authentication_required" }, { status: 401 });
    const { data: run, error } = await supabase.from("runs").select("model_config").eq("id", id).eq("user_id", userId).maybeSingle();
    if (error || !run) return Response.json({ error: "not_found" }, { status: 404 });
    const modelConfig = run.model_config && typeof run.model_config === "object" ? run.model_config as Record<string, unknown> : {};
    const { error: updateError } = await supabase.from("runs").update({ model_config: { ...modelConfig, mediaGenerationStopped: true } }).eq("id", id).eq("user_id", userId);
    if (updateError) throw new Error(updateError.code);
    return Response.json({ runId: id, mediaGenerationStopped: true });
  } catch {
    return Response.json({ error: "live_backend_unavailable" }, { status: 503 });
  }
}
