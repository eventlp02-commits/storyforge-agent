import { z } from "zod";
import { runs as triggerRuns } from "@trigger.dev/sdk";
import { applyRunAction } from "@storyforge/agent-core";
import type { RunStatus } from "@storyforge/contracts";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { projectRepository } from "@/server/project-repository";

const actionSchema = z.object({ action: z.enum(["pause", "resume", "cancel"]) });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_action" }, { status: 400 });
  try {
    const project = projectRepository.applyAction(id, parsed.data.action);
    if (project) return Response.json({ runId: project.runId, status: project.status });
    const supabase = await createSupabaseServerClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub;
    if (!userId) return Response.json({ error: "authentication_required" }, { status: 401 });
    const { data: run, error } = await supabase.from("runs").select("id, status, trigger_run_id").eq("id", id).eq("user_id", userId).maybeSingle();
    if (error || !run) return Response.json({ error: "not_found" }, { status: 404 });
    const status = applyRunAction(run.status as RunStatus, parsed.data.action);
    const { error: updateError } = await supabase.from("runs").update({ status }).eq("id", id).eq("user_id", userId);
    if (updateError) throw new Error(updateError.code);
    await supabase.from("projects").update({ status }).eq("current_run_id", id).eq("user_id", userId);
    if (parsed.data.action === "cancel") {
      await supabase.from("provider_credentials").delete().eq("run_id", id).eq("user_id", userId);
      if (run.trigger_run_id && process.env.TRIGGER_SECRET_KEY) await triggerRuns.cancel(run.trigger_run_id);
    }
    return Response.json({ runId: id, status });
  } catch (error) {
    return Response.json({ error: "invalid_transition", message: error instanceof Error ? error.message : "Invalid transition" }, { status: 409 });
  }
}
