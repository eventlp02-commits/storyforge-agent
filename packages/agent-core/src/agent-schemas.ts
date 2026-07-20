import { z } from "zod";
import { stageNameSchema } from "@storyforge/contracts";

const assumptions = z.array(z.string()).max(20);

export const intakeOutputSchema = z.object({
  title: z.string(),
  format: z.enum(["narrative-short", "advertisement", "music-video", "promo", "documentary", "explainer", "world-showcase"]),
  durationSeconds: z.number().positive(),
  aspectRatio: z.enum(["16:9", "9:16", "1:1", "4:5", "2.39:1"]),
  contentLanguage: z.string(),
  audience: z.string(),
  goal: z.string(),
  assumptions,
});

export const storyOutputSchema = z.object({
  logline: z.string(),
  theme: z.string(),
  emotionalArc: z.array(z.string()),
  beats: z.array(z.object({ start: z.number(), end: z.number(), purpose: z.string(), event: z.string() })),
  worldRules: z.array(z.string()),
  originalityNotes: z.array(z.string()),
});

export const artOutputSchema = z.object({
  visualThesis: z.string(),
  rendering: z.string(),
  palette: z.array(z.string()),
  materials: z.array(z.string()),
  lighting: z.string(),
  lensLanguage: z.string(),
  motionGrammar: z.string(),
  continuityLocks: z.array(z.string()),
});

export const scriptOutputSchema = z.object({
  scenes: z.array(z.object({ id: z.string(), start: z.number(), end: z.number(), location: z.string(), action: z.string(), dialogue: z.array(z.object({ speaker: z.string(), line: z.string() })), narration: z.string().optional() })),
  titleCard: z.string().optional(),
});

export const assetOutputSchema = z.object({
  assets: z.array(z.object({ id: z.string(), name: z.string(), type: z.string(), priority: z.enum(["required", "recommended", "optional"]), prompt: z.string(), variants: z.array(z.string()), shotPurpose: z.string() })),
});

export const audioOutputSchema = z.object({
  musicPolicy: z.string(),
  ambience: z.array(z.object({ timeRange: z.string(), description: z.string() })),
  soundEffects: z.array(z.object({ timeRange: z.string(), description: z.string(), priority: z.string() })),
  dialoguePolicy: z.string(),
});

export const shotOutputSchema = z.object({
  shots: z.array(z.object({
    id: z.string(),
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
  })),
});

export const promptOutputSchema = z.object({
  globalStyleLock: z.string(),
  negativeConstraints: z.array(z.string()),
  shots: z.array(z.object({ shotId: z.string(), prompt: z.string(), audioPrompt: z.string(), continuityLock: z.string() })),
});

export const qaOutputSchema = z.object({
  passed: z.boolean(),
  score: z.number().min(0).max(100),
  repairStages: z.array(stageNameSchema),
  reasons: z.array(z.string()),
  checks: z.array(z.object({ id: z.string(), status: z.enum(["passed", "warning", "failed"]), detail: z.string() })),
});

export const packageOutputSchema = z.object({
  files: z.array(z.object({ name: z.string(), format: z.string(), required: z.boolean() })),
  manifestVersion: z.string(),
});

export const stageOutputSchemas = {
  intake: intakeOutputSchema,
  "story-architect": storyOutputSchema,
  "art-director": artOutputSchema,
  scriptwriter: scriptOutputSchema,
  "asset-director": assetOutputSchema,
  "audio-director": audioOutputSchema,
  "shot-designer": shotOutputSchema,
  "prompt-engineer": promptOutputSchema,
  "qa-critic": qaOutputSchema,
  packager: packageOutputSchema,
} satisfies Record<string, z.ZodType>;
