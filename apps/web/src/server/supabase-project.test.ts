import { describe, expect, it } from "vitest";
import { projectSnapshotSchema } from "@storyforge/contracts";
import { projectSnapshotFromSupabaseRows } from "./supabase-project";

describe("Supabase project projection", () => {
  it("reconstructs a valid live workspace and derives in-flight stage status from events", () => {
    const snapshot = projectSnapshotFromSupabaseRows({
      project: {
        id: "26b87eeb-f56c-490a-a567-58d5dc25893d",
        title: "浮空信使",
        concept: "一名信使穿越浮空群岛送出和平种子",
        inferred_config: { durationSeconds: 60, aspectRatio: "16:9", contentLanguage: "zh-CN", visualStyle: "电影化游戏 CG", assumptions: ["未指定时长"] },
        status: "running",
        current_run_id: "8b31e160-8bc5-45fd-a790-dd9edb4bf476",
        created_at: "2026-07-20T00:00:00.000Z",
        updated_at: "2026-07-20T00:00:02.000Z",
      },
      run: {
        id: "8b31e160-8bc5-45fd-a790-dd9edb4bf476",
        status: "running",
        skill_version: "sha256:test",
        usage: { tokens: 80, costUsd: 0.01, images: 0, videoSeconds: 0 },
      },
      stageRuns: [],
      artifacts: [],
      shots: [{
        id: "shot-row-1", shot_code: "SHOT-001", sort_order: 1, start_seconds: 0, end_seconds: 60,
        scene: "浮空港", framing: "大全景", camera: "向前推进", action: "信使启航", dialogue: null,
        sound: "风帆与港口声", transition: "淡入", asset_ids: ["VEH-001"], prompt: "原创浮空港", generation_status: "ready",
      }],
      assets: [{
        id: "asset-row-1", asset_code: "VEH-001", name: "星帆车", type: "vehicle", status: "prompt-only",
        prompt: "原创飞行载具", storage_path: null, thumbnail_path: null, variant_of: null, shot_codes: ["SHOT-001"], metadata: {},
      }],
      events: [
        { id: "event-1", sequence: 1, type: "stage.started", stage: "intake", title: "开始", detail: "", metrics: null, sanitized: true, created_at: "2026-07-20T00:00:00.000Z" },
        { id: "event-2", sequence: 2, type: "stage.completed", stage: "intake", title: "完成", detail: "", metrics: null, sanitized: true, created_at: "2026-07-20T00:00:01.000Z" },
        { id: "event-3", sequence: 3, type: "stage.started", stage: "story-architect", title: "开始", detail: "", metrics: null, sanitized: true, created_at: "2026-07-20T00:00:02.000Z" },
      ],
    });

    expect(projectSnapshotSchema.safeParse(snapshot).success).toBe(true);
    expect(snapshot.stageRuns).toHaveLength(10);
    expect(snapshot.stageRuns.find((stage) => stage.stage === "intake")?.status).toBe("completed");
    expect(snapshot.stageRuns.find((stage) => stage.stage === "story-architect")?.status).toBe("running");
    expect(snapshot.shots[0]?.assetIds).toEqual(["VEH-001"]);
    expect(snapshot.assets[0]?.shotIds).toEqual(["SHOT-001"]);
  });
});
