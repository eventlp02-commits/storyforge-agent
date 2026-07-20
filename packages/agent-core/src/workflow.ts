import type { RunEvent, StageName, StageRun } from "@storyforge/contracts";
import { BudgetGuard, type BudgetLimits, type Usage } from "./budget";
import { assetOutputSchema, intakeOutputSchema, promptOutputSchema, shotOutputSchema } from "./agent-schemas";
import { calculateTimeline } from "./timing";
import { invalidateDownstream } from "./state-machine";

export type StageExecutionResult = {
  output: unknown;
  usage: { inputTokens: number; outputTokens: number; costUsd: number };
};

export interface StageExecutor {
  execute(stage: StageName, input: Record<string, unknown>): Promise<StageExecutionResult>;
}

export type WorkflowInput = {
  concept: string;
  runId: string;
  projectConfig?: Record<string, unknown>;
  budget?: BudgetLimits;
  initialUsage?: Usage;
  startStage?: StageName;
  startAttempt?: number;
  seedOutputs?: Partial<Record<StageName, unknown>>;
  sequenceOffset?: number;
  signal?: AbortSignal;
  onEvent?: (event: RunEvent) => Promise<void> | void;
  control?: () => Promise<"run" | "pause" | "cancel">;
  controlPollMs?: number;
};

type QaOutput = {
  passed: boolean;
  score: number;
  repairStages: StageName[];
  reasons: string[];
};

export type WorkflowResult = {
  status: "completed" | "failed" | "paused" | "cancelled";
  outputs: Partial<Record<StageName, unknown>>;
  stageRuns: StageRun[];
  events: RunEvent[];
  usage: { inputTokens: number; outputTokens: number; costUsd: number };
};

const groups: StageName[][] = [
  ["intake"],
  ["story-architect", "art-director"],
  ["scriptwriter"],
  ["asset-director", "audio-director"],
  ["shot-designer"],
  ["prompt-engineer"],
];

const parallelGroup: Partial<Record<StageName, string>> = {
  "story-architect": "foundation",
  "art-director": "foundation",
  "asset-director": "production-design",
  "audio-director": "production-design",
};

function isQaOutput(value: unknown): value is QaOutput {
  if (!value || typeof value !== "object") return false;
  const qa = value as Partial<QaOutput>;
  return typeof qa.passed === "boolean" && typeof qa.score === "number" && Array.isArray(qa.repairStages) && Array.isArray(qa.reasons);
}

function enforceDeterministicQa(value: unknown, outputs: Partial<Record<StageName, unknown>>): unknown {
  if (!isQaOutput(value)) return value;
  const intake = intakeOutputSchema.safeParse(outputs.intake);
  const shotPlan = shotOutputSchema.safeParse(outputs["shot-designer"]);
  if (!intake.success || !shotPlan.success) return value;

  const reasons: string[] = [];
  const repairStages = new Set<StageName>();
  const timeline = calculateTimeline(shotPlan.data.shots, intake.data.durationSeconds);
  if (!timeline.valid) {
    reasons.push(`Timeline closes at ${timeline.totalDuration.toFixed(2)}s instead of ${intake.data.durationSeconds.toFixed(2)}s`);
    repairStages.add("shot-designer");
  }
  const assetPlan = assetOutputSchema.safeParse(outputs["asset-director"]);
  if (assetPlan.success) {
    const assetIds = new Set(assetPlan.data.assets.map((asset) => asset.id));
    const unresolved = [...new Set(shotPlan.data.shots.flatMap((shot) => shot.assetIds).filter((id) => !assetIds.has(id)))];
    if (unresolved.length > 0) {
      reasons.push(`Unresolved asset IDs: ${unresolved.join(", ")}`);
      repairStages.add("asset-director");
      repairStages.add("shot-designer");
    }
  }
  const prompts = promptOutputSchema.safeParse(outputs["prompt-engineer"]);
  if (prompts.success) {
    const promptIds = new Set(prompts.data.shots.map((shot) => shot.shotId));
    const missingPrompts = shotPlan.data.shots.filter((shot) => !promptIds.has(shot.id)).map((shot) => shot.id);
    if (missingPrompts.length > 0) {
      reasons.push(`Missing shot prompts: ${missingPrompts.join(", ")}`);
      repairStages.add("prompt-engineer");
    }
  }
  if (reasons.length === 0) return value;
  return {
    ...value,
    passed: false,
    score: Math.min(value.score, 60),
    repairStages: [...repairStages],
    reasons: [...value.reasons, ...reasons],
  } satisfies QaOutput;
}

export async function runStoryForgeWorkflow(input: WorkflowInput, executor: StageExecutor): Promise<WorkflowResult> {
  const stageRuns: StageRun[] = [];
  const events: RunEvent[] = [];
  const outputs: Partial<Record<StageName, unknown>> = { ...input.seedOutputs };
  const usage = { inputTokens: 0, outputTokens: 0, costUsd: 0 };
  const budget = input.budget ? new BudgetGuard(input.budget, input.initialUsage) : undefined;
  let sequence = input.sequenceOffset ?? 0;
  let observedControl: "run" | "pause" = "run";

  const emit = async (event: Omit<RunEvent, "id" | "sequence" | "runId" | "timestamp" | "sanitized">) => {
    const full: RunEvent = {
      ...event,
      id: `${input.runId}:event:${sequence + 1}`,
      sequence: ++sequence,
      runId: input.runId,
      timestamp: new Date().toISOString(),
      sanitized: true,
    };
    events.push(full);
    await input.onEvent?.(full);
  };

  const waitForControl = async () => {
    while (true) {
      if (input.signal?.aborted) throw new DOMException("Run cancelled", "AbortError");
      const decision = await input.control?.() ?? "run";
      if (decision === "cancel") throw new DOMException("Run cancelled", "AbortError");
      if (decision === "run") {
        if (observedControl === "pause") {
          observedControl = "run";
          await emit({ type: "run.resumed", title: "Workflow resumed", detail: "Persisted run control returned to running" });
        }
        return;
      }
      if (observedControl !== "pause") {
        observedControl = "pause";
        await emit({ type: "run.paused", title: "Workflow paused", detail: "Completed stage outputs were preserved" });
      }
      await new Promise((resolve) => setTimeout(resolve, Math.max(1, input.controlPollMs ?? 1000)));
    }
  };

  const executeStage = async (stage: StageName, attempt = 1) => {
    await waitForControl();
    await emit({ type: "stage.started", stage, title: `${stage} started`, detail: "Structured stage execution started" });
    const startedAt = new Date();
    const result = await executor.execute(stage, {
      concept: input.concept,
      projectConfig: input.projectConfig,
      outputs,
      attempt,
    });
    const stageUsage = { tokens: result.usage.inputTokens + result.usage.outputTokens, costUsd: result.usage.costUsd, images: 0, videoSeconds: 0 };
    if (budget && !budget.canSpend(stageUsage)) {
      await emit({ type: "budget.warning", stage, title: "Workflow budget reached", detail: "Run paused before recording additional stage usage" });
      const error = new Error("Budget limit reached");
      error.name = "BudgetExceededError";
      throw error;
    }
    budget?.record(stageUsage);
    const completedAt = new Date();
    const stageRun: StageRun = {
      id: `${input.runId}:${stage}:${attempt}`,
      stage,
      status: "completed",
      attempt,
      ...(parallelGroup[stage] ? { parallelGroup: parallelGroup[stage] } : {}),
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs: Math.max(0, completedAt.getTime() - startedAt.getTime()),
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      costUsd: result.usage.costUsd,
    };
    stageRuns.push(stageRun);
    outputs[stage] = result.output;
    usage.inputTokens += result.usage.inputTokens;
    usage.outputTokens += result.usage.outputTokens;
    usage.costUsd += result.usage.costUsd;
    await emit({
      type: "stage.completed",
      stage,
      title: `${stage} completed`,
      detail: "Structured output validated and versioned",
      metrics: { durationMs: stageRun.durationMs, tokens: stageRun.inputTokens + stageRun.outputTokens, costUsd: stageRun.costUsd },
    });
    return result.output;
  };

  await emit({ type: "run.started", title: "StoryForge workflow started", detail: "Fixed DAG loaded" });
  try {
    const selectedStages = input.startStage ? new Set<StageName>([input.startStage, ...invalidateDownstream(input.startStage)]) : undefined;
    const executionAttempt = input.startStage ? input.startAttempt ?? 2 : 1;
    for (const group of groups) {
      const stages = selectedStages ? group.filter((stage) => selectedStages.has(stage)) : group;
      await Promise.all(stages.map((stage) => executeStage(stage, executionAttempt)));
    }

    if (input.startStage === "packager") {
      await executeStage("packager", executionAttempt);
      await emit({ type: "run.completed", title: "Production package completed", detail: "All required deliverables passed QA" });
      return { status: "completed", outputs, stageRuns, events, usage };
    }

    let qaAttempt = executionAttempt;
    let qaOutput = enforceDeterministicQa(await executeStage("qa-critic", qaAttempt), outputs);
    outputs["qa-critic"] = qaOutput;
    while (isQaOutput(qaOutput) && !qaOutput.passed && qaAttempt <= 2) {
      const repairStages = qaOutput.repairStages.filter((stage) => stage !== "qa-critic" && stage !== "packager");
      for (const stage of repairStages) await executeStage(stage, qaAttempt + 1);
      qaAttempt += 1;
      qaOutput = enforceDeterministicQa(await executeStage("qa-critic", qaAttempt), outputs);
      outputs["qa-critic"] = qaOutput;
    }

    if (!isQaOutput(qaOutput) || !qaOutput.passed) {
      await emit({ type: "run.failed", title: "Workflow paused for review", detail: "QA did not pass after two automatic repairs" });
      return { status: "failed", outputs, stageRuns, events, usage };
    }

    await executeStage("packager", executionAttempt);
    await emit({ type: "run.completed", title: "Production package completed", detail: "All required deliverables passed QA" });
    return { status: "completed", outputs, stageRuns, events, usage };
  } catch (error) {
    if (error instanceof Error && error.name === "CredentialInvalidError") {
      await emit({ type: "run.paused", title: "Workflow waiting for a valid credential", detail: "The temporary provider credential was rejected and removed" });
      return { status: "paused", outputs, stageRuns, events, usage };
    }
    if (error instanceof Error && error.name === "BudgetExceededError") {
      await emit({ type: "run.paused", title: "Workflow paused for budget review", detail: "Completed artifacts were preserved" });
      return { status: "paused", outputs, stageRuns, events, usage };
    }
    if (error instanceof Error && error.name === "AbortError") {
      await emit({ type: "run.cancelled", title: "Workflow cancelled", detail: "Completed artifacts were preserved" });
      return { status: "cancelled", outputs, stageRuns, events, usage };
    }
    await emit({ type: "run.failed", title: "Workflow failed", detail: error instanceof Error ? error.message : "Unknown stage error" });
    return { status: "failed", outputs, stageRuns, events, usage };
  }
}
