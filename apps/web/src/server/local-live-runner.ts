import {
  assetOutputSchema,
  createImageProvider,
  createStageExecutor,
  createVideoProvider,
  getProviderPreset,
  getSkillVersion,
  intakeOutputSchema,
  providerBundleSchema,
  promptOutputSchema,
  qaOutputSchema,
  runStoryForgeWorkflow,
  shotOutputSchema,
  validateProviderConnection,
  type ProviderBundle,
  type WorkflowResult,
} from "@storyforge/agent-core";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  projectSnapshotSchema,
  type Artifact,
  type Asset,
  type ProjectSnapshot,
  type RunEvent,
  type StageName,
} from "@storyforge/contracts";
import { projectRepository } from "./project-repository";

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export async function validateOpenAIApiKey(apiKey: string, request: Fetcher = fetch) {
  const preset = getProviderPreset("llm", "openai");
  const connection = providerBundleSchema.parse({ llm: { ...preset, providerId: preset.id, apiKey } }).llm;
  const result = await validateProviderConnection(connection, request);
  return result.valid ? { valid: true as const } : result;
}

function assetType(type: string): Asset["type"] {
  const supported: Asset["type"][] = ["character", "location", "prop", "creature", "vehicle", "food", "flora", "effect", "graphic", "audio"];
  return supported.includes(type as Asset["type"]) ? type as Asset["type"] : "prop";
}

export function snapshotFromWorkflowResult(base: ProjectSnapshot, result: WorkflowResult): ProjectSnapshot {
  const now = new Date().toISOString();
  const intake = intakeOutputSchema.safeParse(result.outputs.intake);
  const shotPlan = shotOutputSchema.safeParse(result.outputs["shot-designer"]);
  const promptPlan = promptOutputSchema.safeParse(result.outputs["prompt-engineer"]);
  const promptByShot = new Map(promptPlan.success ? promptPlan.data.shots.map((shot) => [shot.shotId, shot.prompt] as const) : []);
  const shots = shotPlan.success ? shotPlan.data.shots.map((shot, index) => ({
    id: shot.id,
    order: index + 1,
    start: shot.start,
    end: shot.end,
    scene: shot.scene,
    purpose: shot.purpose,
    framing: shot.framing,
    camera: shot.camera,
    action: shot.action,
    ...(shot.dialogue ? { dialogue: shot.dialogue } : {}),
    sound: shot.sound,
    transition: shot.transition,
    assetIds: shot.assetIds,
    prompt: promptByShot.get(shot.id) ?? "等待提示词阶段",
    generationStatus: "ready" as const,
  })) : [];
  const assetPlan = assetOutputSchema.safeParse(result.outputs["asset-director"]);
  const assets: Asset[] = assetPlan.success ? assetPlan.data.assets.map((asset) => ({
    id: asset.id,
    name: asset.name,
    type: assetType(asset.type),
    status: "prompt-only",
    prompt: asset.prompt,
    shotIds: shots.filter((shot) => shot.assetIds.includes(asset.id)).map((shot) => shot.id),
    notes: [asset.shotPurpose, ...asset.variants].filter(Boolean).join("；"),
  })) : [];

  const artifactDefinitions: Array<{ type: Artifact["type"]; title: string; sourceStage: StageName; content: unknown }> = [
    { type: "brief", title: "创意简报", sourceStage: "intake", content: result.outputs.intake },
    { type: "world", title: "世界观与美术圣经", sourceStage: "story-architect", content: { story: result.outputs["story-architect"], artDirection: result.outputs["art-director"] } },
    { type: "script", title: "完整剧本", sourceStage: "scriptwriter", content: result.outputs.scriptwriter },
    { type: "audio", title: "声音设计", sourceStage: "audio-director", content: result.outputs["audio-director"] },
    { type: "prompts", title: "生成提示词包", sourceStage: "prompt-engineer", content: result.outputs["prompt-engineer"] },
    { type: "qa", title: "质量检查", sourceStage: "qa-critic", content: result.outputs["qa-critic"] },
    { type: "package", title: "制作包清单", sourceStage: "packager", content: result.outputs.packager },
  ];
  const artifacts: Artifact[] = artifactDefinitions.flatMap((artifact) => artifact.content === undefined ? [] : [{
    ...artifact,
    id: `${base.id}:${artifact.type}:v1`,
    version: 1,
    status: "current" as const,
    createdAt: now,
  }]);
  const qa = qaOutputSchema.safeParse(result.outputs["qa-critic"]);
  const latestStageRuns = new Map(result.stageRuns.map((stage) => [stage.stage, stage]));
  const stageRuns = base.stageRuns.map((stage) => latestStageRuns.get(stage.stage) ?? stage);
  const autoRepairCount = Math.max(0, result.stageRuns.filter((stage) => stage.stage === "qa-critic").length - 1);
  const retainedProviderEvents = base.events.filter((event) => event.id === `${base.runId}:provider-connected`);
  const retainedControlEvents = base.events.filter((event) => event.id === `${base.runId}:media-stopped`).map((event, index) => ({
    ...event,
    sequence: Math.max(0, ...result.events.map((item) => item.sequence)) + index + 1,
  }));

  return projectSnapshotSchema.parse({
    ...base,
    skillVersion: getSkillVersion(),
    status: result.status,
    config: intake.success ? {
      ...base.config,
      title: intake.data.title,
      durationSeconds: intake.data.durationSeconds,
      aspectRatio: intake.data.aspectRatio,
      contentLanguage: intake.data.contentLanguage,
      format: intake.data.format,
      assumptions: intake.data.assumptions,
    } : base.config,
    stageRuns,
    artifacts,
    shots,
    assets,
    events: [...retainedProviderEvents, ...result.events, ...retainedControlEvents].sort((left, right) => left.sequence - right.sequence),
    qa: qa.success ? {
      score: qa.data.score,
      passed: qa.data.passed,
      autoRepairCount,
      checks: qa.data.checks.map((check) => ({ id: check.id, label: check.id, status: check.status, detail: check.detail })),
    } : { score: 0, passed: false, autoRepairCount, checks: [] },
    usage: {
      tokens: result.usage.inputTokens + result.usage.outputTokens,
      costUsd: result.usage.costUsd,
      images: 0,
      videoSeconds: 0,
    },
    updatedAt: now,
  });
}

function applyEvent(project: ProjectSnapshot, event: RunEvent): ProjectSnapshot {
  const status = event.type === "run.completed" ? "completed"
    : event.type === "run.failed" ? "failed"
      : event.type === "run.cancelled" ? "cancelled"
        : event.type === "run.paused" ? "paused"
          : "running";
  return {
    ...project,
    status,
    events: [...project.events.filter((existing) => existing.id !== event.id), event].sort((left, right) => left.sequence - right.sequence),
    stageRuns: project.stageRuns.map((stage) => stage.stage !== event.stage ? stage : {
      ...stage,
      status: event.type === "stage.started" ? "running" : event.type === "stage.completed" ? "completed" : event.type === "stage.failed" ? "failed" : stage.status,
      ...(event.type === "stage.started" ? { startedAt: event.timestamp } : {}),
      ...(event.type === "stage.completed" ? { completedAt: event.timestamp } : {}),
      durationMs: event.metrics?.durationMs ?? stage.durationMs,
      inputTokens: event.metrics?.tokens ?? stage.inputTokens,
      costUsd: event.metrics?.costUsd ?? stage.costUsd,
    }),
    updatedAt: event.timestamp,
  };
}

function appendMediaEvent(project: ProjectSnapshot, title: string, detail: string): ProjectSnapshot {
  const sequence = Math.max(0, ...project.events.map((event) => event.sequence)) + 1;
  const now = new Date().toISOString();
  return {
    ...project,
    events: [...project.events, {
      id: `${project.runId}:local-media:${sequence}`,
      sequence,
      runId: project.runId,
      type: "tool.called",
      title,
      detail,
      timestamp: now,
      sanitized: true,
    }],
    updatedAt: now,
  };
}

function localMediaStopped(runId: string) {
  return projectRepository.getProjectByRun(runId)?.events.some((event) => event.id === `${runId}:media-stopped`) ?? true;
}

async function persistLocalImage(runId: string, assetId: string, result: { dataUrl?: string; url?: string; provider: string }, apiKey?: string) {
  let bytes: Buffer;
  let contentType = "image/png";
  const encoded = result.dataUrl?.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (encoded?.[1] && encoded[2]) {
    contentType = encoded[1];
    bytes = Buffer.from(encoded[2], "base64");
  } else if (result.url) {
    const response = await fetch(result.url, { headers: result.provider === "replicate" && apiKey ? { authorization: `Bearer ${apiKey}` } : {} });
    if (!response.ok) throw new Error(`Generated image download failed with ${response.status}`);
    contentType = response.headers.get("content-type") ?? contentType;
    bytes = Buffer.from(await response.arrayBuffer());
  } else {
    throw new Error("Image provider returned no downloadable image");
  }
  const extension = contentType.includes("webp") ? "webp" : contentType.includes("jpeg") || contentType.includes("jpg") ? "jpg" : "png";
  const safeAssetId = assetId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const directory = join(tmpdir(), "storyforge-agent", runId);
  const filename = `${safeAssetId}.${extension}`;
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, filename), bytes);
  return `/api/local-media/${encodeURIComponent(runId)}/${encodeURIComponent(filename)}`;
}

async function runLocalMedia(runId: string, providers: ProviderBundle) {
  const initial = projectRepository.getProjectByRun(runId);
  if (!initial || initial.status === "failed" || initial.status === "cancelled") return;
  if (providers.image && providers.limits.maxImages > 0) {
    const imageProvider = createImageProvider(providers.image);
    for (const asset of initial.assets.slice(0, providers.limits.maxImages)) {
      if (localMediaStopped(runId)) break;
      projectRepository.updateRun(runId, (project) => appendMediaEvent({
        ...project,
        status: "running",
        assets: project.assets.map((item) => item.id === asset.id ? { ...item, status: "generating" } : item),
      }, "图片任务已提交", `${asset.id} 正在由 ${providers.image?.providerId} 生成`));
      try {
        const generated = await imageProvider.generate({ prompt: asset.prompt, aspectRatio: initial.config.aspectRatio });
        const fileUrl = generated.status === "done" ? await persistLocalImage(runId, asset.id, generated, providers.image.apiKey) : undefined;
        projectRepository.updateRun(runId, (project) => appendMediaEvent({
          ...project,
          assets: project.assets.map((item) => item.id === asset.id ? {
            ...item,
            status: generated.status === "done" ? "done" : generated.status === "queued" ? "generating" : "prompt-only",
            ...(fileUrl ? { fileUrl, thumbnailUrl: fileUrl } : {}),
            notes: [item.notes, generated.jobId ? `任务 ${generated.jobId}` : "", generated.statusUrl ? `状态 ${generated.statusUrl}` : "", `${generated.provider}/${generated.model ?? "default"}`].filter(Boolean).join("；"),
          } : item),
          usage: { ...project.usage, images: project.usage.images + Number(generated.status === "done" || generated.status === "queued") },
        }, generated.status === "queued" ? "图片任务已进入队列" : "图片资产已更新", `${asset.id}：${generated.provider}`));
      } catch {
        projectRepository.updateRun(runId, (project) => appendMediaEvent({
          ...project,
          assets: project.assets.map((item) => item.id === asset.id ? { ...item, status: "prompt-only" } : item),
        }, "图片任务已保留为提示词", `${asset.id} 的媒体请求失败，文本制作包不受影响`));
      }
    }
  }

  if (providers.video && providers.limits.maxVideoSeconds > 0) {
    const videoProvider = createVideoProvider(providers.video);
    let usedSeconds = 0;
    const current = projectRepository.getProjectByRun(runId);
    for (const shot of current?.shots ?? []) {
      const durationSeconds = shot.end - shot.start;
      if (usedSeconds + durationSeconds > providers.limits.maxVideoSeconds || localMediaStopped(runId)) break;
      usedSeconds += durationSeconds;
      projectRepository.updateRun(runId, (project) => appendMediaEvent({
        ...project,
        status: "running",
        shots: project.shots.map((item) => item.id === shot.id ? { ...item, generationStatus: "generating" } : item),
      }, "视频任务已提交", `${shot.id} 正在由 ${providers.video?.providerId} 生成`));
      try {
        const generated = await videoProvider.generate({ prompt: shot.prompt, durationSeconds, aspectRatio: current?.config.aspectRatio ?? "16:9" });
        projectRepository.updateRun(runId, (project) => appendMediaEvent({
          ...project,
          shots: project.shots.map((item) => item.id === shot.id ? {
            ...item,
            generationStatus: generated.status === "done" ? "done" : generated.status === "queued" ? "generating" : "deferred",
            ...(generated.url ? { fileUrl: generated.url } : {}),
            ...(generated.jobId ? { providerJobId: generated.jobId } : {}),
            mediaProvider: generated.provider,
          } : item),
          usage: { ...project.usage, videoSeconds: project.usage.videoSeconds + Number(generated.status === "done" || generated.status === "queued") * durationSeconds },
        }, generated.status === "queued" ? "视频任务已进入队列" : "视频镜头已更新", `${shot.id}：${generated.provider}`));
      } catch {
        projectRepository.updateRun(runId, (project) => appendMediaEvent({
          ...project,
          shots: project.shots.map((item) => item.id === shot.id ? { ...item, generationStatus: "deferred" } : item),
        }, "视频任务已延期", `${shot.id} 的媒体请求失败，镜头提示词仍可导出`));
      }
    }
  }
}

export async function runLocalStoryForge(runId: string, providers: ProviderBundle) {
  const base = projectRepository.getProjectByRun(runId);
  if (!base) throw new Error("Local run not found");
  const executor = createStageExecutor(providers.llm);
  projectRepository.updateRun(runId, (project) => ({ ...project, status: "running", updatedAt: new Date().toISOString() }));
  try {
    const result = await runStoryForgeWorkflow({
      concept: base.config.concept,
      runId,
      projectConfig: base.config,
      budget: { maxTokens: 120_000, maxCostUsd: 20, maxImages: providers.limits.maxImages, maxVideoSeconds: providers.limits.maxVideoSeconds },
      sequenceOffset: Math.max(0, ...base.events.map((event) => event.sequence)),
      onEvent: (event) => { projectRepository.updateRun(runId, (project) => applyEvent(project, event)); },
    }, executor);
    projectRepository.updateRun(runId, (project) => snapshotFromWorkflowResult(project, result));
    if (result.status === "completed") await runLocalMedia(runId, providers);
    projectRepository.updateRun(runId, (project) => ({ ...project, status: result.status, updatedAt: new Date().toISOString() }));
  } catch {
    const failedAt = new Date().toISOString();
    projectRepository.updateRun(runId, (project) => ({
      ...project,
      status: "failed",
      events: [...project.events, {
        id: `${runId}:local-failure`,
        sequence: Math.max(0, ...project.events.map((event) => event.sequence)) + 1,
        runId,
        type: "run.failed",
        title: "本地 Agent 运行失败",
        detail: "模型请求失败，请检查密钥权限、模型访问或网络后重试。",
        timestamp: failedAt,
        sanitized: true,
      }],
      updatedAt: failedAt,
    }));
  } finally {
    await executor.close();
  }
}
