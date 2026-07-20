import { describe, expect, it } from "vitest";
import { BudgetGuard } from "../../src/budget";

describe("BudgetGuard", () => {
  it("pauses before exceeding any configured limit", () => {
    const guard = new BudgetGuard({ maxTokens: 1000, maxCostUsd: 0.5, maxImages: 2, maxVideoSeconds: 10 });
    guard.record({ tokens: 700, costUsd: 0.2, images: 1, videoSeconds: 4 });
    expect(guard.canSpend({ tokens: 200, costUsd: 0.1, images: 1, videoSeconds: 5 })).toBe(true);
    expect(guard.canSpend({ tokens: 400, costUsd: 0.1, images: 0, videoSeconds: 0 })).toBe(false);
  });

  it("counts usage already spent by an earlier stage attempt", () => {
    const guard = new BudgetGuard(
      { maxTokens: 1000, maxCostUsd: 1, maxImages: 2, maxVideoSeconds: 10 },
      { tokens: 900, costUsd: 0.8, images: 1, videoSeconds: 4 },
    );
    expect(guard.canSpend({ tokens: 101, costUsd: 0, images: 0, videoSeconds: 0 })).toBe(false);
    expect(guard.snapshot()).toEqual({ tokens: 900, costUsd: 0.8, images: 1, videoSeconds: 4 });
  });
});
