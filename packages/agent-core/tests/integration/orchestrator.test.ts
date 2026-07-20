import { describe, expect, it } from "vitest";
import { runStoryForgeWorkflow, type StageExecutor } from "../../src/workflow";

describe("StoryForge orchestrator", () => {
  it("runs fixed parallel groups and repairs QA no more than twice", async () => {
    let concurrent = 0;
    let maxConcurrent = 0;
    let qaCalls = 0;
    const executor: StageExecutor = {
      async execute(stage) {
        concurrent += 1;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await new Promise((resolve) => setTimeout(resolve, 2));
        concurrent -= 1;
        if (stage === "qa-critic") {
          qaCalls += 1;
          return { output: { passed: qaCalls > 1, score: qaCalls > 1 ? 95 : 68, repairStages: qaCalls > 1 ? [] : ["prompt-engineer"], reasons: [] }, usage: { inputTokens: 10, outputTokens: 10, costUsd: 0 } };
        }
        return { output: { stage, ok: true }, usage: { inputTokens: 10, outputTokens: 10, costUsd: 0 } };
      },
    };

    const result = await runStoryForgeWorkflow({ concept: "一座浮岛正在寻找失落的影子", runId: "run-test" }, executor);
    expect(result.status).toBe("completed");
    expect(maxConcurrent).toBe(2);
    expect(qaCalls).toBe(2);
    expect(result.stageRuns.filter((stage) => stage.stage === "qa-critic")).toHaveLength(2);
    expect(result.events.every((event) => event.sanitized)).toBe(true);
  });

  it("waits between stages while a persisted run is paused", async () => {
    let control: "run" | "pause" | "cancel" = "pause";
    let executions = 0;
    const executor: StageExecutor = {
      async execute(stage) {
        executions += 1;
        return {
          output: stage === "qa-critic" ? { passed: true, score: 95, repairStages: [], reasons: [] } : { stage },
          usage: { inputTokens: 1, outputTokens: 1, costUsd: 0 },
        };
      },
    };

    const pending = runStoryForgeWorkflow({
      concept: "暂停中的天空列车",
      runId: "run-paused",
      control: async () => control,
      controlPollMs: 2,
    }, executor);
    await new Promise((resolve) => setTimeout(resolve, 8));
    expect(executions).toBe(0);
    control = "run";
    const result = await pending;
    expect(result.status).toBe("completed");
    expect(executions).toBeGreaterThan(0);
  });

  it("pauses the DAG when a stage would exhaust the configured budget", async () => {
    let executions = 0;
    const executor: StageExecutor = {
      async execute(stage) {
        executions += 1;
        return {
          output: stage === "qa-critic" ? { passed: true, score: 95, repairStages: [], reasons: [] } : { stage },
          usage: { inputTokens: 10, outputTokens: 10, costUsd: 0.01 },
        };
      },
    };
    const result = await runStoryForgeWorkflow({
      concept: "预算受控的短片",
      runId: "run-budget",
      budget: { maxTokens: 15, maxCostUsd: 1, maxImages: 0, maxVideoSeconds: 0 },
    }, executor);

    expect(result.status).toBe("paused");
    expect(executions).toBe(1);
    expect(result.events.some((event) => event.type === "budget.warning")).toBe(true);
  });

  it("rejects a model QA pass when deterministic timing does not close", async () => {
    let qaCalls = 0;
    let packagerCalls = 0;
    const executor: StageExecutor = {
      async execute(stage) {
        if (stage === "intake") return { output: { title: "测试", format: "narrative-short", durationSeconds: 30, aspectRatio: "16:9", contentLanguage: "zh-CN", audience: "大众", goal: "测试", assumptions: [] }, usage: { inputTokens: 1, outputTokens: 1, costUsd: 0 } };
        if (stage === "asset-director") return { output: { assets: [] }, usage: { inputTokens: 1, outputTokens: 1, costUsd: 0 } };
        if (stage === "shot-designer") return { output: { shots: [{ id: "SHOT-001", start: 0, end: 20, scene: "测试", purpose: "测试", framing: "全景", camera: "固定", action: "动作", sound: "环境声", transition: "淡出", assetIds: [] }] }, usage: { inputTokens: 1, outputTokens: 1, costUsd: 0 } };
        if (stage === "prompt-engineer") return { output: { globalStyleLock: "原创", negativeConstraints: [], shots: [{ shotId: "SHOT-001", prompt: "测试", audioPrompt: "环境声", continuityLock: "" }] }, usage: { inputTokens: 1, outputTokens: 1, costUsd: 0 } };
        if (stage === "qa-critic") {
          qaCalls += 1;
          return { output: { passed: true, score: 99, repairStages: [], reasons: [], checks: [] }, usage: { inputTokens: 1, outputTokens: 1, costUsd: 0 } };
        }
        if (stage === "packager") packagerCalls += 1;
        return { output: { stage }, usage: { inputTokens: 1, outputTokens: 1, costUsd: 0 } };
      },
    };

    const result = await runStoryForgeWorkflow({ concept: "时间错误测试", runId: "run-timing" }, executor);
    expect(result.status).toBe("failed");
    expect(qaCalls).toBe(3);
    expect(packagerCalls).toBe(0);
  });

  it("reuses versioned upstream outputs when retrying from one stage", async () => {
    const calls: string[] = [];
    const executor: StageExecutor = {
      async execute(stage) {
        calls.push(stage);
        if (stage === "shot-designer") return { output: { shots: [{ id: "SHOT-001", start: 0, end: 30, scene: "测试", purpose: "测试", framing: "全景", camera: "固定", action: "动作", sound: "环境声", transition: "淡出", assetIds: [] }] }, usage: { inputTokens: 1, outputTokens: 1, costUsd: 0 } };
        if (stage === "prompt-engineer") return { output: { globalStyleLock: "原创", negativeConstraints: [], shots: [{ shotId: "SHOT-001", prompt: "测试", audioPrompt: "环境声", continuityLock: "" }] }, usage: { inputTokens: 1, outputTokens: 1, costUsd: 0 } };
        if (stage === "qa-critic") return { output: { passed: true, score: 95, repairStages: [], reasons: [], checks: [] }, usage: { inputTokens: 1, outputTokens: 1, costUsd: 0 } };
        return { output: { stage }, usage: { inputTokens: 1, outputTokens: 1, costUsd: 0 } };
      },
    };
    const result = await runStoryForgeWorkflow({
      concept: "局部重跑",
      runId: "run-partial",
      startStage: "shot-designer",
      startAttempt: 2,
      seedOutputs: {
        intake: { title: "测试", format: "narrative-short", durationSeconds: 30, aspectRatio: "16:9", contentLanguage: "zh-CN", audience: "大众", goal: "测试", assumptions: [] },
        "story-architect": { ready: true },
        "art-director": { ready: true },
        scriptwriter: { ready: true },
        "asset-director": { assets: [] },
        "audio-director": { ready: true },
      },
    }, executor);

    expect(result.status).toBe("completed");
    expect(calls).toEqual(["shot-designer", "prompt-engineer", "qa-critic", "packager"]);
    expect(result.stageRuns.every((stage) => stage.attempt === 2)).toBe(true);
  });
});
