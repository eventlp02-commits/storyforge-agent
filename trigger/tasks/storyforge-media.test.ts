import { describe, expect, it, vi } from "vitest";
import type { ImageProvider } from "@storyforge/agent-core";
import { generatePlannedImages } from "./storyforge-media";

describe("StoryForge media execution", () => {
  it("stops before unstarted image jobs and preserves the completed result", async () => {
    const generate = vi.fn().mockResolvedValue({ status: "done", provider: "fixture", dataUrl: "data:image/png;base64,AA==" });
    const provider: ImageProvider = { generate };
    let stopped = false;
    const completed: string[] = [];

    const result = await generatePlannedImages({
      assets: [
        { assetCode: "CHAR-001", prompt: "原创角色", priority: "required" },
        { assetCode: "LOC-001", prompt: "原创城市", priority: "recommended" },
      ],
      aspectRatio: "16:9",
      limit: 2,
      provider,
      isStopped: async () => stopped,
      onStarted: async () => undefined,
      onDone: async (asset) => { completed.push(asset.assetCode); stopped = true; },
      onDeferred: async () => undefined,
    });

    expect(generate).toHaveBeenCalledTimes(1);
    expect(completed).toEqual(["CHAR-001"]);
    expect(result).toEqual({ completed: 1, deferred: 0, stopped: true });
  });

  it("defers provider failures without failing the text production package", async () => {
    const provider: ImageProvider = { generate: vi.fn().mockRejectedValue(new Error("provider unavailable")) };
    const deferred: string[] = [];
    const result = await generatePlannedImages({
      assets: [{ assetCode: "PROP-001", prompt: "原创道具", priority: "required" }],
      aspectRatio: "9:16",
      limit: 1,
      provider,
      isStopped: async () => false,
      onStarted: async () => undefined,
      onDone: async () => undefined,
      onDeferred: async (asset) => { deferred.push(asset.assetCode); },
    });
    expect(deferred).toEqual(["PROP-001"]);
    expect(result).toEqual({ completed: 0, deferred: 1, stopped: false });
  });
});
