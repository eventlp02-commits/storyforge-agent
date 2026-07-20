import type { AspectRatio, ImageGenerationResult, ImageProvider, VideoGenerationResult, VideoProvider } from "@storyforge/agent-core";

export type PlannedImageAsset = {
  assetCode: string;
  prompt: string;
  priority: "required" | "recommended";
};

export async function generatePlannedImages(input: {
  assets: PlannedImageAsset[];
  aspectRatio: AspectRatio;
  limit: number;
  provider: ImageProvider;
  isStopped: () => Promise<boolean>;
  onStarted: (asset: PlannedImageAsset) => Promise<void>;
  onDone: (asset: PlannedImageAsset, result: ImageGenerationResult) => Promise<void>;
  onQueued?: (asset: PlannedImageAsset, result: ImageGenerationResult) => Promise<void>;
  onDeferred: (asset: PlannedImageAsset) => Promise<void>;
}) {
  const assets = [...input.assets]
    .sort((left, right) => Number(right.priority === "required") - Number(left.priority === "required"))
    .slice(0, Math.max(0, input.limit));
  let completed = 0;
  let deferred = 0;
  let queued = 0;
  let stopped = false;

  for (const asset of assets) {
    if (await input.isStopped()) {
      stopped = true;
      break;
    }
    await input.onStarted(asset);
    try {
      const result = await input.provider.generate({ prompt: asset.prompt, aspectRatio: input.aspectRatio });
      if (result.status === "done" && (result.dataUrl || result.url)) {
        await input.onDone(asset, result);
        completed += 1;
      } else if (result.status === "queued" && result.jobId) {
        await input.onQueued?.(asset, result);
        queued += 1;
      } else {
        await input.onDeferred(asset);
        deferred += 1;
      }
    } catch {
      await input.onDeferred(asset);
      deferred += 1;
    }
  }
  return { completed, deferred, ...(queued > 0 ? { queued } : {}), stopped };
}

export type PlannedVideoShot = {
  shotCode: string;
  prompt: string;
  durationSeconds: number;
};

export async function generatePlannedVideos(input: {
  shots: PlannedVideoShot[];
  aspectRatio: AspectRatio;
  secondsLimit: number;
  provider: VideoProvider;
  isStopped: () => Promise<boolean>;
  onStarted: (shot: PlannedVideoShot) => Promise<void>;
  onDone: (shot: PlannedVideoShot, result: VideoGenerationResult) => Promise<void>;
  onQueued: (shot: PlannedVideoShot, result: VideoGenerationResult) => Promise<void>;
  onDeferred: (shot: PlannedVideoShot) => Promise<void>;
}) {
  let usedSeconds = 0;
  let completedSeconds = 0;
  let queuedSeconds = 0;
  let deferredSeconds = 0;
  let stopped = false;
  for (const shot of input.shots) {
    if (usedSeconds + shot.durationSeconds > input.secondsLimit) break;
    if (await input.isStopped()) {
      stopped = true;
      break;
    }
    usedSeconds += shot.durationSeconds;
    await input.onStarted(shot);
    try {
      const result = await input.provider.generate({
        prompt: shot.prompt,
        durationSeconds: shot.durationSeconds,
        aspectRatio: input.aspectRatio,
      });
      if (result.status === "done") {
        await input.onDone(shot, result);
        completedSeconds += shot.durationSeconds;
      } else if (result.status === "queued" && result.jobId) {
        await input.onQueued(shot, result);
        queuedSeconds += shot.durationSeconds;
      } else {
        await input.onDeferred(shot);
        deferredSeconds += shot.durationSeconds;
      }
    } catch {
      await input.onDeferred(shot);
      deferredSeconds += shot.durationSeconds;
    }
  }
  return { completedSeconds, queuedSeconds, deferredSeconds, stopped };
}
