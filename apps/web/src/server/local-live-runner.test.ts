import { describe, expect, it, vi } from "vitest";
import type { WorkflowResult } from "@storyforge/agent-core";
import { createProjectFromPrompt } from "@/lib/demo-project";
import { snapshotFromWorkflowResult, validateOpenAIApiKey } from "./local-live-runner";

describe("local live runner", () => {
  it("validates a key without storing or echoing it", async () => {
    const request = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    await expect(validateOpenAIApiKey("test-key-12345678901234567890", request)).resolves.toEqual({ valid: true });
    expect(request).toHaveBeenCalledWith("https://api.openai.com/v1/models", expect.objectContaining({ method: "GET" }));
  });

  it("rejects an invalid key with an actionable error", async () => {
    const request = vi.fn().mockResolvedValue(new Response('{"error":{"message":"Incorrect API key"}}', { status: 401 }));
    await expect(validateOpenAIApiKey("test-key-12345678901234567890", request)).resolves.toEqual({ valid: false, reason: "invalid_api_key" });
  });

  it("projects structured workflow outputs into the visible workspace", () => {
    const base = createProjectFromPrompt("一位制图师绘制会移动的群岛", { durationSeconds: 30 });
    const result: WorkflowResult = {
      status: "completed",
      events: [],
      stageRuns: [],
      usage: { inputTokens: 10, outputTokens: 20, costUsd: 0 },
      outputs: {
        intake: { title: "移动群岛", format: "narrative-short", durationSeconds: 30, aspectRatio: "16:9", contentLanguage: "zh-CN", audience: "大众", goal: "完成地图", assumptions: [] },
        "story-architect": { logline: "群岛在黎明迁徙", theme: "寻找归途", emotionalArc: [], beats: [], worldRules: ["岛屿随潮汐移动"], originalityNotes: [] },
        "art-director": { visualThesis: "墨线与云海", rendering: "3D 渲染 2D", palette: [], materials: [], lighting: "晨光", lensLanguage: "广角", motionGrammar: "缓慢推进", continuityLocks: [] },
        scriptwriter: { scenes: [{ id: "SC-001", start: 0, end: 30, location: "云海", action: "制图师展开地图", dialogue: [], narration: "岛屿再次启航。" }] },
        "asset-director": { assets: [{ id: "CHR-001", name: "制图师", type: "character", priority: "required", prompt: "原创制图师", variants: [], shotPurpose: "主角" }] },
        "audio-director": { musicPolicy: "无配乐", ambience: [], soundEffects: [], dialoguePolicy: "中文" },
        "shot-designer": { shots: [{ id: "SHOT-001", start: 0, end: 30, scene: "云海", purpose: "建立世界", framing: "全景", camera: "推进", action: "制图师观察群岛", sound: "风声", transition: "淡出", assetIds: ["CHR-001"] }] },
        "prompt-engineer": { globalStyleLock: "原创奇幻", negativeConstraints: [], shots: [{ shotId: "SHOT-001", prompt: "云海中的移动群岛", audioPrompt: "风声", continuityLock: "CHR-001" }] },
        "qa-critic": { passed: true, score: 97, repairStages: [], reasons: [], checks: [{ id: "timing", status: "passed", detail: "30 秒闭合" }] },
        packager: { files: [{ name: "project.json", format: "json", required: true }], manifestVersion: "1" },
      },
    };
    const snapshot = snapshotFromWorkflowResult(base, result);
    expect(snapshot.status).toBe("completed");
    expect(snapshot.config.title).toBe("移动群岛");
    expect(snapshot.shots).toMatchObject([{ id: "SHOT-001", prompt: "云海中的移动群岛" }]);
    expect(snapshot.assets).toMatchObject([{ id: "CHR-001", shotIds: ["SHOT-001"] }]);
    expect(snapshot.qa).toMatchObject({ passed: true, score: 97 });
    expect(snapshot.artifacts.map((artifact) => artifact.type)).toEqual(expect.arrayContaining(["brief", "world", "script", "prompts", "qa", "package"]));
  });
});
