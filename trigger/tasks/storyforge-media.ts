import type { AspectRatio, ImageGenerationResult, ImageProvider } from "@storyforge/agent-core";

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
  onDeferred: (asset: PlannedImageAsset) => Promise<void>;
}) {
  const assets = [...input.assets]
    .sort((left, right) => Number(right.priority === "required") - Number(left.priority === "required"))
    .slice(0, Math.max(0, input.limit));
  let completed = 0;
  let deferred = 0;
  let stopped = false;

  for (const asset of assets) {
    if (await input.isStopped()) {
      stopped = true;
      break;
    }
    await input.onStarted(asset);
    try {
      const result = await input.provider.generate({ prompt: asset.prompt, aspectRatio: input.aspectRatio });
      if (result.status === "done" && result.dataUrl) {
        await input.onDone(asset, result);
        completed += 1;
      } else {
        await input.onDeferred(asset);
        deferred += 1;
      }
    } catch {
      await input.onDeferred(asset);
      deferred += 1;
    }
  }
  return { completed, deferred, stopped };
}
