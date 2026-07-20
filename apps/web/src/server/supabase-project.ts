import {
  projectSnapshotSchema,
  stageNameSchema,
  type Artifact,
  type Asset,
  type ProjectConfig,
  type ProjectSnapshot,
  type QaReport,
  type RunEvent,
  type RunStatus,
  type Shot,
  type StageName,
  type StageRun,
} from "@storyforge/contracts";
import { createSupabaseServerClient } from "../lib/supabase/server";

const stageOrder: StageName[] = [
  "intake",
  "story-architect",
  "art-director",
  "scriptwriter",
  "asset-director",
  "audio-director",
  "shot-designer",
  "prompt-engineer",
  "qa-critic",
  "packager",
];

type JsonObject = Record<string, unknown>;

export type SupabaseProjectRows = {
  project: {
    id: string; title: string; concept: string; inferred_config: JsonObject; status: RunStatus; current_run_id: string;
    created_at: string; updated_at: string;
  };
  run: { id: string; status: RunStatus; skill_version: string; usage: JsonObject };
  stageRuns: Array<JsonObject & { id: string; stage: string; status: string }>;
  artifacts: Array<JsonObject & { id: string; type: string; version: number; status: string; title: string; content: unknown; created_at: string; source_stage: string }>;
  shots: Array<JsonObject & { id: string; shot_code: string; sort_order: number; start_seconds: number | string; end_seconds: number | string }>;
  assets: Array<JsonObject & { id: string; asset_code: string; name: string; type: string; status: string; prompt: string }>;
  events: Array<JsonObject & { id: string; sequence: number; type: string; title: string; detail: string; sanitized: boolean; created_at: string }>;
};

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function numberValue(value: unknown, fallback = 0): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function assetType(value: string): Asset["type"] {
  const supported: Asset["type"][] = ["character", "location", "prop", "creature", "vehicle", "food", "flora", "effect", "audio", "graphic"];
  return supported.includes(value as Asset["type"]) ? value as Asset["type"] : "prop";
}

function stageStatusFromEvents(stage: StageName, events: SupabaseProjectRows["events"]): StageRun["status"] {
  const latest = events.filter((event) => event.stage === stage).sort((a, b) => b.sequence - a.sequence)[0];
  if (!latest) return "queued";
  if (latest.type === "stage.completed") return "completed";
  if (latest.type === "stage.started") return "running";
  return latest.type.includes("failed") ? "failed" : "queued";
}

function buildQa(artifacts: Artifact[]): QaReport {
  const content = artifacts.find((artifact) => artifact.type === "qa" && artifact.status === "current")?.content as JsonObject | undefined;
  const checks = Array.isArray(content?.checks) ? content.checks.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const check = item as JsonObject;
    const status: QaReport["checks"][number]["status"] = check.status === "passed" || check.status === "warning" || check.status === "failed" ? check.status : "warning";
    return [{ id: stringValue(check.id, "qa"), label: stringValue(check.label, stringValue(check.id, "检查")), status, detail: stringValue(check.detail, "等待检查") }];
  }) : [];
  return {
    score: numberValue(content?.score),
    passed: content?.passed === true,
    autoRepairCount: numberValue(content?.autoRepairCount),
    checks,
  };
}

export function projectSnapshotFromSupabaseRows(rows: SupabaseProjectRows): ProjectSnapshot {
  const inferred = rows.project.inferred_config ?? {};
  const config: ProjectConfig = {
    title: rows.project.title,
    concept: rows.project.concept,
    durationSeconds: numberValue(inferred.durationSeconds, 60),
    aspectRatio: (["16:9", "9:16", "1:1", "4:5", "2.39:1"].includes(String(inferred.aspectRatio)) ? inferred.aspectRatio : "16:9") as ProjectConfig["aspectRatio"],
    contentLanguage: stringValue(inferred.contentLanguage, "zh-CN"),
    visualStyle: stringValue(inferred.visualStyle, "电影化游戏 CG"),
    format: (["narrative-short", "advertisement", "music-video", "promo", "documentary", "explainer", "world-showcase"].includes(String(inferred.format)) ? inferred.format : "narrative-short") as ProjectConfig["format"],
    assumptions: stringArray(inferred.assumptions),
  };

  const persistedStages = new Map(rows.stageRuns.flatMap((row) => {
    const parsedStage = stageNameSchema.safeParse(row.stage);
    return parsedStage.success ? [[parsedStage.data, row] as const] : [];
  }));
  const stageRuns: StageRun[] = stageOrder.map((stage) => {
    const row = persistedStages.get(stage);
    return {
      id: row?.id ?? `${rows.run.id}:${stage}`,
      stage,
      status: row ? row.status as StageRun["status"] : stageStatusFromEvents(stage, rows.events),
      attempt: numberValue(row?.attempt, 1),
      ...(typeof row?.parallel_group === "string" ? { parallelGroup: row.parallel_group } : {}),
      ...(typeof row?.started_at === "string" ? { startedAt: row.started_at } : {}),
      ...(typeof row?.completed_at === "string" ? { completedAt: row.completed_at } : {}),
      durationMs: numberValue(row?.duration_ms),
      inputTokens: numberValue(row?.input_tokens),
      outputTokens: numberValue(row?.output_tokens),
      costUsd: numberValue(row?.cost_usd),
      ...(typeof row?.error_message === "string" ? { error: row.error_message } : {}),
    };
  });

  const artifacts = rows.artifacts.flatMap((row): Artifact[] => {
    const allowedType = ["brief", "world", "script", "audio", "prompts", "qa", "package"] as const;
    const parsedStage = stageNameSchema.safeParse(row.source_stage);
    if (!allowedType.includes(row.type as Artifact["type"]) || !parsedStage.success) return [];
    return [{
      id: row.id,
      type: row.type as Artifact["type"],
      version: row.version,
      status: row.status as Artifact["status"],
      title: row.title,
      content: row.content,
      createdAt: row.created_at,
      sourceStage: parsedStage.data,
    }];
  });

  const shots: Shot[] = rows.shots.sort((a, b) => a.sort_order - b.sort_order).map((row) => ({
    id: row.shot_code,
    order: row.sort_order,
    start: numberValue(row.start_seconds),
    end: numberValue(row.end_seconds),
    scene: stringValue(row.scene, "待定场景"),
    purpose: stringValue(row.purpose, "叙事推进"),
    framing: stringValue(row.framing, "中景"),
    camera: stringValue(row.camera, "固定机位"),
    action: stringValue(row.action, "待补充动作"),
    ...(typeof row.dialogue === "string" && row.dialogue ? { dialogue: row.dialogue } : {}),
    sound: stringValue(row.sound, "环境声"),
    transition: stringValue(row.transition, "硬切"),
    assetIds: stringArray(row.asset_ids),
    prompt: stringValue(row.prompt, "等待提示词阶段"),
    generationStatus: stringValue(row.generation_status, "ready") as Shot["generationStatus"],
    ...(typeof row.media_url === "string" ? { fileUrl: row.media_url } : {}),
    ...(typeof row.provider_job_id === "string" ? { providerJobId: row.provider_job_id } : {}),
    ...(typeof row.media_provider === "string" ? { mediaProvider: row.media_provider } : {}),
  }));

  const assets: Asset[] = rows.assets.map((row) => ({
    id: row.asset_code,
    name: row.name,
    type: assetType(row.type),
    status: row.status as Asset["status"],
    prompt: row.prompt,
    ...(typeof row.storage_path === "string" ? { fileUrl: row.storage_path } : {}),
    ...(typeof row.thumbnail_path === "string" ? { thumbnailUrl: row.thumbnail_path } : {}),
    ...(typeof row.variant_of === "string" ? { variantOf: row.variant_of } : {}),
    shotIds: stringArray(row.shot_codes),
    notes: typeof row.metadata === "object" ? JSON.stringify(row.metadata) : "",
  }));

  const events: RunEvent[] = rows.events.sort((a, b) => a.sequence - b.sequence).map((row) => ({
    id: row.id,
    sequence: row.sequence,
    runId: rows.run.id,
    type: row.type as RunEvent["type"],
    ...(typeof row.stage === "string" && stageNameSchema.safeParse(row.stage).success ? { stage: row.stage as StageName } : {}),
    title: row.title,
    detail: row.detail,
    timestamp: row.created_at,
    sanitized: row.sanitized,
    ...(row.metrics && typeof row.metrics === "object" ? { metrics: row.metrics as RunEvent["metrics"] } : {}),
  }));

  const usage = rows.run.usage ?? {};
  return projectSnapshotSchema.parse({
    id: rows.project.id,
    runId: rows.run.id,
    skillVersion: rows.run.skill_version,
    status: rows.run.status,
    config,
    stageRuns,
    artifacts,
    shots,
    assets,
    events,
    qa: buildQa(artifacts),
    usage: {
      tokens: numberValue(usage.tokens),
      costUsd: numberValue(usage.costUsd),
      images: numberValue(usage.images),
      videoSeconds: numberValue(usage.videoSeconds),
    },
    createdAt: rows.project.created_at,
    updatedAt: rows.project.updated_at,
  });
}

export async function loadSupabaseProject(projectId: string): Promise<ProjectSnapshot | undefined> {
  const supabase = await createSupabaseServerClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) return undefined;
  const { data: project, error: projectError } = await supabase.from("projects").select("*").eq("id", projectId).eq("user_id", userId).maybeSingle();
  if (projectError || !project?.current_run_id) return undefined;
  const { data: run, error: runError } = await supabase.from("runs").select("*").eq("id", project.current_run_id).eq("user_id", userId).maybeSingle();
  if (runError || !run) return undefined;
  const [stageRuns, artifacts, shots, assets, events] = await Promise.all([
    supabase.from("stage_runs").select("*").eq("run_id", run.id).eq("user_id", userId).order("created_at"),
    supabase.from("artifacts").select("*").eq("run_id", run.id).eq("user_id", userId).order("version"),
    supabase.from("shots").select("*").eq("run_id", run.id).eq("user_id", userId).order("sort_order"),
    supabase.from("assets").select("*").eq("run_id", run.id).eq("user_id", userId).order("asset_code"),
    supabase.from("run_events").select("*").eq("run_id", run.id).eq("user_id", userId).order("sequence"),
  ]);
  if (stageRuns.error || artifacts.error || shots.error || assets.error || events.error) throw new Error("Live project rows could not be loaded");
  const signedAssets = await Promise.all((assets.data ?? []).map(async (asset) => {
    if (!asset.storage_path) return asset;
    const { data } = await supabase.storage.from("storyforge-assets").createSignedUrl(asset.storage_path, 3600);
    return data?.signedUrl ? { ...asset, storage_path: data.signedUrl, thumbnail_path: data.signedUrl } : asset;
  }));
  return projectSnapshotFromSupabaseRows({
    project,
    run,
    stageRuns: stageRuns.data ?? [],
    artifacts: artifacts.data ?? [],
    shots: shots.data ?? [],
    assets: signedAssets,
    events: events.data ?? [],
  } as SupabaseProjectRows);
}
