import { describe, expect, it } from "vitest";
import { EventLedger } from "../../src/event-ledger";

describe("EventLedger", () => {
  it("deduplicates idempotent events and preserves sequence", () => {
    const ledger = new EventLedger();
    ledger.append({ idempotencyKey: "run-1:intake:start", type: "stage.started", stage: "intake" });
    ledger.append({ idempotencyKey: "run-1:intake:start", type: "stage.started", stage: "intake" });
    ledger.append({ idempotencyKey: "run-1:intake:end", type: "stage.completed", stage: "intake" });
    expect(ledger.list().map((event) => event.sequence)).toEqual([1, 2]);
  });
});
