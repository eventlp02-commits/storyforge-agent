"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Download,
  GitBranch,
  KeyRound,
  Pause,
  Play,
  Send,
  Sparkles,
  Square,
  WandSparkles,
  X,
} from "lucide-react";
import type { Artifact, ProjectSnapshot, RunStatus, StageName } from "@storyforge/contracts";
import { stopMediaGeneration } from "@storyforge/agent-core";
import { starveinDemo, createProjectFromPrompt } from "@/lib/demo-project";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getReplaySnapshot, markStageForRetry } from "@/lib/workspace-state";
import { AgentGraph } from "./agent-graph";
import { ArtifactCanvas, type CanvasTab } from "./artifact-canvas";
import { RunObserver } from "./run-observer";
import { StatusPill } from "./status-pill";
import { ProviderConnectionModal } from "./provider-connection-modal";

const storageKey = "storyforge.workspace.v1";

type SavedWorkspace = {
  project: ProjectSnapshot;
  visibleEventCount: number;
  runStatus: RunStatus;
  liveProjectId?: string;
  pendingRunId?: string;
};

function editableText(content: unknown) {
  return JSON.stringify(content, null, 2);
}

export function StoryForgeWorkspace() {
  const [project, setProject] = useState<ProjectSnapshot>({ ...starveinDemo, status: "running" });
  const [visibleEventCount, setVisibleEventCount] = useState(1);
  const [runStatus, setRunStatus] = useState<RunStatus>("running");
  const [activeTab, setActiveTab] = useState<CanvasTab>("brief");
  const [selectedStage, setSelectedStage] = useState<StageName>("intake");
  const [selectedAssetId, setSelectedAssetId] = useState<string>();
  const [concept, setConcept] = useState("");
  const [creationMode, setCreationMode] = useState<"demo" | "live">("demo");
  const [showCredential, setShowCredential] = useState(false);
  const [pendingRunId, setPendingRunId] = useState<string>();
  const [liveProjectId, setLiveProjectId] = useState<string>();
  const [editingArtifact, setEditingArtifact] = useState<Artifact>();
  const [editorText, setEditorText] = useState("");
  const [toast, setToast] = useState<string>();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const raw = window.localStorage.getItem(storageKey);
    let saved: SavedWorkspace | undefined;
    try {
      saved = raw ? JSON.parse(raw) as SavedWorkspace : undefined;
    } catch {
      window.localStorage.removeItem(storageKey);
    }
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      if (saved) {
        setProject(saved.project);
        setVisibleEventCount(saved.visibleEventCount);
        setRunStatus(saved.runStatus);
        setLiveProjectId(saved.liveProjectId);
        setPendingRunId(saved.pendingRunId);
      }
      setHydrated(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(storageKey, JSON.stringify({ project, visibleEventCount, runStatus, liveProjectId, pendingRunId } satisfies SavedWorkspace));
  }, [hydrated, liveProjectId, pendingRunId, project, runStatus, visibleEventCount]);

  useEffect(() => {
    if (!hydrated || !liveProjectId) return;
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch(`/api/projects/${liveProjectId}`, { cache: "no-store" });
        if (!response.ok) return;
        const snapshot = await response.json() as ProjectSnapshot;
        if (!active) return;
        setProject(snapshot);
        setVisibleEventCount(snapshot.events.length);
        setRunStatus(snapshot.status);
      } catch {
        // A transient polling failure is retried without discarding recovered state.
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 1200);
    let unsubscribeRealtime: (() => void) | undefined;
    try {
      const supabase = createSupabaseBrowserClient();
      const channel = supabase.channel(`storyforge-project-${liveProjectId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "run_events", filter: `project_id=eq.${liveProjectId}` }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "runs", filter: `project_id=eq.${liveProjectId}` }, refresh)
        .subscribe();
      unsubscribeRealtime = () => { void supabase.removeChannel(channel); };
    } catch {
      // Local demo environments intentionally have no Supabase configuration.
    }
    return () => {
      active = false;
      window.clearInterval(timer);
      unsubscribeRealtime?.();
    };
  }, [hydrated, liveProjectId]);

  useEffect(() => {
    if (liveProjectId || runStatus !== "running") return;
    if (visibleEventCount >= project.events.length) {
      const timer = window.setTimeout(() => setRunStatus("completed"), 0);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => setVisibleEventCount((count) => Math.min(project.events.length, count + 1)), 240);
    return () => window.clearTimeout(timer);
  }, [liveProjectId, project.events.length, runStatus, visibleEventCount]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(undefined), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const replayProject = useMemo(() => getReplaySnapshot(project, visibleEventCount), [project, visibleEventCount]);
  const visibleProject = useMemo(() => ({ ...replayProject, status: runStatus }), [replayProject, runStatus]);
  const visibleSelectedStage = visibleProject.stageRuns.find((stage) => stage.status === "running")?.stage ?? selectedStage;

  async function startProject() {
    const trimmed = concept.trim();
    if (!trimmed) {
      setToast("先写下一句话创意，再交给 Agent 团队。 ");
      return;
    }
    const next = createProjectFromPrompt(trimmed);
    setProject(next);
    setVisibleEventCount(1);
    setRunStatus("running");
    setActiveTab("brief");
    setSelectedStage("intake");
    setConcept("");
    if (creationMode === "demo") {
      setToast("新项目已立项，Intake Agent 正在补全缺失信息。 ");
      return;
    }
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ concept: trimmed, mode: "live" }),
      });
      const body = await response.json() as { projectId?: string; runId?: string; backend?: "local" | "cloud"; message?: string };
      if (!response.ok || !body.projectId || !body.runId) throw new Error(body.message ?? "Live backend unavailable");
      setLiveProjectId(body.projectId);
      setPendingRunId(body.runId);
      setShowCredential(true);
      setRunStatus("paused");
      setToast(body.backend === "cloud" ? "云端项目已建立，请提交一次性密钥启动真实 Agent。 " : "本地真实项目已建立，请提交 API Key 启动 Agent。 ");
    } catch {
      setRunStatus("paused");
      setToast("真实项目创建失败，请刷新后重试。 ");
    }
  }

  function openModelConnection() {
    if (!pendingRunId) {
      setCreationMode("live");
      setToast("已切换到真实运行：先输入一句话创意并创建项目，随后即可验证 API Key。 ");
      return;
    }
    setShowCredential(true);
  }

  function replayDemo() {
    setLiveProjectId(undefined);
    setPendingRunId(undefined);
    setProject({ ...structuredClone(starveinDemo), status: "running" });
    setVisibleEventCount(1);
    setRunStatus("running");
    setSelectedStage("intake");
    setActiveTab("brief");
    setToast("正在回放《星脉之歌》的完整 Agent 工作流。 ");
  }

  async function retryStage(stage: StageName) {
    if (liveProjectId) {
      const stageRun = project.stageRuns.find((item) => item.stage === stage);
      if (!stageRun) return;
      try {
        const response = await fetch(`/api/stages/${encodeURIComponent(stageRun.id)}/retry`, { method: "POST" });
        const body = await response.json() as { credentialRequired?: boolean };
        if (!response.ok) throw new Error("Retry failed");
        setRunStatus("paused");
        if (body.credentialRequired) setShowCredential(true);
        setToast("已失效相关下游产物；重新提交临时密钥后继续生成。 ");
      } catch {
        setToast("云端阶段暂时无法重试，请稍后再试。 ");
      }
      return;
    }
    const index = project.stageRuns.findIndex((item) => item.stage === stage);
    setProject((current) => markStageForRetry({ ...current, status: "running" }, stage));
    setVisibleEventCount(Math.max(1, index * 2 + 1));
    setRunStatus("running");
    setToast("已保留现有产物，并从所选阶段开始重新生成。 ");
  }

  async function stopMedia() {
    if (liveProjectId && pendingRunId) {
      try {
        const response = await fetch(`/api/runs/${pendingRunId}/media`, { method: "POST" });
        if (!response.ok) throw new Error("Media control failed");
      } catch {
        setToast("媒体停止指令暂时未送达，请稍后重试。 ");
        return;
      }
    }
    setProject((current) => ({ ...current, assets: stopMediaGeneration(current.assets), updatedAt: new Date().toISOString() }));
    setToast("未开始的媒体任务已停止，文本流程和制作包会继续完成。 ");
  }

  function openEditor(artifact: Artifact) {
    setEditingArtifact(artifact);
    setEditorText(editableText(artifact.content));
  }

  async function saveEditor() {
    if (!editingArtifact) return;
    try {
      const parsed = JSON.parse(editorText) as unknown;
      if (liveProjectId) {
        const response = await fetch(`/api/artifacts/${encodeURIComponent(editingArtifact.id)}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ content: parsed }),
        });
        if (!response.ok) throw new Error("Artifact update failed");
        setEditingArtifact(undefined);
        setToast("云端修改已保存为新版本，相关下游产物已标记过期。 ");
        return;
      }
      setProject((current) => ({
        ...current,
        artifacts: current.artifacts.map((artifact) => artifact.id === editingArtifact.id
          ? { ...artifact, id: `${artifact.id}-v${artifact.version + 1}`, version: artifact.version + 1, content: parsed, createdAt: new Date().toISOString() }
          : artifact),
        updatedAt: new Date().toISOString(),
      }));
      setEditingArtifact(undefined);
      setToast("修改已保存为新版本，下游产物可按需重新生成。 ");
    } catch {
      setToast("内容不是有效 JSON，请检查括号和引号。 ");
    }
  }

  async function exportPackage() {
    try {
      const { downloadProjectPackage } = await import("@/lib/export-package");
      await downloadProjectPackage(visibleProject);
      setToast("制作包已导出，包含 Markdown、JSON、CSV、DOCX 和 ZIP。 ");
    } catch {
      setToast("导出暂时失败，请稍后重试。 ");
    }
  }

  async function controlRun(action: "pause" | "resume" | "cancel") {
    if (!liveProjectId || !pendingRunId) {
      setRunStatus(action === "pause" ? "paused" : action === "resume" ? "running" : "cancelled");
      return;
    }
    try {
      const response = await fetch(`/api/runs/${pendingRunId}/actions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const body = await response.json() as { status?: RunStatus };
      if (!response.ok || !body.status) throw new Error("Control failed");
      setRunStatus(body.status);
      setToast(action === "pause" ? "后台任务会在当前阶段完成后暂停。 " : action === "resume" ? "后台任务已继续。 " : "后台任务已取消，完成产物会保留。 ");
    } catch {
      setToast("运行控制暂时失败，请稍后重试。 ");
    }
  }

  return (
    <div className="storyforge-shell">
      <header className="app-header">
        <div className="brand-lockup">
          <div className="brand-mark"><WandSparkles size={17} /></div>
          <div><div className="brand-name">StoryForge Agent</div><div className="brand-subtitle">通用短剧创作大师</div></div>
          <span className="meta-chip">{liveProjectId ? "LIVE" : "DEMO"}</span>
        </div>
        <div className="header-actions">
          <button className="command-button" type="button" onClick={replayDemo}><Sparkles size={13} />回放演示</button>
          <button className="command-button" type="button" title="配置 LLM、图片和视频模型" onClick={openModelConnection}><KeyRound size={13} />连接模型</button>
          <a className="icon-button" title="查看 GitHub" aria-label="查看 GitHub" href="https://github.com/eventlp02-commits/storyforge-agent" target="_blank" rel="noreferrer"><GitBranch size={15} /></a>
        </div>
      </header>

      <div className="prompt-bar">
        <div className="prompt-field">
          <Sparkles size={16} color="var(--teal)" />
          <input value={concept} onChange={(event) => setConcept(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") startProject(); }} placeholder="一句话描述你想创作的视频，例如：一名修钟匠发现整座城市的时间正在倒流" aria-label="一句话视频创意" />
          <div className="mode-switch" aria-label="创建模式">
            <button type="button" aria-pressed={creationMode === "demo"} onClick={() => setCreationMode("demo")}>演示</button>
            <button type="button" aria-pressed={creationMode === "live"} onClick={() => setCreationMode("live")}>真实运行</button>
          </div>
        </div>
        <button className="command-button primary" type="button" onClick={startProject}><Send size={14} />开始创作</button>
      </div>

      <div className="workspace-grid">
        <aside className="left-rail">
          <AgentGraph stages={visibleProject.stageRuns} selectedStage={visibleSelectedStage} onSelectStage={setSelectedStage} onRetry={retryStage} />
        </aside>
        <section className="center-canvas" style={{ display: "grid", gridTemplateRows: "auto minmax(0, 1fr)" }}>
          <div className="canvas-topline">
            <div className="project-title">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><h1>{visibleProject.config.title}</h1><StatusPill status={visibleProject.status} /></div>
              <p>{visibleProject.config.concept}</p>
            </div>
            <div className="run-actions">
              {runStatus === "paused" ? (
                <button className="icon-button" type="button" title="继续运行" onClick={() => controlRun("resume")}><Play size={14} /></button>
              ) : (
                <button className="icon-button" type="button" title="暂停运行" disabled={runStatus !== "running"} onClick={() => controlRun("pause")}><Pause size={14} /></button>
              )}
              <button className="icon-button danger" type="button" title="取消运行" disabled={runStatus === "completed" || runStatus === "cancelled"} onClick={() => controlRun("cancel")}><Square size={13} /></button>
              <button className="command-button" type="button" onClick={() => void stopMedia()}><Box size={13} /><span>停止媒体</span></button>
              <button className="command-button" type="button" onClick={exportPackage}><Download size={13} /><span>导出制作包</span></button>
            </div>
          </div>
          <ArtifactCanvas project={visibleProject} activeTab={activeTab} selectedAssetId={selectedAssetId} onTabChange={setActiveTab} onSelectAsset={setSelectedAssetId} onEditArtifact={openEditor} />
        </section>
        <RunObserver project={visibleProject} />
      </div>

      {editingArtifact ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`编辑${editingArtifact.title}`}>
          <div className="modal">
            <div className="modal-header"><h2>编辑 {editingArtifact.title}</h2><button className="icon-button" type="button" title="关闭" onClick={() => setEditingArtifact(undefined)}><X size={14} /></button></div>
            <textarea value={editorText} onChange={(event) => setEditorText(event.target.value)} spellCheck={false} />
            <div className="modal-footer"><button className="command-button" type="button" onClick={() => setEditingArtifact(undefined)}>取消</button><button className="command-button primary" type="button" onClick={saveEditor}>保存新版本</button></div>
          </div>
        </div>
      ) : null}
      {showCredential && pendingRunId ? (
        <ProviderConnectionModal
          runId={pendingRunId}
          onClose={() => setShowCredential(false)}
          onError={setToast}
          onStarted={(info) => {
            setShowCredential(false);
            setRunStatus("running");
            const deferred = Object.values(info.verification ?? {}).some((state) => state === "deferred");
            setToast(`${info.llmLabel} 配置已接受，${info.backend === "cloud" ? "云端" : "本地"} Agent 正在运行${deferred ? "；连接将在首次请求时最终确认" : ""}。 `);
          }}
        />
      ) : null}
      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </div>
  );
}
