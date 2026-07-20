import type { ProjectSnapshot, StageName, StageStatus } from "@storyforge/contracts";
import { applyRunAction } from "@storyforge/agent-core";

export type WorkspaceCommand = "pause" | "resume" | "cancel";

export function applyWorkspaceCommand(project: ProjectSnapshot, command: WorkspaceCommand): ProjectSnapshot {
  return {
    ...project,
    status: applyRunAction(project.status, command),
    updatedAt: new Date().toISOString(),
  };
}

export function getReplaySnapshot(project: ProjectSnapshot, visibleEventCount: number): ProjectSnapshot {
  const events = [...project.events].sort((a, b) => a.sequence - b.sequence).slice(0, visibleEventCount);
  const lastStatus = new Map<StageName, StageStatus>();
  for (const event of events) {
    if (!event.stage) continue;
    if (event.type === "stage.started") lastStatus.set(event.stage, "running");
    if (event.type === "stage.completed") lastStatus.set(event.stage, "completed");
    if (event.type === "stage.failed") lastStatus.set(event.stage, "failed");
  }
  const runCompleted = events.some((event) => event.type === "run.completed");
  return {
    ...project,
    status: runCompleted ? "completed" : "running",
    events,
    stageRuns: project.stageRuns.map((stage) => ({
      ...stage,
      status: lastStatus.get(stage.stage) ?? "queued",
    })),
  };
}

export function markStageForRetry(project: ProjectSnapshot, stageName: StageName): ProjectSnapshot {
  const stageIndex = project.stageRuns.findIndex((stage) => stage.stage === stageName);
  if (stageIndex < 0) return project;
  const staleStages = new Set(project.stageRuns.slice(stageIndex + 1).map((stage) => stage.stage));
  return {
    ...project,
    status: "running",
    stageRuns: project.stageRuns.map((stage, index) => {
      if (index < stageIndex) return stage;
      return {
        ...stage,
        status: index === stageIndex ? "running" : "queued",
        attempt: index === stageIndex ? stage.attempt + 1 : stage.attempt,
      };
    }),
    artifacts: project.artifacts.map((artifact) => staleStages.has(artifact.sourceStage) ? { ...artifact, status: "stale" } : artifact),
    updatedAt: new Date().toISOString(),
  };
}
