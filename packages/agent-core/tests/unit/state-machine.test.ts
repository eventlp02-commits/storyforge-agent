import { describe, expect, it } from "vitest";
import { applyRunAction, invalidateDownstream, stopMediaGeneration } from "../../src/state-machine";

describe("run state machine", () => {
  it("supports pause, resume and cancel without losing completed stages", () => {
    expect(applyRunAction("running", "pause")).toBe("paused");
    expect(applyRunAction("paused", "resume")).toBe("running");
    expect(applyRunAction("running", "cancel")).toBe("cancelled");
    expect(() => applyRunAction("completed", "resume")).toThrow();
  });

  it("marks only downstream artifacts stale", () => {
    expect(invalidateDownstream("scriptwriter")).toEqual([
      "asset-director",
      "audio-director",
      "shot-designer",
      "prompt-engineer",
      "qa-critic",
      "packager",
    ]);
  });

  it("converts unfinished media to prompt-only", () => {
    const assets = stopMediaGeneration([
      { id: "AST-1", status: "done" },
      { id: "AST-2", status: "generating" },
      { id: "AST-3", status: "planned" },
    ]);
    expect(assets.map((asset) => asset.status)).toEqual(["done", "prompt-only", "prompt-only"]);
  });
});
