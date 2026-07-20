import { projectRepository } from "@/server/project-repository";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const afterRaw = new URL(request.url).searchParams.get("after") ?? "0";
  const after = Number.isFinite(Number(afterRaw)) ? Math.max(0, Number(afterRaw)) : 0;
  const localEvents = projectRepository.getEvents(id, after);
  if (localEvents.length > 0 || id.startsWith("run-")) return Response.json({ events: localEvents, after });
  try {
    const supabase = await createSupabaseServerClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub;
    if (!userId) return Response.json({ error: "authentication_required" }, { status: 401 });
    const { data, error } = await supabase.from("run_events").select("*").eq("run_id", id).eq("user_id", userId).gt("sequence", after).order("sequence");
    if (error) throw new Error(error.code);
    return Response.json({
      events: (data ?? []).map((event) => ({
        id: event.id,
        sequence: event.sequence,
        runId: id,
        type: event.type,
        stage: event.stage ?? undefined,
        title: event.title,
        detail: event.detail,
        timestamp: event.created_at,
        sanitized: true,
        metrics: event.metrics ?? undefined,
      })),
      after,
    });
  } catch {
    return Response.json({ error: "live_backend_unavailable" }, { status: 503 });
  }
}
