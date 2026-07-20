import { describe, expect, it } from "vitest";
import { projectSnapshotSchema } from "@storyforge/contracts";
import { calculateTimeline } from "@storyforge/agent-core";
import { createProjectFromPrompt, starveinDemo } from "./demo-project";

describe("Starvein demo", () => {
  it("is a valid, exactly timed, fully linked project", () => {
    expect(projectSnapshotSchema.safeParse(starveinDemo).success).toBe(true);
    expect(calculateTimeline(starveinDemo.shots, 120).valid).toBe(true);
    const assetIds = new Set(starveinDemo.assets.map((asset) => asset.id));
    expect(starveinDemo.shots.flatMap((shot) => shot.assetIds).every((id) => assetIds.has(id))).toBe(true);
  });

  it("turns one sentence into a complete local project while keeping assumptions visible", () => {
    const project = createProjectFromPrompt("一名修钟匠发现城市的时间正在倒流");
    expect(project.config.concept).toContain("修钟匠");
    expect(project.config.assumptions.length).toBeGreaterThan(0);
    expect(project.shots.length).toBeGreaterThan(5);
    expect(project.status).toBe("running");
    expect(calculateTimeline(project.shots, project.config.durationSeconds).valid).toBe(true);
    expect(project.qa.checks.find((check) => check.id === "timing")?.detail).toContain("60.00 秒");
    expect(project.events.find((event) => event.stage === "shot-designer" && event.type === "stage.completed")?.detail).toContain("60.00 秒");
  });

  it("honors advanced project settings and retimes the shot plan", () => {
    const project = createProjectFromPrompt("竖屏炼金术广告", {
      durationSeconds: 45,
      aspectRatio: "9:16",
      contentLanguage: "ja-JP",
      visualStyle: "彩色木刻动画",
    });

    expect(project.config.durationSeconds).toBe(45);
    expect(project.config.aspectRatio).toBe("9:16");
    expect(project.config.contentLanguage).toBe("ja-JP");
    expect(project.config.visualStyle).toBe("彩色木刻动画");
    expect(calculateTimeline(project.shots, 45).valid).toBe(true);
  });
});
