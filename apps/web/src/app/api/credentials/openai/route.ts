import { z } from "zod";
import { encryptCredential } from "@storyforge/agent-core";
import { tasks } from "@trigger.dev/sdk";
import { after } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { runLocalStoryForge, validateOpenAIApiKey } from "@/server/local-live-runner";
import { projectRepository } from "@/server/project-repository";

const credentialSchema = z.object({ apiKey: z.string().min(20).max(300), runId: z.string().min(1).max(200) });

export const runtime = "nodejs";
export const maxDuration = 800;

export async function POST(request: Request) {
  const parsed = credentialSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_credential" }, { status: 400 });
  const localProject = projectRepository.getProjectByRun(parsed.data.runId);
  if (localProject) {
    const validation = await validateOpenAIApiKey(parsed.data.apiKey);
    if (!validation.valid) {
      if (validation.reason === "invalid_api_key") {
        return Response.json({ error: "invalid_api_key", message: "OpenAI 拒绝了这个 API Key，请检查后重试。" }, { status: 401 });
      }
      return Response.json({ error: validation.reason, message: "暂时无法连接 OpenAI，请检查网络后重试。" }, { status: 503 });
    }
    projectRepository.updateRun(parsed.data.runId, (project) => ({ ...project, status: "queued", updatedAt: new Date().toISOString() }));
    after(async () => runLocalStoryForge(parsed.data.runId, parsed.data.apiKey));
    return Response.json({ runId: parsed.data.runId, backend: "local", keyAccepted: true, status: "queued" }, { status: 202 });
  }
  const validation = await validateOpenAIApiKey(parsed.data.apiKey);
  if (!validation.valid) {
    if (validation.reason === "invalid_api_key") {
      return Response.json({ error: "invalid_api_key", message: "OpenAI 拒绝了这个 API Key，请检查后重试。" }, { status: 401 });
    }
    return Response.json({ error: validation.reason, message: "暂时无法连接 OpenAI，请检查网络后重试。" }, { status: 503 });
  }
  const encryptionKey = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!encryptionKey) return Response.json({ error: "server_not_configured" }, { status: 503 });
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  const encrypted = encryptCredential(parsed.data.apiKey, encryptionKey, expiresAt);
  try {
    const supabase = await createSupabaseServerClient();
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub;
    if (claimsError || !userId) return Response.json({ error: "authentication_required" }, { status: 401 });
    const { data: run, error: runError } = await supabase.from("runs").select("id, project_id, budget").eq("id", parsed.data.runId).eq("user_id", userId).single();
    if (runError || !run) return Response.json({ error: "run_not_found" }, { status: 404 });
    const { data: project, error: projectError } = await supabase.from("projects").select("concept, inferred_config").eq("id", run.project_id).eq("user_id", userId).single();
    if (projectError || !project) return Response.json({ error: "project_not_found" }, { status: 404 });
    const asBytea = (base64: string) => `\\x${Buffer.from(base64, "base64").toString("hex")}`;
    const { error: credentialError } = await supabase.from("provider_credentials").upsert({
      user_id: userId,
      run_id: parsed.data.runId,
      provider: "openai",
      ciphertext: asBytea(encrypted.ciphertext),
      iv: asBytea(encrypted.iv),
      auth_tag: asBytea(encrypted.authTag),
      expires_at: encrypted.expiresAt,
    }, { onConflict: "run_id,provider" });
    if (credentialError) throw new Error(credentialError.code);
    if (!process.env.TRIGGER_SECRET_KEY) {
      await supabase.from("runs").update({ status: "paused" }).eq("id", parsed.data.runId).eq("user_id", userId);
      return Response.json({ runId: parsed.data.runId, expiresAt: encrypted.expiresAt, status: "waiting-worker" }, { status: 202 });
    }
    const { data: retryStage } = await supabase.from("stage_runs").select("stage, attempt").eq("run_id", parsed.data.runId).eq("user_id", userId).eq("status", "queued").order("attempt", { ascending: false }).limit(1).maybeSingle();
    const workflowAttempt = retryStage?.attempt ?? 1;
    const handle = await tasks.trigger("storyforge-run", {
      userId,
      projectId: run.project_id,
      runId: parsed.data.runId,
      concept: project.concept,
      projectConfig: project.inferred_config,
      budget: run.budget,
      requestedStage: retryStage?.stage,
      requestedAttempt: retryStage?.attempt,
    }, { idempotencyKey: `${parsed.data.runId}:storyforge-run:${workflowAttempt}` });
    await supabase.from("runs").update({ trigger_run_id: handle.id, status: "queued" }).eq("id", parsed.data.runId).eq("user_id", userId);
    return Response.json({ runId: parsed.data.runId, expiresAt: encrypted.expiresAt, taskRunId: handle.id, backend: "cloud", keyAccepted: true }, { status: 201 });
  } catch {
    return Response.json({ error: "credential_persistence_failed" }, { status: 503 });
  }
}
