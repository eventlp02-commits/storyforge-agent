import { describe, expect, it } from "vitest";
import type { WorkflowResult } from "@storyforge/agent-core";
import { buildPersistenceRows, seedOutputsFromRows } from "./storyforge-persistence";

describe("StoryForge persistence mapping", () => {
  it("writes typed artifacts, linked assets and prompt-complete shots", () => {
    const result: WorkflowResult = {
      status: "completed",
      stageRuns: [],
      events: [],
      usage: { inputTokens: 1, outputTokens: 2, costUsd: 0 },
      outputs: {
        intake: { title: "浮空信使", format: "narrative-short", durationSeconds: 30, aspectRatio: "16:9", contentLanguage: "zh-CN", audience: "大众", goal: "叙事", assumptions: [] },
        "story-architect": { logline: "", theme: "", emotionalArc: [], beats: [], worldRules: [], originalityNotes: [] },
        "art-director": { visualThesis: "", rendering: "", palette: [], materials: [], lighting: "", lensLanguage: "", motionGrammar: "", continuityLocks: [] },
        "asset-director": { assets: [{ id: "VEH-001", name: "星帆车", type: "vehicle", priority: "required", prompt: "原创飞行载具", variants: [], shotPurpose: "启航" }] },
        "shot-designer": { shots: [{ id: "SHOT-001", start: 0, end: 30, scene: "浮空港", purpose: "建立世界", framing: "大全景", camera: "推进", action: "信使启航", sound: "风", transition: "淡入", assetIds: ["VEH-001"] }] },
        "prompt-engineer": { globalStyleLock: "原创奇幻", negativeConstraints: [], shots: [{ shotId: "SHOT-001", prompt: "浮空港中的星帆车", audioPrompt: "风声", continuityLock: "VEH-001" }] },
        "qa-critic": { passed: true, score: 98, repairStages: [], reasons: [], checks: [] },
        packager: { files: [], manifestVersion: "1" },
      },
    };

    const rows = buildPersistenceRows(result, { projectId: "project", runId: "run", userId: "user" });
    expect(rows.artifacts.map((artifact) => artifact.type)).toEqual(expect.arrayContaining(["brief", "world", "prompts", "qa", "package"]));
    expect(rows.shots[0]).toMatchObject({ shot_code: "SHOT-001", prompt: "浮空港中的星帆车", asset_ids: ["VEH-001"] });
    expect(rows.assets[0]).toMatchObject({ asset_code: "VEH-001", status: "prompt-only", shot_codes: ["SHOT-001"] });
  });

  it("rebuilds upstream structured outputs for a targeted retry", () => {
    const outputs = seedOutputsFromRows({
      artifacts: [
        { type: "brief", content: { title: "测试" } },
        { type: "world", content: { story: { logline: "世界" }, artDirection: { visualThesis: "视觉" } } },
        { type: "script", content: { scenes: [] } },
        { type: "audio", content: { musicPolicy: "无" } },
      ],
      shots: [{ shot_code: "SHOT-001", start_seconds: 0, end_seconds: 30, scene: "浮空港", purpose: "建立", framing: "全景", camera: "推进", action: "启航", dialogue: null, sound: "风", transition: "淡入", asset_ids: ["VEH-001"] }],
      assets: [{ asset_code: "VEH-001", name: "星帆车", type: "vehicle", prompt: "原创载具", metadata: { priority: "required", variants: [], shotPurpose: "启航" } }],
    });

    expect(outputs.intake).toEqual({ title: "测试" });
    expect(outputs["story-architect"]).toEqual({ logline: "世界" });
    expect(outputs["art-director"]).toEqual({ visualThesis: "视觉" });
    expect(outputs["shot-designer"]).toMatchObject({ shots: [{ id: "SHOT-001", assetIds: ["VEH-001"] }] });
    expect(outputs["asset-director"]).toMatchObject({ assets: [{ id: "VEH-001", priority: "required" }] });
  });
});
