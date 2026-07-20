import { describe, expect, it } from "vitest";
import { starveinDemo } from "./demo-project";
import { applyWorkspaceCommand, getReplaySnapshot } from "./workspace-state";

describe("workspace state", () => {
  it("pauses, resumes and cancels a replay", () => {
    expect(applyWorkspaceCommand({ ...starveinDemo, status: "running" }, "pause").status).toBe("paused");
    expect(applyWorkspaceCommand({ ...starveinDemo, status: "paused" }, "resume").status).toBe("running");
    expect(applyWorkspaceCommand({ ...starveinDemo, status: "running" }, "cancel").status).toBe("cancelled");
  });

  it("reveals ordered events and stages during replay", () => {
    const early = getReplaySnapshot(starveinDemo, 5);
    const late = getReplaySnapshot(starveinDemo, 999);
    expect(early.events).toHaveLength(5);
    expect(late.events).toHaveLength(starveinDemo.events.length);
    expect(early.events.map((event) => event.sequence)).toEqual([1, 2, 3, 4, 5]);
  });
});
