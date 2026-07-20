import { invalidateDownstream } from "@storyforge/agent-core";
import { stageNameSchema } from "@storyforge/contracts";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { projectRepository } from "@/server/project-repository";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const project = projectRepository.retryStage(decodeURIComponent(id));
  if (project) return Response.json({ projectId: project.id, runId: project.runId, status: project.status });
  try {
    const supabase = await createSupabaseServerClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub;
    if (!userId) return Response.json({ error: "authentication_required" }, { status: 401 });
    const { data: stage, error } = await supabase.from("stage_runs").select("*").eq("id", id).eq("user_id", userId).maybeSingle();
    const parsedStage = stageNameSchema.safeParse(stage?.stage);
    if (error || !stage || !parsedStage.success) return Response.json({ error: "not_found" }, { status: 404 });
    if (stage.attempt >= 3) return Response.json({ error: "retry_limit_reached" }, { status: 409 });
    const downstream = [parsedStage.data, ...invalidateDownstream(parsedStage.data)];
    const nextAttempt = stage.attempt + 1;
    const { error: retryError } = await supabase.from("stage_runs").insert({
      run_id: stage.run_id,
      project_id: stage.project_id,
      user_id: userId,
      stage: parsedStage.data,
      status: "queued",
      attempt: nextAttempt,
      parallel_group: stage.parallel_group,
      idempotency_key: `${stage.run_id}:${parsedStage.data}:${nextAttempt}`,
    });
    if (retryError) return Response.json({ error: "retry_enqueue_failed" }, { status: 409 });
    await supabase.from("artifacts").update({ status: "stale" }).eq("project_id", stage.project_id).eq("user_id", userId).in("source_stage", downstream);
    await supabase.from("runs").update({ status: "paused" }).eq("id", stage.run_id).eq("user_id", userId);
    await supabase.from("projects").update({ status: "paused" }).eq("id", stage.project_id).eq("user_id", userId);
    return Response.json({ projectId: stage.project_id, runId: stage.run_id, status: "paused", credentialRequired: true });
  } catch {
    return Response.json({ error: "live_backend_unavailable" }, { status: 503 });
  }
}
