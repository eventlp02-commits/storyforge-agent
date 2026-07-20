import { tasks } from "@trigger.dev/sdk";
import { after } from "next/server";
import {
  credentialStorageKey,
  encryptCredential,
  getProviderPreset,
  providerBundleSchema,
  sanitizeProviderBundle,
  validateProviderConnection,
  type ProviderBundle,
} from "@storyforge/agent-core";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { runLocalStoryForge } from "@/server/local-live-runner";
import { projectRepository } from "@/server/project-repository";

const providerRequestSchema = z.object({
  runId: z.string().min(1).max(200),
  providers: providerBundleSchema,
});
const legacyOpenAIRequestSchema = z.object({ apiKey: z.string().min(8).max(1000), runId: z.string().min(1).max(200) });

function normalizeRequest(value: unknown): { runId: string; providers: ProviderBundle; legacy: boolean } | undefined {
  const current = providerRequestSchema.safeParse(value);
  if (current.success) return { ...current.data, legacy: false };
  const legacy = legacyOpenAIRequestSchema.safeParse(value);
  if (!legacy.success) return undefined;
  const preset = getProviderPreset("llm", "openai");
  return {
    runId: legacy.data.runId,
    providers: providerBundleSchema.parse({
      llm: { ...preset, providerId: preset.id, apiKey: legacy.data.apiKey },
      limits: { maxImages: 0, maxVideoSeconds: 0 },
    }),
    legacy: true,
  };
}

function connections(bundle: ProviderBundle) {
  return [bundle.llm, bundle.image, bundle.video].filter((connection): connection is NonNullable<typeof connection> => Boolean(connection?.enabled));
}

function verificationMap(bundle: ProviderBundle, results: Awaited<ReturnType<typeof validateProviderConnection>>[]) {
  const map: Partial<Record<"llm" | "image" | "video", "verified" | "deferred">> = {};
  connections(bundle).forEach((connection, index) => {
    const result = results[index];
    if (result?.valid) map[connection.modality] = result.verification;
  });
  return map;
}

export async function handleProviderCredentialRequest(request: Request) {
  const normalized = normalizeRequest(await request.json().catch(() => null));
  if (!normalized) {
    return Response.json({
      error: "invalid_provider_config",
      message: "模型配置无效：请为已启用的供应商填写 API Key、模型和公开 HTTPS Base URL。",
    }, { status: 400 });
  }
  const activeConnections = connections(normalized.providers);
  const validations = await Promise.all(activeConnections.map((connection) => validateProviderConnection(connection)));
  const rejectedIndex = validations.findIndex((result) => !result.valid);
  if (rejectedIndex >= 0) {
    const provider = activeConnections[rejectedIndex]?.providerId ?? "unknown";
    return Response.json({
      error: "invalid_api_key",
      ...(!normalized.legacy ? { provider } : {}),
      message: normalized.legacy ? "OpenAI 拒绝了这个 API Key，请检查后重试。" : `${provider} 拒绝了对应的 API Key，请检查密钥、项目权限和计费状态。`,
    }, { status: 401 });
  }
  const verification = verificationMap(normalized.providers, validations);

  const localProject = projectRepository.getProjectByRun(normalized.runId);
  if (localProject) {
    projectRepository.updateRun(normalized.runId, (project) => {
      const now = new Date().toISOString();
      const sequence = Math.max(0, ...project.events.map((event) => event.sequence)) + 1;
      const providerSummary = activeConnections.map((connection) => `${connection.modality}:${connection.providerId}/${connection.model}`).join(" · ");
      return {
        ...project,
        status: "queued",
        events: [...project.events.filter((event) => event.id !== `${normalized.runId}:provider-connected`), {
          id: `${normalized.runId}:provider-connected`,
          sequence,
          runId: normalized.runId,
          type: "tool.called",
          title: "Provider Hub 已连接",
          detail: providerSummary,
          timestamp: now,
          sanitized: true,
        }],
        updatedAt: now,
      };
    });
    after(async () => runLocalStoryForge(normalized.runId, normalized.providers));
    return Response.json({ runId: normalized.runId, backend: "local", keyAccepted: true, verification, status: "queued" }, { status: 202 });
  }

  const encryptionKey = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!encryptionKey) return Response.json({ error: "server_not_configured" }, { status: 503 });
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  try {
    const supabase = await createSupabaseServerClient();
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub;
    if (claimsError || !userId) return Response.json({ error: "authentication_required" }, { status: 401 });
    const { data: run, error: runError } = await supabase.from("runs").select("id, project_id, budget").eq("id", normalized.runId).eq("user_id", userId).single();
    if (runError || !run) return Response.json({ error: "run_not_found" }, { status: 404 });
    const { data: project, error: projectError } = await supabase.from("projects").select("concept, inferred_config").eq("id", run.project_id).eq("user_id", userId).single();
    if (projectError || !project) return Response.json({ error: "project_not_found" }, { status: 404 });

    const asBytea = (base64: string) => `\\x${Buffer.from(base64, "base64").toString("hex")}`;
    for (const connection of activeConnections) {
      const encrypted = encryptCredential(connection.apiKey, encryptionKey, expiresAt);
      const { error: credentialError } = await supabase.from("provider_credentials").upsert({
        user_id: userId,
        run_id: normalized.runId,
        provider: credentialStorageKey(connection),
        ciphertext: asBytea(encrypted.ciphertext),
        iv: asBytea(encrypted.iv),
        auth_tag: asBytea(encrypted.authTag),
        expires_at: encrypted.expiresAt,
      }, { onConflict: "run_id,provider" });
      if (credentialError) throw new Error(credentialError.code);
    }

    const publicProviders = sanitizeProviderBundle(normalized.providers);
    const oldBudget = run.budget && typeof run.budget === "object" ? run.budget as Record<string, unknown> : {};
    const budget = {
      ...oldBudget,
      maxImages: publicProviders.limits.maxImages,
      maxVideoSeconds: publicProviders.limits.maxVideoSeconds,
    };
    const { error: configError } = await supabase.from("runs").update({ model_config: { providers: publicProviders }, budget }).eq("id", normalized.runId).eq("user_id", userId);
    if (configError) throw new Error(configError.code);
    const { data: lastEvent } = await supabase.from("run_events").select("sequence").eq("run_id", normalized.runId).eq("user_id", userId).order("sequence", { ascending: false }).limit(1).maybeSingle();
    const providerSummary = activeConnections.map((connection) => `${connection.modality}:${connection.providerId}/${connection.model}`).join(" · ");
    await supabase.from("run_events").upsert({
      run_id: normalized.runId,
      project_id: run.project_id,
      user_id: userId,
      sequence: Number(lastEvent?.sequence ?? 0) + 1,
      type: "tool.called",
      title: "Provider Hub connected",
      detail: providerSummary,
      sanitized: true,
      idempotency_key: `${normalized.runId}:provider-connected`,
    }, { onConflict: "run_id,idempotency_key", ignoreDuplicates: true });

    if (!process.env.TRIGGER_SECRET_KEY) {
      await supabase.from("runs").update({ status: "paused" }).eq("id", normalized.runId).eq("user_id", userId);
      return Response.json({ runId: normalized.runId, expiresAt: expiresAt.toISOString(), status: "waiting-worker", verification }, { status: 202 });
    }
    const { data: retryStage } = await supabase.from("stage_runs").select("stage, attempt").eq("run_id", normalized.runId).eq("user_id", userId).eq("status", "queued").order("attempt", { ascending: false }).limit(1).maybeSingle();
    const workflowAttempt = retryStage?.attempt ?? 1;
    const handle = await tasks.trigger("storyforge-run", {
      userId,
      projectId: run.project_id,
      runId: normalized.runId,
      concept: project.concept,
      projectConfig: project.inferred_config,
      providerConfig: publicProviders,
      budget,
      requestedStage: retryStage?.stage,
      requestedAttempt: retryStage?.attempt,
    }, { idempotencyKey: `${normalized.runId}:storyforge-run:${workflowAttempt}` });
    await supabase.from("runs").update({ trigger_run_id: handle.id, status: "queued" }).eq("id", normalized.runId).eq("user_id", userId);
    return Response.json({ runId: normalized.runId, expiresAt: expiresAt.toISOString(), taskRunId: handle.id, backend: "cloud", keyAccepted: true, verification }, { status: 201 });
  } catch {
    return Response.json({ error: "credential_persistence_failed" }, { status: 503 });
  }
}
