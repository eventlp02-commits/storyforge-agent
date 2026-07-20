import {
  assetOutputSchema,
  intakeOutputSchema,
  promptOutputSchema,
  shotOutputSchema,
  type WorkflowResult,
} from "@storyforge/agent-core";
import type { StageName } from "@storyforge/contracts";

type PersistenceContext = { projectId: string; runId: string; userId: string; initialConfig?: Record<string, unknown> };

const artifactSpecs = [
  { type: "brief", title: "创意简报", sourceStage: "intake" },
  { type: "script", title: "完整剧本", sourceStage: "scriptwriter" },
  { type: "audio", title: "声音设计", sourceStage: "audio-director" },
  { type: "prompts", title: "生成提示词包", sourceStage: "prompt-engineer" },
  { type: "qa", title: "质量检查", sourceStage: "qa-critic" },
  { type: "package", title: "制作包清单", sourceStage: "packager" },
] as const;

function common(context: PersistenceContext) {
  return { project_id: context.projectId, run_id: context.runId, user_id: context.userId };
}

function supportedAssetType(type: string): string {
  return ["character", "location", "prop", "creature", "vehicle", "food", "flora", "effect", "graphic", "audio"].includes(type) ? type : "prop";
}

type ArtifactPersistenceRow = ReturnType<typeof common> & {
  type: string;
  title: string;
  version: number;
  status: string;
  source_stage: string;
  content: unknown;
};

export function buildPersistenceRows(result: WorkflowResult, context: PersistenceContext) {
  const executedStages = result.stageRuns.length > 0
    ? new Set(result.stageRuns.map((stageRun) => stageRun.stage))
    : undefined;
  const wasExecuted = (stage: StageName) => executedStages?.has(stage) ?? true;
  const artifacts: ArtifactPersistenceRow[] = artifactSpecs.flatMap((spec) => {
    const content = result.outputs[spec.sourceStage];
    return content === undefined || !wasExecuted(spec.sourceStage) ? [] : [{
      ...common(context),
      type: spec.type,
      title: spec.title,
      version: 1,
      status: "current",
      source_stage: spec.sourceStage,
      content,
    }];
  });
  if (
    (wasExecuted("story-architect") || wasExecuted("art-director"))
    && (result.outputs["story-architect"] !== undefined || result.outputs["art-director"] !== undefined)
  ) {
    artifacts.push({
      ...common(context),
      type: "world",
      title: "世界观与美术圣经",
      version: 1,
      status: "current",
      source_stage: "story-architect",
      content: { story: result.outputs["story-architect"], artDirection: result.outputs["art-director"] },
    });
  }

  const shotOutput = shotOutputSchema.safeParse(result.outputs["shot-designer"]);
  const promptOutput = promptOutputSchema.safeParse(result.outputs["prompt-engineer"]);
  const promptByShot = new Map(promptOutput.success ? promptOutput.data.shots.map((shot) => [shot.shotId, shot.prompt] as const) : []);
  const shots = shotOutput.success && (wasExecuted("shot-designer") || wasExecuted("prompt-engineer")) ? shotOutput.data.shots.map((shot, index) => ({
    ...common(context),
    shot_code: shot.id,
    sort_order: index + 1,
    start_seconds: shot.start,
    end_seconds: shot.end,
    scene: shot.scene,
    purpose: shot.purpose,
    framing: shot.framing,
    camera: shot.camera,
    action: shot.action,
    dialogue: shot.dialogue,
    sound: shot.sound,
    transition: shot.transition,
    asset_ids: shot.assetIds,
    prompt: promptByShot.get(shot.id) ?? "等待提示词阶段",
    generation_status: "ready",
  })) : [];

  const assetOutput = assetOutputSchema.safeParse(result.outputs["asset-director"]);
  const assets = assetOutput.success && wasExecuted("asset-director") ? assetOutput.data.assets.map((asset) => ({
    ...common(context),
    asset_code: asset.id,
    name: asset.name,
    type: supportedAssetType(asset.type),
    status: "prompt-only",
    prompt: asset.prompt,
    shot_codes: shots.filter((shot) => shot.asset_ids.includes(asset.id)).map((shot) => shot.shot_code),
    metadata: { priority: asset.priority, variants: asset.variants, shotPurpose: asset.shotPurpose },
  })) : [];

  const intake = intakeOutputSchema.safeParse(result.outputs.intake);
  return {
    artifacts,
    shots,
    assets,
    inferredConfig: intake.success && wasExecuted("intake") ? {
      ...context.initialConfig,
      durationSeconds: intake.data.durationSeconds,
      aspectRatio: intake.data.aspectRatio,
      contentLanguage: intake.data.contentLanguage,
      format: intake.data.format,
      assumptions: intake.data.assumptions,
    } : undefined,
    title: intake.success && wasExecuted("intake") ? intake.data.title : undefined,
  };
}

type SeedArtifactRow = { type: string; content: unknown };
type SeedShotRow = {
  shot_code: string;
  start_seconds: number | string;
  end_seconds: number | string;
  scene: string;
  purpose: string;
  framing: string;
  camera: string;
  action: string;
  dialogue?: string | null;
  sound: string;
  transition: string;
  asset_ids?: string[] | null;
};
type SeedAssetRow = {
  asset_code: string;
  name: string;
  type: string;
  prompt: string;
  metadata?: unknown;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function seedOutputsFromRows(rows: {
  artifacts: SeedArtifactRow[];
  shots: SeedShotRow[];
  assets: SeedAssetRow[];
}): Partial<Record<StageName, unknown>> {
  const outputs: Partial<Record<StageName, unknown>> = {};
  for (const artifact of rows.artifacts) {
    if (artifact.type === "brief") outputs.intake = artifact.content;
    if (artifact.type === "script") outputs.scriptwriter = artifact.content;
    if (artifact.type === "audio") outputs["audio-director"] = artifact.content;
    if (artifact.type === "prompts") outputs["prompt-engineer"] = artifact.content;
    if (artifact.type === "qa") outputs["qa-critic"] = artifact.content;
    if (artifact.type === "package") outputs.packager = artifact.content;
    if (artifact.type === "world") {
      const world = record(artifact.content);
      if (world.story !== undefined) outputs["story-architect"] = world.story;
      if (world.artDirection !== undefined) outputs["art-director"] = world.artDirection;
    }
  }

  if (rows.shots.length > 0) {
    outputs["shot-designer"] = {
      shots: rows.shots.map((shot) => ({
        id: shot.shot_code,
        start: Number(shot.start_seconds),
        end: Number(shot.end_seconds),
        scene: shot.scene,
        purpose: shot.purpose,
        framing: shot.framing,
        camera: shot.camera,
        action: shot.action,
        ...(shot.dialogue ? { dialogue: shot.dialogue } : {}),
        sound: shot.sound,
        transition: shot.transition,
        assetIds: shot.asset_ids ?? [],
      })),
    };
  }
  if (rows.assets.length > 0) {
    outputs["asset-director"] = {
      assets: rows.assets.map((asset) => {
        const metadata = record(asset.metadata);
        return {
          id: asset.asset_code,
          name: asset.name,
          type: supportedAssetType(asset.type),
          priority: metadata.priority === "recommended" ? "recommended" : "required",
          prompt: asset.prompt,
          variants: Array.isArray(metadata.variants) ? metadata.variants.filter((value): value is string => typeof value === "string") : [],
          shotPurpose: typeof metadata.shotPurpose === "string" ? metadata.shotPurpose : "",
        };
      }),
    };
  }
  return outputs;
}
