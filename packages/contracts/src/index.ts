import { z } from "zod";

export const runStatusSchema = z.enum([
  "queued",
  "running",
  "paused",
  "completed",
  "failed",
  "cancelled",
]);

export const stageStatusSchema = z.enum([
  "queued",
  "running",
  "waiting",
  "completed",
  "failed",
  "skipped",
  "cancelled",
]);

export const assetStatusSchema = z.enum([
  "planned",
  "prompt-only",
  "generating",
  "done",
  "deferred",
  "cancelled",
]);

export const stageNameSchema = z.enum([
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
]);

export const projectConfigSchema = z.object({
  title: z.string().min(1),
  concept: z.string().min(1),
  durationSeconds: z.number().positive(),
  aspectRatio: z.enum(["16:9", "9:16", "1:1", "4:5", "2.39:1"]),
  contentLanguage: z.string().min(2),
  visualStyle: z.string().min(1),
  format: z.enum(["narrative-short", "advertisement", "music-video", "promo", "documentary", "explainer", "world-showcase"]),
  assumptions: z.array(z.string()),
});

export const stageRunSchema = z.object({
  id: z.string(),
  stage: stageNameSchema,
  status: stageStatusSchema,
  attempt: z.number().int().positive(),
  parallelGroup: z.string().optional(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  durationMs: z.number().nonnegative().default(0),
  inputTokens: z.number().int().nonnegative().default(0),
  outputTokens: z.number().int().nonnegative().default(0),
  costUsd: z.number().nonnegative().default(0),
  error: z.string().optional(),
});

export const artifactSchema = z.object({
  id: z.string(),
  type: z.enum(["brief", "world", "script", "audio", "prompts", "qa", "package"]),
  version: z.number().int().positive(),
  status: z.enum(["current", "stale", "archived"]),
  title: z.string(),
  content: z.unknown(),
  createdAt: z.string(),
  sourceStage: stageNameSchema,
});

export const shotSchema = z.object({
  id: z.string(),
  order: z.number().int().positive(),
  start: z.number().nonnegative(),
  end: z.number().positive(),
  scene: z.string(),
  purpose: z.string(),
  framing: z.string(),
  camera: z.string(),
  action: z.string(),
  dialogue: z.string().optional(),
  sound: z.string(),
  transition: z.string(),
  assetIds: z.array(z.string()),
  prompt: z.string(),
  generationStatus: z.enum(["ready", "generating", "done", "deferred"]),
});

export const assetSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["character", "location", "prop", "creature", "vehicle", "food", "flora", "effect", "graphic", "audio"]),
  status: assetStatusSchema,
  prompt: z.string(),
  fileUrl: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  variantOf: z.string().optional(),
  shotIds: z.array(z.string()),
  notes: z.string().optional(),
});

export const runEventSchema = z.object({
  id: z.string(),
  sequence: z.number().int().positive(),
  runId: z.string(),
  type: z.enum([
    "run.started",
    "run.paused",
    "run.resumed",
    "run.completed",
    "run.failed",
    "run.cancelled",
    "stage.queued",
    "stage.started",
    "stage.progress",
    "stage.completed",
    "stage.failed",
    "artifact.updated",
    "tool.called",
    "budget.warning",
  ]),
  stage: stageNameSchema.optional(),
  title: z.string(),
  detail: z.string(),
  timestamp: z.string(),
  sanitized: z.boolean().default(true),
  metrics: z.object({
    durationMs: z.number().nonnegative().optional(),
    tokens: z.number().int().nonnegative().optional(),
    costUsd: z.number().nonnegative().optional(),
  }).optional(),
});

export const qaReportSchema = z.object({
  score: z.number().min(0).max(100),
  passed: z.boolean(),
  checks: z.array(z.object({
    id: z.string(),
    label: z.string(),
    status: z.enum(["passed", "warning", "failed"]),
    detail: z.string(),
  })),
  autoRepairCount: z.number().int().min(0).max(2),
});

export const projectSnapshotSchema = z.object({
  id: z.string(),
  runId: z.string(),
  skillVersion: z.string(),
  status: runStatusSchema,
  config: projectConfigSchema,
  stageRuns: z.array(stageRunSchema),
  artifacts: z.array(artifactSchema),
  shots: z.array(shotSchema),
  assets: z.array(assetSchema),
  events: z.array(runEventSchema),
  qa: qaReportSchema,
  usage: z.object({
    tokens: z.number().int().nonnegative(),
    costUsd: z.number().nonnegative(),
    images: z.number().int().nonnegative(),
    videoSeconds: z.number().nonnegative(),
  }),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type RunStatus = z.infer<typeof runStatusSchema>;
export type StageStatus = z.infer<typeof stageStatusSchema>;
export type AssetStatus = z.infer<typeof assetStatusSchema>;
export type StageName = z.infer<typeof stageNameSchema>;
export type ProjectConfig = z.infer<typeof projectConfigSchema>;
export type StageRun = z.infer<typeof stageRunSchema>;
export type Artifact = z.infer<typeof artifactSchema>;
export type Shot = z.infer<typeof shotSchema>;
export type Asset = z.infer<typeof assetSchema>;
export type RunEvent = z.infer<typeof runEventSchema>;
export type QaReport = z.infer<typeof qaReportSchema>;
export type ProjectSnapshot = z.infer<typeof projectSnapshotSchema>;
