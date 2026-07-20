export type BudgetLimits = {
  maxTokens: number;
  maxCostUsd: number;
  maxImages: number;
  maxVideoSeconds: number;
};

export type Usage = {
  tokens: number;
  costUsd: number;
  images: number;
  videoSeconds: number;
};

const emptyUsage = (): Usage => ({ tokens: 0, costUsd: 0, images: 0, videoSeconds: 0 });

export class BudgetGuard {
  private usage: Usage;

  constructor(private readonly limits: BudgetLimits, initialUsage: Usage = emptyUsage()) {
    this.usage = { ...initialUsage };
  }

  canSpend(next: Usage): boolean {
    return this.usage.tokens + next.tokens <= this.limits.maxTokens
      && this.usage.costUsd + next.costUsd <= this.limits.maxCostUsd
      && this.usage.images + next.images <= this.limits.maxImages
      && this.usage.videoSeconds + next.videoSeconds <= this.limits.maxVideoSeconds;
  }

  record(next: Usage): Usage {
    if (!this.canSpend(next)) throw new Error("Budget limit exceeded; run must pause");
    this.usage = {
      tokens: this.usage.tokens + next.tokens,
      costUsd: this.usage.costUsd + next.costUsd,
      images: this.usage.images + next.images,
      videoSeconds: this.usage.videoSeconds + next.videoSeconds,
    };
    return this.snapshot();
  }

  snapshot(): Usage {
    return { ...this.usage };
  }
}
