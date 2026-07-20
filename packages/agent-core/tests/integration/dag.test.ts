import { describe, expect, it } from "vitest";
import { createFixtureRun } from "../../src/fixture-runner";

describe("fixture DAG", () => {
  it("runs the fixed graph with parallel creative and production stages", async () => {
    const run = await createFixtureRun("一座漂浮城市在风暴中迎来失散的信使", { durationSeconds: 30 });
    expect(run.status).toBe("completed");
    expect(run.stageRuns.find((stage) => stage.stage === "story-architect")?.parallelGroup).toBe("foundation");
    expect(run.stageRuns.find((stage) => stage.stage === "art-director")?.parallelGroup).toBe("foundation");
    expect(run.timeline.totalDuration).toBe(30);
    expect(run.unresolvedAssetIds).toEqual([]);
    expect(run.events.length).toBeGreaterThan(10);
  });
});
