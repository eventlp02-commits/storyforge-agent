import type { AssetStatus, RunStatus, StageName } from "@storyforge/contracts";

export type RunAction = "pause" | "resume" | "cancel";

const transitions: Record<RunAction, Partial<Record<RunStatus, RunStatus>>> = {
  pause: { queued: "paused", running: "paused" },
  resume: { paused: "running" },
  cancel: { queued: "cancelled", running: "cancelled", paused: "cancelled" },
};

export function applyRunAction(status: RunStatus, action: RunAction): RunStatus {
  const next = transitions[action][status];
  if (!next) {
    throw new Error(`Cannot ${action} a ${status} run`);
  }
  return next;
}

export const stageOrder: StageName[] = [
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

const downstreamByStage: Record<StageName, StageName[]> = {
  intake: stageOrder.slice(1),
  "story-architect": ["scriptwriter", "asset-director", "audio-director", "shot-designer", "prompt-engineer", "qa-critic", "packager"],
  "art-director": ["scriptwriter", "asset-director", "audio-director", "shot-designer", "prompt-engineer", "qa-critic", "packager"],
  scriptwriter: ["asset-director", "audio-director", "shot-designer", "prompt-engineer", "qa-critic", "packager"],
  "asset-director": ["shot-designer", "prompt-engineer", "qa-critic", "packager"],
  "audio-director": ["shot-designer", "prompt-engineer", "qa-critic", "packager"],
  "shot-designer": ["prompt-engineer", "qa-critic", "packager"],
  "prompt-engineer": ["qa-critic", "packager"],
  "qa-critic": ["packager"],
  packager: [],
};

export function invalidateDownstream(stage: StageName): StageName[] {
  return [...downstreamByStage[stage]];
}

export function stopMediaGeneration<T extends { status: AssetStatus }>(assets: T[]): T[] {
  return assets.map((asset) => {
    if (asset.status === "done" || asset.status === "cancelled") return asset;
    return { ...asset, status: "prompt-only" as const };
  });
}
