import { describe, expect, it } from "vitest";
import { createInMemoryProjectRepository } from "./project-repository";

describe("project repository", () => {
  it("creates, restores and streams a project by sequence", () => {
    const repo = createInMemoryProjectRepository();
    const created = repo.create("一位邮差在月球遗迹里送出最后一封信");
    expect(repo.getProject(created.projectId)?.config.concept).toContain("邮差");
    const all = repo.getEvents(created.runId, 0);
    expect(repo.getEvents(created.runId, 5).every((event) => event.sequence > 5)).toBe(true);
    expect(all.length).toBeGreaterThan(10);
  });

  it("versions artifact edits and invalidates downstream work", () => {
    const repo = createInMemoryProjectRepository();
    const created = repo.create("一座森林每到午夜就会交换季节");
    const project = repo.getProject(created.projectId)!;
    const script = project.artifacts.find((artifact) => artifact.type === "script")!;
    const updated = repo.updateArtifact(script.id, { scenes: ["新版本"] });
    expect(updated?.version).toBe(2);
    expect(repo.getProject(created.projectId)?.artifacts.some((artifact) => artifact.status === "stale")).toBe(true);
  });

  it("creates a credential-ready local run without prefilled demo artifacts", () => {
    const repo = createInMemoryProjectRepository(false);
    const created = repo.createPending("一名厨师在漂浮列车上寻找失传菜谱");
    const project = repo.getProject(created.projectId);
    expect(project).toMatchObject({ status: "paused", artifacts: [], shots: [], assets: [], events: [] });
    expect(project?.stageRuns.every((stage) => stage.status === "queued")).toBe(true);
    expect(repo.getProjectByRun(created.runId)?.id).toBe(created.projectId);
  });
});
