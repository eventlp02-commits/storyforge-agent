export type LedgerEventInput = {
  idempotencyKey: string;
  type: string;
  stage?: string;
  payload?: Record<string, unknown>;
};

export type LedgerEvent = LedgerEventInput & {
  sequence: number;
  timestamp: string;
};

export class EventLedger {
  private readonly events: LedgerEvent[] = [];
  private readonly keys = new Set<string>();

  append(input: LedgerEventInput): LedgerEvent | undefined {
    if (this.keys.has(input.idempotencyKey)) return undefined;
    const event: LedgerEvent = {
      ...input,
      sequence: this.events.length + 1,
      timestamp: new Date().toISOString(),
    };
    this.keys.add(input.idempotencyKey);
    this.events.push(event);
    return event;
  }

  list(after = 0): LedgerEvent[] {
    return this.events.filter((event) => event.sequence > after).map((event) => ({ ...event }));
  }
}
