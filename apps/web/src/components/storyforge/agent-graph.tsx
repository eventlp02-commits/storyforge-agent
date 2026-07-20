"use client";

import { useMemo } from "react";
import {
  Background,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { RotateCcw } from "lucide-react";
import type { StageName, StageRun } from "@storyforge/contracts";
import { stageLabels } from "@/lib/demo-project";

type AgentNodeData = {
  label: string;
  status: StageRun["status"];
  durationMs: number;
  selected: boolean;
};

type AgentNode = Node<AgentNodeData, "agent">;

function AgentNodeView({ data }: NodeProps<AgentNode>) {
  return (
    <div className={`agent-node ${data.status} ${data.selected ? "selected" : ""}`}>
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <strong>{data.label}</strong>
      <span>{data.status === "completed" ? `${(data.durationMs / 1000).toFixed(1)} 秒` : data.status}</span>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}

const nodeTypes = { agent: AgentNodeView };

const positions: Record<StageName, { x: number; y: number }> = {
  intake: { x: 62, y: 16 },
  "story-architect": { x: -5, y: 100 },
  "art-director": { x: 130, y: 100 },
  scriptwriter: { x: 62, y: 184 },
  "asset-director": { x: -5, y: 268 },
  "audio-director": { x: 130, y: 268 },
  "shot-designer": { x: 62, y: 352 },
  "prompt-engineer": { x: 62, y: 436 },
  "qa-critic": { x: 62, y: 520 },
  packager: { x: 62, y: 604 },
};

const edgePairs: Array<[StageName, StageName]> = [
  ["intake", "story-architect"],
  ["intake", "art-director"],
  ["story-architect", "scriptwriter"],
  ["art-director", "scriptwriter"],
  ["scriptwriter", "asset-director"],
  ["scriptwriter", "audio-director"],
  ["asset-director", "shot-designer"],
  ["audio-director", "shot-designer"],
  ["shot-designer", "prompt-engineer"],
  ["prompt-engineer", "qa-critic"],
  ["qa-critic", "packager"],
];

export function AgentGraph({
  stages,
  selectedStage,
  onSelectStage,
  onRetry,
}: {
  stages: StageRun[];
  selectedStage: StageName;
  onSelectStage: (stage: StageName) => void;
  onRetry: (stage: StageName) => void;
}) {
  const nodes = useMemo<AgentNode[]>(() => stages.map((stage) => ({
    id: stage.stage,
    type: "agent",
    position: positions[stage.stage],
    draggable: false,
    selectable: true,
    data: {
      label: stageLabels[stage.stage],
      status: stage.status,
      durationMs: stage.durationMs,
      selected: selectedStage === stage.stage,
    },
  })), [stages, selectedStage]);

  const edges = useMemo<Edge[]>(() => edgePairs.map(([source, target]) => ({
    id: `${source}-${target}`,
    source,
    target,
    animated: stages.find((stage) => stage.stage === target)?.status === "running",
    style: { stroke: "#aeb8b1", strokeWidth: 1.25 },
  })), [stages]);

  const selected = stages.find((stage) => stage.stage === selectedStage);

  return (
    <>
      <div className="panel-heading">
        <h2>Agent 工作图</h2>
        <span>固定 DAG</span>
      </div>
      <div className="graph-shell" aria-label="Agent 工作流图">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={(_, node) => onSelectStage(node.id as StageName)}
          fitView
          fitViewOptions={{ padding: 0.1 }}
          minZoom={0.72}
          maxZoom={1.1}
          nodesConnectable={false}
          elementsSelectable
          panOnDrag
          zoomOnScroll={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#d9dfda" gap={18} size={1} />
        </ReactFlow>
      </div>
      <div className="graph-toolbar">
        <p>{stageLabels[selectedStage]}：第 {selected?.attempt ?? 1} 次执行，状态为 {selected?.status ?? "queued"}。</p>
        <button className="command-button" type="button" onClick={() => onRetry(selectedStage)}>
          <RotateCcw size={13} />重跑此阶段
        </button>
      </div>
    </>
  );
}
