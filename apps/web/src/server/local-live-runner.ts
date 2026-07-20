import {
  OpenAIStageExecutor,
  assetOutputSchema,
  getSkillVersion,
  intakeOutputSchema,
  promptOutputSchema,
  qaOutputSchema,
  runStoryForgeWorkflow,
  shotOutputSchema,
  type WorkflowResult,
} from "@storyforge/agent-core";
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
  try {
    const response = await request("https://api.openai.com/v1/models", {
      method: "GET",
      headers: { authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (response.status === 401 || response.status === 403) return { valid: false as const, reason: "invalid_api_key" as const };
    if (!response.ok && response.status !== 429) return { valid: false as const, reason: "provider_unavailable" as const };
    return { valid: true as const };
  } catch {
    return { valid: false as const, reason: "connection_failed" as const };
  }
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
    events: result.events,
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

export async function runLocalStoryForge(runId: string, apiKey: string) {
  const base = projectRepository.getProjectByRun(runId);
  if (!base) throw new Error("Local run not found");
  const executor = new OpenAIStageExecutor({ apiKey });
  projectRepository.updateRun(runId, (project) => ({ ...project, status: "running", updatedAt: new Date().toISOString() }));
  try {
    const result = await runStoryForgeWorkflow({
      concept: base.config.concept,
      runId,
      projectConfig: base.config,
      budget: { maxTokens: 120_000, maxCostUsd: 20, maxImages: 0, maxVideoSeconds: 0 },
      onEvent: (event) => { projectRepository.updateRun(runId, (project) => applyEvent(project, event)); },
    }, executor);
    projectRepository.updateRun(runId, (project) => snapshotFromWorkflowResult(project, result));
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
