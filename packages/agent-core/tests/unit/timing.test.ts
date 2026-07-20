import { describe, expect, it } from "vitest";
import { calculateTimeline } from "../../src/timing";

describe("calculateTimeline", () => {
  it("closes an exact timeline within 0.05 seconds", () => {
    const result = calculateTimeline([
      { id: "SHOT-001", start: 0, end: 3.25 },
      { id: "SHOT-002", start: 3.25, end: 7.5 },
      { id: "SHOT-003", start: 7.5, end: 12 },
    ], 12);

    expect(result.valid).toBe(true);
    expect(result.totalDuration).toBe(12);
    expect(result.gaps).toEqual([]);
    expect(result.overlaps).toEqual([]);
  });

  it("reports gaps and overlaps", () => {
    const result = calculateTimeline([
      { id: "SHOT-001", start: 0, end: 2 },
      { id: "SHOT-002", start: 3, end: 5 },
      { id: "SHOT-003", start: 4.5, end: 7 },
    ], 8);

    expect(result.valid).toBe(false);
    expect(result.gaps).toHaveLength(2);
    expect(result.overlaps).toHaveLength(1);
  });
});
