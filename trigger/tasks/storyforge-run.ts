import { logger, metadata, task } from "@trigger.dev/sdk";
import { createClient } from "@supabase/supabase-js";
import {
  createImageProvider,
  createStageExecutor,
  createVideoProvider,
  credentialStorageKey,
  decryptCredential,
  providerBundleSchema,
  runStoryForgeWorkflow,
  type AspectRatio,
  type EncryptedCredential,
  type ImageGenerationResult,
  type ProviderBundle,
  type PublicProviderBundle,
} from "@storyforge/agent-core";
import { stageNameSchema } from "@storyforge/contracts";
import { buildPersistenceRows, seedOutputsFromRows } from "./storyforge-persistence";
import { generatePlannedImages, generatePlannedVideos } from "./storyforge-media";

export type StoryForgeTaskPayload = {
  userId: string;
  projectId: string;
  runId: string;
  concept: string;
  projectConfig?: Record<string, unknown>;
  providerConfig?: PublicProviderBundle;
  budget?: { maxTokens: number; maxCostUsd: number; maxImages: number; maxVideoSeconds: number };
  requestedStage?: string;
  requestedAttempt?: number;
  qualityMode?: boolean;
};

function byteaToBase64(value: string): string {
  return value.startsWith("\\x") ? Buffer.from(value.slice(2), "hex").toString("base64") : value;
}

function usageFromJson(value: unknown) {
  const usage = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const number = (field: string) => Number.isFinite(Number(usage[field])) ? Number(usage[field]) : 0;
  return { tokens: number("tokens"), costUsd: number("costUsd"), images: number("images"), videoSeconds: number("videoSeconds") };
}

function aspectRatioFromConfig(value: unknown): AspectRatio {
  return value === "9:16" || value === "1:1" || value === "4:5" || value === "2.39:1" ? value : "16:9";
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service environment is not configured");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function hydrateProviderBundle(publicBundle: PublicProviderBundle, credentials: Map<string, string>): ProviderBundle | undefined {
  const withCredential = (connection: PublicProviderBundle["llm"] | PublicProviderBundle["image"] | PublicProviderBundle["video"] | undefined) => {
    if (!connection) return undefined;
    const apiKey = credentials.get(credentialStorageKey(connection));
    return apiKey ? { ...connection, apiKey } : undefined;
  };
  const llm = withCredential(publicBundle.llm);
  if (!llm) return undefined;
  const image = withCredential(publicBundle.image);
  const video = withCredential(publicBundle.video);
  if (publicBundle.image && !image) return undefined;
  if (publicBundle.video && !video) return undefined;
  const parsed = providerBundleSchema.safeParse({ llm, image, video, limits: publicBundle.limits });
  return parsed.success ? parsed.data : undefined;
}

async function imageBytes(result: ImageGenerationResult, providers: ProviderBundle) {
  const encoded = result.dataUrl?.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (encoded?.[1] && encoded[2]) return { bytes: Buffer.from(encoded[2], "base64"), contentType: encoded[1] };
  if (!result.url) throw new Error("Image provider returned no downloadable media");
  const headers: Record<string, string> = {};
  if (result.provider === "replicate" && providers.image) headers.authorization = `Bearer ${providers.image.apiKey}`;
  const response = await fetch(result.url, { headers });
  if (!response.ok) throw new Error(`Generated image download failed with ${response.status}`);
  return { bytes: Buffer.from(await response.arrayBuffer()), contentType: response.headers.get("content-type") ?? "image/png" };
}

export const storyforgeRunTask = task({
  id: "storyforge-run",
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 30000,
    randomize: true,
  },
  run: async (payload: StoryForgeTaskPayload, { signal }) => {
    const supabase = adminClient();
    metadata.set("projectId", payload.projectId).set("runId", payload.runId).set("requestedStage", payload.requestedStage ?? "full").set("status", "loading-credential").set("progress", 0.02);

    const [{ data: credentialRows }, { data: configuredRun }] = await Promise.all([
      supabase.from("provider_credentials").select("provider, ciphertext, iv, auth_tag, expires_at").eq("run_id", payload.runId).eq("user_id", payload.userId),
      supabase.from("runs").select("model_config").eq("id", payload.runId).eq("user_id", payload.userId).maybeSingle(),
    ]);

    if (!credentialRows?.length) {
      await supabase.from("runs").update({ status: "paused" }).eq("id", payload.runId).eq("user_id", payload.userId);
      metadata.set("status", "waiting-for-credential").set("progress", 0.02);
      return { status: "waiting" as const };
    }

    const encryptionKey = process.env.CREDENTIAL_ENCRYPTION_KEY;
    if (!encryptionKey) throw new Error("Credential encryption is not configured");
    const credentials = new Map<string, string>();
    for (const credential of credentialRows) {
      const encrypted: EncryptedCredential = {
        algorithm: "aes-256-gcm",
        ciphertext: byteaToBase64(credential.ciphertext),
        iv: byteaToBase64(credential.iv),
        authTag: byteaToBase64(credential.auth_tag),
        expiresAt: credential.expires_at,
      };
      credentials.set(credential.provider, decryptCredential(encrypted, encryptionKey));
    }
    const savedModelConfig = configuredRun?.model_config && typeof configuredRun.model_config === "object" ? configuredRun.model_config as Record<string, unknown> : {};
    const publicProviders = payload.providerConfig ?? savedModelConfig.providers as PublicProviderBundle | undefined;
    const providers = publicProviders ? hydrateProviderBundle(publicProviders, credentials) : undefined;
    if (!providers) {
      await supabase.from("runs").update({ status: "paused" }).eq("id", payload.runId).eq("user_id", payload.userId);
      metadata.set("status", "waiting-for-provider-configuration").set("progress", 0.02);
      return { status: "waiting" as const };
    }
    const executor = createStageExecutor(providers.llm, {
      qualityMode: payload.qualityMode,
      signal,
      onStreamEvent: ({ type, stage, detail }) => {
        metadata.append("agentEvents", { type, stage, detail, at: new Date().toISOString() });
      },
    });

    await supabase.from("runs").update({ status: "running", started_at: new Date().toISOString() }).eq("id", payload.runId).eq("user_id", payload.userId);
    metadata.set("status", "running").set("progress", 0.05);

    try {
      const requestedStage = stageNameSchema.safeParse(payload.requestedStage);
      const [artifactQuery, lastEventQuery, runUsageQuery] = await Promise.all([
        supabase.from("artifacts").select("type, content, version").eq("project_id", payload.projectId).eq("user_id", payload.userId).order("version", { ascending: true }),
        supabase.from("run_events").select("sequence").eq("run_id", payload.runId).eq("user_id", payload.userId).order("sequence", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("runs").select("usage").eq("id", payload.runId).eq("user_id", payload.userId).single(),
      ]);
      if (artifactQuery.error) throw new Error(`Artifact restore failed: ${artifactQuery.error.code}`);
      if (lastEventQuery.error) throw new Error(`Event restore failed: ${lastEventQuery.error.code}`);
      if (runUsageQuery.error) throw new Error(`Usage restore failed: ${runUsageQuery.error.code}`);
      const initialUsage = usageFromJson(runUsageQuery.data.usage);
      let seedOutputs;
      if (requestedStage.success) {
        const [shotQuery, assetQuery] = await Promise.all([
          supabase.from("shots").select("shot_code, start_seconds, end_seconds, scene, purpose, framing, camera, action, dialogue, sound, transition, asset_ids").eq("run_id", payload.runId).eq("user_id", payload.userId).order("sort_order"),
          supabase.from("assets").select("asset_code, name, type, prompt, metadata").eq("run_id", payload.runId).eq("user_id", payload.userId),
        ]);
        if (shotQuery.error) throw new Error(`Shot restore failed: ${shotQuery.error.code}`);
        if (assetQuery.error) throw new Error(`Asset restore failed: ${assetQuery.error.code}`);
        seedOutputs = seedOutputsFromRows({
          artifacts: artifactQuery.data ?? [],
          shots: shotQuery.data ?? [],
          assets: assetQuery.data ?? [],
        });
      }

      const result = await runStoryForgeWorkflow({
        concept: payload.concept,
        runId: payload.runId,
        projectConfig: payload.projectConfig,
        budget: payload.budget,
        initialUsage,
        startStage: requestedStage.success ? requestedStage.data : undefined,
        startAttempt: payload.requestedAttempt,
        seedOutputs,
        sequenceOffset: Number(lastEventQuery.data?.sequence ?? 0),
        signal,
        control: async () => {
          const { data: controlRun } = await supabase.from("runs").select("status").eq("id", payload.runId).eq("user_id", payload.userId).maybeSingle();
          if (controlRun?.status === "cancelled") return "cancel";
          return controlRun?.status === "paused" ? "pause" : "run";
        },
        onEvent: async (event) => {
          const progress = Math.min(0.94, 0.05 + event.sequence * 0.035);
          metadata.set("progress", progress).set("stage", event.stage ?? "workflow").set("status", event.type);
          const { error } = await supabase.from("run_events").upsert({
            run_id: payload.runId,
            project_id: payload.projectId,
            user_id: payload.userId,
            sequence: event.sequence,
            type: event.type,
            stage: event.stage,
            title: event.title,
            detail: event.detail,
            metrics: event.metrics,
            sanitized: true,
            idempotency_key: event.id,
          }, { onConflict: "run_id,idempotency_key", ignoreDuplicates: true });
          if (error) logger.warn("Event persistence failed", { code: error.code, sequence: event.sequence });
        },
      }, executor);

      for (const stageRun of result.stageRuns) {
        await supabase.from("stage_runs").upsert({
          run_id: payload.runId,
          project_id: payload.projectId,
          user_id: payload.userId,
          stage: stageRun.stage,
          status: stageRun.status,
          attempt: stageRun.attempt,
          parallel_group: stageRun.parallelGroup,
          duration_ms: stageRun.durationMs,
          input_tokens: stageRun.inputTokens,
          output_tokens: stageRun.outputTokens,
          cost_usd: stageRun.costUsd,
          idempotency_key: stageRun.id,
          started_at: stageRun.startedAt,
          completed_at: stageRun.completedAt,
        }, { onConflict: "run_id,idempotency_key" });
      }

      const persistence = buildPersistenceRows(result, {
        projectId: payload.projectId,
        runId: payload.runId,
        userId: payload.userId,
        initialConfig: payload.projectConfig,
      });
      if (persistence.artifacts.length > 0) {
        const versions = new Map<string, number>();
        for (const artifact of artifactQuery.data ?? []) {
          versions.set(artifact.type, Math.max(versions.get(artifact.type) ?? 0, artifact.version));
        }
        const artifactTypes = [...new Set(persistence.artifacts.map((artifact) => artifact.type))];
        const { error: archiveError } = await supabase.from("artifacts").update({ status: "archived" }).eq("project_id", payload.projectId).eq("user_id", payload.userId).in("type", artifactTypes).in("status", ["current", "stale"]);
        if (archiveError) throw new Error(`Artifact archival failed: ${archiveError.code}`);
        for (const artifact of persistence.artifacts) artifact.version = (versions.get(artifact.type) ?? 0) + 1;
        const { error } = await supabase.from("artifacts").upsert(persistence.artifacts, { onConflict: "project_id,type,version" });
        if (error) throw new Error(`Artifact persistence failed: ${error.code}`);
      }
      if (persistence.shots.length > 0) {
        const { error } = await supabase.from("shots").upsert(persistence.shots, { onConflict: "run_id,shot_code" });
        if (error) throw new Error(`Shot persistence failed: ${error.code}`);
      }
      if (persistence.assets.length > 0) {
        const { error } = await supabase.from("assets").upsert(persistence.assets, { onConflict: "run_id,asset_code" });
        if (error) throw new Error(`Asset persistence failed: ${error.code}`);
      }
      if (persistence.inferredConfig || persistence.title) {
        const { error } = await supabase.from("projects").update({
          ...(persistence.title ? { title: persistence.title } : {}),
          ...(persistence.inferredConfig ? { inferred_config: persistence.inferredConfig } : {}),
        }).eq("id", payload.projectId).eq("user_id", payload.userId);
        if (error) throw new Error(`Project persistence failed: ${error.code}`);
      }

      let mediaSequence = result.events.at(-1)?.sequence ?? Number(lastEventQuery.data?.sequence ?? 0);
      const persistMediaEvent = async (event: { type: "tool.called" | "artifact.updated"; title: string; detail: string }) => {
        mediaSequence += 1;
        const { error } = await supabase.from("run_events").upsert({
          run_id: payload.runId,
          project_id: payload.projectId,
          user_id: payload.userId,
          sequence: mediaSequence,
          type: event.type,
          stage: "asset-director",
          title: event.title,
          detail: event.detail,
          sanitized: true,
          idempotency_key: `${payload.runId}:media:${mediaSequence}`,
        }, { onConflict: "run_id,idempotency_key", ignoreDuplicates: true });
        if (error) logger.warn("Media event persistence failed", { code: error.code, sequence: mediaSequence });
      };
      const imageLimit = result.status === "completed" && providers.image ? Math.max(0, (payload.budget?.maxImages ?? providers.limits.maxImages) - initialUsage.images) : 0;
      const mediaResult = await generatePlannedImages({
        assets: persistence.assets.map((asset) => ({
          assetCode: asset.asset_code,
          prompt: asset.prompt,
          priority: asset.metadata.priority === "recommended" ? "recommended" : "required",
        })),
        aspectRatio: aspectRatioFromConfig(payload.projectConfig?.aspectRatio),
        limit: imageLimit,
        provider: providers.image ? createImageProvider(providers.image) : { generate: async () => ({ status: "prompt-only" as const, provider: "disabled" }) },
        isStopped: async () => {
          while (true) {
            const { data: controlRun } = await supabase.from("runs").select("status, model_config").eq("id", payload.runId).eq("user_id", payload.userId).single();
            const modelConfig = controlRun?.model_config && typeof controlRun.model_config === "object" ? controlRun.model_config as Record<string, unknown> : {};
            if (controlRun?.status === "cancelled" || modelConfig.mediaGenerationStopped === true) return true;
            if (controlRun?.status !== "paused") return false;
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        },
        onStarted: async (asset) => {
          await supabase.from("assets").update({ status: "generating" }).eq("run_id", payload.runId).eq("asset_code", asset.assetCode).eq("user_id", payload.userId);
          await persistMediaEvent({ type: "tool.called", title: "Image generation started", detail: `${asset.assetCode} sent to the configured image provider` });
        },
        onDone: async (asset, generated) => {
          const media = await imageBytes(generated, providers);
          const safeCode = asset.assetCode.replace(/[^a-zA-Z0-9_-]/g, "_");
          const extension = media.contentType.includes("webp") ? "webp" : media.contentType.includes("jpeg") || media.contentType.includes("jpg") ? "jpg" : "png";
          const storagePath = `${payload.userId}/${payload.projectId}/${payload.runId}/${safeCode}.${extension}`;
          const { error: uploadError } = await supabase.storage.from("storyforge-assets").upload(storagePath, media.bytes, { contentType: media.contentType, upsert: true });
          if (uploadError) throw new Error(`Image storage failed: ${uploadError.message}`);
          await supabase.from("assets").update({ status: "done", storage_path: storagePath }).eq("run_id", payload.runId).eq("asset_code", asset.assetCode).eq("user_id", payload.userId);
          await persistMediaEvent({ type: "artifact.updated", title: "Image asset completed", detail: `${asset.assetCode} stored in the private project bucket` });
        },
        onQueued: async (asset, generated) => {
          await supabase.from("assets").update({
            status: "generating",
            metadata: { provider: generated.provider, model: generated.model, providerJobId: generated.jobId, providerStatusUrl: generated.statusUrl },
          }).eq("run_id", payload.runId).eq("asset_code", asset.assetCode).eq("user_id", payload.userId);
          await persistMediaEvent({ type: "tool.called", title: "Image job queued", detail: `${asset.assetCode} queued on ${generated.provider} as ${generated.jobId}` });
        },
        onDeferred: async (asset) => {
          await supabase.from("assets").update({ status: "prompt-only" }).eq("run_id", payload.runId).eq("asset_code", asset.assetCode).eq("user_id", payload.userId);
          await persistMediaEvent({ type: "artifact.updated", title: "Image asset kept as prompt-only", detail: `${asset.assetCode} remains usable in the production package` });
        },
      });

      const mediaStopped = async () => {
        while (true) {
          const { data: controlRun } = await supabase.from("runs").select("status, model_config").eq("id", payload.runId).eq("user_id", payload.userId).single();
          const modelConfig = controlRun?.model_config && typeof controlRun.model_config === "object" ? controlRun.model_config as Record<string, unknown> : {};
          if (controlRun?.status === "cancelled" || modelConfig.mediaGenerationStopped === true) return true;
          if (controlRun?.status !== "paused") return false;
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      };
      const videoLimit = result.status === "completed" && providers.video ? Math.max(0, (payload.budget?.maxVideoSeconds ?? providers.limits.maxVideoSeconds) - initialUsage.videoSeconds) : 0;
      const videoResult = await generatePlannedVideos({
        shots: persistence.shots.map((shot) => ({
          shotCode: shot.shot_code,
          prompt: shot.prompt,
          durationSeconds: Number(shot.end_seconds) - Number(shot.start_seconds),
        })),
        aspectRatio: aspectRatioFromConfig(payload.projectConfig?.aspectRatio),
        secondsLimit: videoLimit,
        provider: providers.video ? createVideoProvider(providers.video) : { generate: async () => ({ status: "deferred" as const, provider: "disabled" }) },
        isStopped: mediaStopped,
        onStarted: async (shot) => {
          await supabase.from("shots").update({ generation_status: "generating" }).eq("run_id", payload.runId).eq("shot_code", shot.shotCode).eq("user_id", payload.userId);
          await persistMediaEvent({ type: "tool.called", title: "Video generation started", detail: `${shot.shotCode} sent to the configured video provider` });
        },
        onDone: async (shot, generated) => {
          await supabase.from("shots").update({ generation_status: "done", media_url: generated.url, provider_job_id: generated.jobId, media_provider: generated.provider }).eq("run_id", payload.runId).eq("shot_code", shot.shotCode).eq("user_id", payload.userId);
          await persistMediaEvent({ type: "artifact.updated", title: "Video shot completed", detail: `${shot.shotCode} completed on ${generated.provider}` });
        },
        onQueued: async (shot, generated) => {
          await supabase.from("shots").update({ generation_status: "generating", provider_job_id: generated.jobId, media_provider: generated.provider }).eq("run_id", payload.runId).eq("shot_code", shot.shotCode).eq("user_id", payload.userId);
          await persistMediaEvent({ type: "tool.called", title: "Video job queued", detail: `${shot.shotCode} queued on ${generated.provider} as ${generated.jobId}` });
        },
        onDeferred: async (shot) => {
          await supabase.from("shots").update({ generation_status: "deferred" }).eq("run_id", payload.runId).eq("shot_code", shot.shotCode).eq("user_id", payload.userId);
        },
      });

      const { data: finalControl } = await supabase.from("runs").select("status").eq("id", payload.runId).eq("user_id", payload.userId).single();
      const status = finalControl?.status === "cancelled" ? "cancelled" : result.status === "cancelled" ? "cancelled" : result.status === "completed" ? "completed" : result.status === "paused" ? "paused" : "failed";
      await supabase.from("runs").update({
        status,
        usage: {
          tokens: initialUsage.tokens + result.usage.inputTokens + result.usage.outputTokens,
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          costUsd: initialUsage.costUsd + result.usage.costUsd,
          images: initialUsage.images + mediaResult.completed + (mediaResult.queued ?? 0),
          videoSeconds: initialUsage.videoSeconds + videoResult.completedSeconds + videoResult.queuedSeconds,
        },
        completed_at: new Date().toISOString(),
      }).eq("id", payload.runId).eq("user_id", payload.userId);
      await supabase.from("projects").update({ status }).eq("id", payload.projectId).eq("user_id", payload.userId);
      metadata.set("status", status).set("progress", 1);
      return { status, stageCount: result.stageRuns.length, usage: result.usage };
    } catch (error) {
      await supabase.from("runs").update({ status: "failed", completed_at: new Date().toISOString() }).eq("id", payload.runId).eq("user_id", payload.userId);
      await supabase.from("projects").update({ status: "failed" }).eq("id", payload.projectId).eq("user_id", payload.userId);
      metadata.set("status", "failed").set("progress", 1);
      logger.error("StoryForge task failed", { runId: payload.runId, errorType: error instanceof Error ? error.name : "Unknown" });
      throw error;
    } finally {
      await executor.close();
      await supabase.from("provider_credentials").delete().eq("run_id", payload.runId).eq("user_id", payload.userId);
    }
  },
});
