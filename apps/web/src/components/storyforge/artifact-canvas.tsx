"use client";

import Image from "next/image";
import { Check, Edit3, FileJson2, Sparkles } from "lucide-react";
import type { Artifact, ProjectSnapshot } from "@storyforge/contracts";
import { AssetsView } from "./assets-view";
import { TimelineView } from "./timeline-view";

export type CanvasTab = "brief" | "world" | "script" | "shots" | "assets" | "prompts" | "qa";

const tabs: Array<{ id: CanvasTab; label: string }> = [
  { id: "brief", label: "创意简报" },
  { id: "world", label: "世界观" },
  { id: "script", label: "剧本" },
  { id: "shots", label: "镜头时间线" },
  { id: "assets", label: "资产" },
  { id: "prompts", label: "提示词" },
  { id: "qa", label: "质检" },
];

function artifactFor(project: ProjectSnapshot, type: Artifact["type"]) {
  return project.artifacts.find((artifact) => artifact.type === type);
}

function BriefView({ project, onEdit }: { project: ProjectSnapshot; onEdit: (artifact: Artifact) => void }) {
  const artifact = artifactFor(project, "brief");
  const brief = artifact?.content as { format?: string; audience?: string; goal?: string } | undefined;
  const isDemo = project.id === "project-starvein-demo";
  return (
    <article className="document-sheet">
      <header className="document-header">
        <div className="document-intro">
          <p className="eyebrow">{brief?.format ?? project.config.format} · {project.config.durationSeconds} seconds</p>
          <h2>{project.config.title}</h2>
          <p className="lede">{brief?.goal ?? project.config.concept}</p>
          <div className="meta-row">
            <span className="meta-chip">{project.config.durationSeconds} 秒</span>
            <span className="meta-chip">{project.config.aspectRatio}</span>
            <span className="meta-chip">{project.shots.length} 个镜头</span>
            <span className="meta-chip">{project.assets.length} 项资产</span>
          </div>
        </div>
        <div className="document-cover">
          {isDemo ? <Image src="/demo/world-bible.jpg" alt="星脉纪元原创世界美术设定" fill priority sizes="(max-width: 820px) 100vw, 40vw" /> : <div className="live-cover"><Sparkles size={34} /><strong>{project.config.title}</strong><span>{project.config.visualStyle}</span></div>}
        </div>
      </header>
      <div className="document-body">
        <div className="section-title-row">
          <h2>创作定义</h2>
          {artifact ? <button className="icon-button" type="button" title="编辑创意简报" onClick={() => onEdit(artifact)}><Edit3 size={14} /></button> : null}
        </div>
        <div className="brief-grid">
          <div className="brief-cell teal"><strong>创作目标</strong><p>{brief?.goal ?? project.config.concept}</p></div>
          <div className="brief-cell amber"><strong>目标观众</strong><p>{brief?.audience ?? "根据创意与发布场景自动推断"}</p></div>
          <div className="brief-cell coral"><strong>视觉方向</strong><p>{project.config.visualStyle}</p></div>
        </div>
        <div className="assumptions">
          <h3>Intake Agent 的推断</h3>
          <div className="assumption-list">
            {project.config.assumptions.map((assumption) => <span className="meta-chip" key={assumption}>{assumption}</span>)}
          </div>
        </div>
      </div>
    </article>
  );
}

function WorldView({ project, onEdit }: { project: ProjectSnapshot; onEdit: (artifact: Artifact) => void }) {
  const artifact = artifactFor(project, "world");
  const world = artifact?.content as { premise?: string; civilizations?: string[]; rules?: string[]; story?: { logline?: string; theme?: string; worldRules?: string[] }; artDirection?: { visualThesis?: string; rendering?: string; lighting?: string } } | undefined;
  const premise = world?.premise ?? world?.story?.logline;
  const rules = world?.rules ?? world?.story?.worldRules;
  const images = [
    ["/demo/capital.jpg", "卢米拉人类首都"],
    ["/demo/elf-city.jpg", "埃尔维林树冠城"],
    ["/demo/dwarf-city.jpg", "卡尔杜姆熔脊城"],
    ["/demo/geography.jpg", "维尔塔拉六大地貌"],
  ];
  return (
    <article className="document-sheet">
      <div className="document-body">
        <div className="section-title-row">
          <div><p className="eyebrow">World bible</p><h2>维尔塔拉世界圣经</h2></div>
          {artifact ? <button className="icon-button" type="button" title="编辑世界观" onClick={() => onEdit(artifact)}><Edit3 size={14} /></button> : null}
        </div>
        <p className="lede" style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.7 }}>{premise}</p>
        {project.id === "project-starvein-demo" ? <div className="world-grid" style={{ marginTop: 16 }}>
          {images.map(([src, label]) => (
            <figure className="world-image" key={src}>
              <Image src={src} alt={label} fill sizes="(max-width: 820px) 100vw, 40vw" />
              <figcaption>{label}</figcaption>
            </figure>
          ))}
        </div> : null}
        <div className="brief-grid" style={{ marginTop: 20 }}>
          <div className="brief-cell teal"><strong>世界主题</strong><p>{world?.story?.theme ?? world?.civilizations?.join("、")}</p></div>
          <div className="brief-cell amber"><strong>核心规则</strong><p>{rules?.[0]}</p></div>
          <div className="brief-cell coral"><strong>美术命题</strong><p>{world?.artDirection?.visualThesis ?? "建立统一且可持续复用的视觉语法"}</p></div>
        </div>
      </div>
    </article>
  );
}

function ScriptView({ project, onEdit }: { project: ProjectSnapshot; onEdit: (artifact: Artifact) => void }) {
  const artifact = artifactFor(project, "script");
  const content = artifact?.content as { scenes?: Array<string | { id?: string; start?: number; end?: number; location?: string; action?: string; dialogue?: Array<{ speaker: string; line: string }>; narration?: string }>; dialogue?: Array<{ shotId: string; line: string }> } | undefined;
  const sceneShots = [project.shots.slice(0, 2), project.shots.slice(2, 7), project.shots.slice(7, 12), project.shots.slice(12, 14), project.shots.slice(14, 15), project.shots.slice(15)];
  return (
    <div className="document-sheet">
      <div className="document-body">
        <div className="section-title-row">
          <div><p className="eyebrow">Screenplay v{artifact?.version ?? 1}</p><h2>完整剧本</h2></div>
          {artifact ? <button className="command-button" type="button" onClick={() => onEdit(artifact)}><Edit3 size={13} />编辑剧本</button> : null}
        </div>
        <div className="script-list">
          {content?.scenes?.map((scene, index) => {
            const sceneObject = typeof scene === "string" ? undefined : scene;
            const heading = typeof scene === "string" ? scene : `${scene.location ?? scene.id ?? "场景"}${scene.start !== undefined && scene.end !== undefined ? ` · ${scene.start}-${scene.end} 秒` : ""}`;
            return <section className="script-scene" key={sceneObject?.id ?? `${heading}-${index}`}>
              <h3>{String(index + 1).padStart(2, "0")} · {heading}</h3>
              <p>{sceneObject?.action ?? sceneShots[index]?.map((shot) => shot.action).join(" ")}</p>
              {sceneObject?.narration ? <p className="shot-dialogue">旁白：{sceneObject.narration}</p> : null}
              {sceneObject?.dialogue?.map((line, lineIndex) => <p className="shot-dialogue" key={`${line.speaker}-${lineIndex}`}>{line.speaker}：{line.line}</p>)}
              {!sceneObject ? sceneShots[index]?.filter((shot) => shot.dialogue).map((shot) => <p className="shot-dialogue" key={shot.id}>{shot.dialogue}</p>) : null}
            </section>
          })}
        </div>
      </div>
    </div>
  );
}

function PromptView({ project, onEdit }: { project: ProjectSnapshot; onEdit: (artifact: Artifact) => void }) {
  const artifact = artifactFor(project, "prompts");
  const content = artifact?.content as { styleLock?: string; globalStyleLock?: string; language?: string } | undefined;
  return (
    <div className="document-sheet">
      <div className="document-body">
        <div className="section-title-row">
          <div><p className="eyebrow">Generation package</p><h2>逐镜生成提示词</h2></div>
          {artifact ? <button className="icon-button" type="button" title="编辑提示词包" onClick={() => onEdit(artifact)}><Edit3 size={14} /></button> : null}
        </div>
        <div className="qa-score" style={{ minHeight: 90, marginBottom: 12 }}>
          <Sparkles size={26} color="var(--teal)" />
          <div><strong style={{ fontSize: 12 }}>全局风格锁</strong><p style={{ margin: "5px 0 0", color: "#42605a", fontSize: 11, lineHeight: 1.5 }}>{content?.globalStyleLock ?? content?.styleLock}</p></div>
        </div>
        <div className="prompt-list">
          {project.shots.map((shot) => (
            <article className="prompt-item" key={shot.id}>
              <h3><FileJson2 size={12} style={{ display: "inline", marginRight: 5 }} />{shot.id} · {shot.start.toFixed(1)}-{shot.end.toFixed(1)} 秒</h3>
              <p>{shot.prompt}</p>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

function QaView({ project }: { project: ProjectSnapshot }) {
  return (
    <div className="document-sheet">
      <div className="document-body">
        <div className="section-title-row"><div><p className="eyebrow">QA critic</p><h2>制作质量报告</h2></div><span className="meta-chip">自动修复 {project.qa.autoRepairCount} 次</span></div>
        <div className="qa-score">
          <div className="score-number">{project.qa.score}<small>/100</small></div>
          <div><strong>可以进入制作</strong><p style={{ margin: "6px 0 0", color: "#42605a", fontSize: 11 }}>结构、时间、资产、原创性与提示词完整度均已达到发布阈值。</p></div>
        </div>
        <div className="qa-grid">
          {project.qa.checks.map((check) => (
            <div className="qa-check" key={check.id}>
              <Check size={16} color="var(--teal)" />
              <div><strong>{check.label}</strong><p>{check.detail}</p></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ArtifactCanvas({
  project,
  activeTab,
  selectedAssetId,
  onTabChange,
  onSelectAsset,
  onEditArtifact,
}: {
  project: ProjectSnapshot;
  activeTab: CanvasTab;
  selectedAssetId?: string;
  onTabChange: (tab: CanvasTab) => void;
  onSelectAsset: (assetId: string) => void;
  onEditArtifact: (artifact: Artifact) => void;
}) {
  return (
    <main className="artifact-canvas">
      <div className="tab-strip" role="tablist" aria-label="项目产物">
        {tabs.map((tab) => (
          <button className="tab-button" role="tab" aria-selected={activeTab === tab.id} type="button" key={tab.id} onClick={() => onTabChange(tab.id)}>{tab.label}</button>
        ))}
      </div>
      <div className="canvas-content">
        {activeTab === "brief" ? <BriefView project={project} onEdit={onEditArtifact} /> : null}
        {activeTab === "world" ? <WorldView project={project} onEdit={onEditArtifact} /> : null}
        {activeTab === "script" ? <ScriptView project={project} onEdit={onEditArtifact} /> : null}
        {activeTab === "shots" ? <TimelineView shots={project.shots} onAssetClick={(assetId) => { onSelectAsset(assetId); onTabChange("assets"); }} /> : null}
        {activeTab === "assets" ? <AssetsView assets={project.assets} selectedAssetId={selectedAssetId} onSelectAsset={onSelectAsset} /> : null}
        {activeTab === "prompts" ? <PromptView project={project} onEdit={onEditArtifact} /> : null}
        {activeTab === "qa" ? <QaView project={project} /> : null}
      </div>
    </main>
  );
}
