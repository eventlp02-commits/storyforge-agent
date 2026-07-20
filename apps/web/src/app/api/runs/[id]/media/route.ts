import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
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
