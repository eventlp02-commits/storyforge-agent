import { z } from "zod";
import { getSkillVersion } from "@storyforge/agent-core";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { projectRepository } from "@/server/project-repository";

const requestSchema = z.object({
  concept: z.string().trim().min(3).max(4000),
  durationSeconds: z.number().min(5).max(900).optional(),
  aspectRatio: z.enum(["16:9", "9:16", "1:1", "4:5", "2.39:1"]).optional(),
  contentLanguage: z.string().min(2).max(20).optional(),
  visualStyle: z.string().max(500).optional(),
  mode: z.enum(["demo", "live"]).default("demo"),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
  }
  if (parsed.data.mode === "live") {
    const cloudConfigured = Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL
      && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
      && process.env.CREDENTIAL_ENCRYPTION_KEY
      && process.env.TRIGGER_SECRET_KEY,
    );
    if (cloudConfigured) try {
      const supabase = await createSupabaseServerClient();
      const { data: claimsData } = await supabase.auth.getClaims();
      let userId = claimsData?.claims?.sub;
      if (!userId) {
        const { data: anonymous } = await supabase.auth.signInAnonymously();
        userId = anonymous.user?.id;
      }
      if (!userId) throw new Error("Anonymous session unavailable");
      const title = parsed.data.concept.length > 32 ? `${parsed.data.concept.slice(0, 32)}…` : parsed.data.concept;
      const inferredConfig = {
        durationSeconds: parsed.data.durationSeconds ?? 60,
        aspectRatio: parsed.data.aspectRatio ?? "16:9",
        contentLanguage: parsed.data.contentLanguage ?? "zh-CN",
        visualStyle: parsed.data.visualStyle ?? "电影化游戏 CG",
        assumptions: [
          ...(parsed.data.durationSeconds ? [] : ["未指定时长，采用 60 秒"]),
          ...(parsed.data.aspectRatio ? [] : ["未指定画幅，采用 16:9"]),
          ...(parsed.data.contentLanguage ? [] : ["未指定语言，采用中文"]),
        ],
      };
      const { data: project, error: projectError } = await supabase.from("projects").insert({
        user_id: userId,
        title,
        concept: parsed.data.concept,
        inferred_config: inferredConfig,
        status: "queued",
      }).select("id").single();
      if (projectError) throw new Error(projectError.code);
      const idempotencyKey = `${userId}:${project.id}:${Date.now()}`;
      const { data: run, error: runError } = await supabase.from("runs").insert({
        project_id: project.id,
        user_id: userId,
        status: "queued",
        mode: "live",
        skill_version: getSkillVersion(),
        model_config: {},
        budget: { maxTokens: 120000, maxCostUsd: 20, maxImages: 20, maxVideoSeconds: 120, maxRetries: 2 },
        idempotency_key: idempotencyKey,
      }).select("id").single();
      if (runError) throw new Error(runError.code);
      await supabase.from("projects").update({ current_run_id: run.id }).eq("id", project.id).eq("user_id", userId);
      return Response.json({ projectId: project.id, runId: run.id, backend: "cloud", credentialRequired: true }, { status: 201 });
    } catch {
      // Fall back to the local BYOK runner when optional cloud services are unavailable.
    }
    const created = projectRepository.createPending(parsed.data.concept, {
      durationSeconds: parsed.data.durationSeconds,
      aspectRatio: parsed.data.aspectRatio,
      contentLanguage: parsed.data.contentLanguage,
      visualStyle: parsed.data.visualStyle,
    });
    return Response.json({ ...created, backend: "local", credentialRequired: true }, { status: 201 });
  }
  const created = projectRepository.create(parsed.data.concept, {
    durationSeconds: parsed.data.durationSeconds,
    aspectRatio: parsed.data.aspectRatio,
    contentLanguage: parsed.data.contentLanguage,
    visualStyle: parsed.data.visualStyle,
  });
  return Response.json(created, { status: 201 });
}
