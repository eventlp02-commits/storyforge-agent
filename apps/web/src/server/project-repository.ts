import type { Artifact, ProjectSnapshot, RunEvent, StageName } from "@storyforge/contracts";
import { applyRunAction, invalidateDownstream } from "@storyforge/agent-core";
import { createProjectFromPrompt, starveinDemo, type DemoProjectOptions } from "../lib/demo-project";
import { markStageForRetry } from "../lib/workspace-state";

type ProjectCreation = { projectId: string; runId: string };

export interface ProjectRepository {
  create(concept: string, options?: DemoProjectOptions): ProjectCreation;
  getProject(projectId: string): ProjectSnapshot | undefined;
  getEvents(runId: string, after: number): RunEvent[];
  applyAction(runId: string, action: "pause" | "resume" | "cancel"): ProjectSnapshot | undefined;
  retryStage(stageRunId: string): ProjectSnapshot | undefined;
  updateArtifact(artifactId: string, content: unknown): Artifact | undefined;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

export function createInMemoryProjectRepository(seedDemo = true): ProjectRepository {
  const projects = new Map<string, ProjectSnapshot>();
  if (seedDemo) projects.set(starveinDemo.id, clone(starveinDemo));

  function findByRun(runId: string) {
    return [...projects.values()].find((project) => project.runId === runId);
  }

  function appendControlEvent(project: ProjectSnapshot, type: RunEvent["type"], title: string, detail: string) {
    const sequence = Math.max(0, ...project.events.map((event) => event.sequence)) + 1;
    project.events.push({
      id: `${project.runId}:event:${sequence}`,
      sequence,
      runId: project.runId,
      type,
      title,
      detail,
      timestamp: new Date().toISOString(),
      sanitized: true,
    });
  }

  return {
    create(concept, options) {
      const project = createProjectFromPrompt(concept, options);
      project.stageRuns = project.stageRuns.map((stage) => ({ ...stage, id: `${project.runId}:${stage.stage}` }));
      project.artifacts = project.artifacts.map((artifact) => ({ ...artifact, id: `${project.id}:${artifact.type}:v${artifact.version}` }));
      projects.set(project.id, project);
      return { projectId: project.id, runId: project.runId };
    },

    getProject(projectId) {
      const project = projects.get(projectId);
      return project ? clone(project) : undefined;
    },

    getEvents(runId, after) {
      const project = findByRun(runId);
      return project ? clone(project.events.filter((event) => event.sequence > after).sort((a, b) => a.sequence - b.sequence)) : [];
    },

    applyAction(runId, action) {
      const project = findByRun(runId);
      if (!project) return undefined;
      project.status = applyRunAction(project.status, action);
      project.updatedAt = new Date().toISOString();
      const eventType = action === "pause" ? "run.paused" : action === "resume" ? "run.resumed" : "run.cancelled";
      appendControlEvent(project, eventType, action === "pause" ? "运行已暂停" : action === "resume" ? "运行已继续" : "运行已取消", "用户在工作台执行了运行控制");
      return clone(project);
    },

    retryStage(stageRunId) {
      const project = [...projects.values()].find((candidate) => candidate.stageRuns.some((stage) => stage.id === stageRunId));
      const stage = project?.stageRuns.find((candidate) => candidate.id === stageRunId);
      if (!project || !stage) return undefined;
      const retried = markStageForRetry(project, stage.stage);
      projects.set(project.id, retried);
      return clone(retried);
    },

    updateArtifact(artifactId, content) {
      const project = [...projects.values()].find((candidate) => candidate.artifacts.some((artifact) => artifact.id === artifactId));
      const previous = project?.artifacts.find((artifact) => artifact.id === artifactId);
      if (!project || !previous) return undefined;
      previous.status = "archived";
      const downstream = new Set<StageName>(invalidateDownstream(previous.sourceStage));
      project.artifacts = project.artifacts.map((artifact) => artifact.id !== previous.id && downstream.has(artifact.sourceStage)
        ? { ...artifact, status: "stale" as const }
        : artifact);
      const updated: Artifact = {
        ...previous,
        id: `${project.id}:${previous.type}:v${previous.version + 1}`,
        version: previous.version + 1,
        status: "current",
        content,
        createdAt: new Date().toISOString(),
      };
      project.artifacts.push(updated);
      project.updatedAt = updated.createdAt;
      return clone(updated);
    },
  };
}

export const projectRepository = createInMemoryProjectRepository();
