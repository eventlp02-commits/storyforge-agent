import type { Asset, ProjectSnapshot, RunEvent, Shot, StageName, StageRun } from "@storyforge/contracts";
import { calculateTimeline } from "./timing";

const stages: Array<{ stage: StageName; parallelGroup?: string }> = [
  { stage: "intake" },
  { stage: "story-architect", parallelGroup: "foundation" },
  { stage: "art-director", parallelGroup: "foundation" },
  { stage: "scriptwriter" },
  { stage: "asset-director", parallelGroup: "production-design" },
  { stage: "audio-director", parallelGroup: "production-design" },
  { stage: "shot-designer" },
  { stage: "prompt-engineer" },
  { stage: "qa-critic" },
  { stage: "packager" },
];

export async function createFixtureRun(
  concept: string,
  options: { durationSeconds?: number } = {},
): Promise<ProjectSnapshot & { timeline: ReturnType<typeof calculateTimeline>; unresolvedAssetIds: string[] }> {
  const duration = options.durationSeconds ?? 60;
  const now = new Date().toISOString();
  const projectId = "project-fixture";
  const runId = "run-fixture";
  const shotCount = Math.max(3, Math.round(duration / 5));
  const shotDuration = duration / shotCount;
  const assets: Asset[] = [
    {
      id: "CHR-001",
      name: "主角",
      type: "character",
      status: "prompt-only",
      prompt: "原创奇幻信使，清晰轮廓，完整服装设定",
      shotIds: [],
    },
    {
      id: "LOC-001",
      name: "漂浮城市",
      type: "location",
      status: "prompt-only",
      prompt: "原创漂浮城市，风暴云海与魔法航道",
      shotIds: [],
    },
  ];
  const shots: Shot[] = Array.from({ length: shotCount }, (_, index) => {
    const start = Math.round(index * shotDuration * 1000) / 1000;
    const end = index === shotCount - 1 ? duration : Math.round((index + 1) * shotDuration * 1000) / 1000;
    const id = `SHOT-${String(index + 1).padStart(3, "0")}`;
    const assetIds = index === 0 ? ["LOC-001"] : ["CHR-001", "LOC-001"];
    for (const asset of assets) {
      if (assetIds.includes(asset.id)) asset.shotIds.push(id);
    }
    return {
      id,
      order: index + 1,
      start,
      end,
      scene: "风暴中的漂浮城市",
      purpose: index === 0 ? "建立世界与危机" : "推进信使的归来",
      framing: index % 2 === 0 ? "大全景" : "中近景",
      camera: index % 2 === 0 ? "缓慢航拍推进" : "贴身跟拍",
      action: `${concept}，第 ${index + 1} 个视觉节拍。`,
      sound: "风暴、机械翼面与远处钟声，强化环境音效",
      transition: index === shotCount - 1 ? "切黑" : "动作匹配剪辑",
      assetIds,
      prompt: `精美游戏 CG，原创奇幻世界，${concept}，镜头 ${index + 1}`,
      generationStatus: "ready",
    };
  });
  const stageRuns: StageRun[] = stages.map(({ stage, parallelGroup }, index) => ({
    id: `stage-${stage}`,
    stage,
    status: "completed",
    attempt: 1,
    ...(parallelGroup ? { parallelGroup } : {}),
    startedAt: now,
    completedAt: now,
    durationMs: 320 + index * 87,
    inputTokens: 180 + index * 12,
    outputTokens: 240 + index * 18,
    costUsd: 0,
  }));
  const events: RunEvent[] = [
    {
      id: "evt-start",
      sequence: 1,
      runId,
      type: "run.started",
      title: "开始创作",
      detail: "已建立固定 Agent 工作图",
      timestamp: now,
      sanitized: true,
    },
    ...stages.flatMap(({ stage }, index): RunEvent[] => [
      {
        id: `evt-${stage}-start`,
        sequence: index * 2 + 2,
        runId,
        type: "stage.started",
        stage,
        title: `${stage} 开始`,
        detail: "正在处理结构化阶段输入",
        timestamp: now,
        sanitized: true,
      },
      {
        id: `evt-${stage}-done`,
        sequence: index * 2 + 3,
        runId,
        type: "stage.completed",
        stage,
        title: `${stage} 完成`,
        detail: "结构化产物已写入项目",
        timestamp: now,
        sanitized: true,
        metrics: { durationMs: 320 + index * 87, tokens: 420 + index * 30, costUsd: 0 },
      },
    ]),
    {
      id: "evt-complete",
      sequence: stages.length * 2 + 2,
      runId,
      type: "run.completed",
      title: "制作包完成",
      detail: "所有阶段已通过质量检查",
      timestamp: now,
      sanitized: true,
    },
  ];
  const timeline = calculateTimeline(shots, duration);
  const knownAssets = new Set(assets.map((asset) => asset.id));
  const unresolvedAssetIds = [...new Set(shots.flatMap((shot) => shot.assetIds))].filter((id) => !knownAssets.has(id));
  const snapshot: ProjectSnapshot = {
    id: projectId,
    runId,
    skillVersion: "fixture",
    status: "completed",
    config: {
      title: "自动生成项目",
      concept,
      durationSeconds: duration,
      aspectRatio: "16:9",
      contentLanguage: "zh-CN",
      visualStyle: "精美游戏 CG，电影化灯光",
      format: "narrative-short",
      assumptions: ["未指定画幅，使用 16:9", "未指定语言，使用中文"],
    },
    stageRuns,
    artifacts: [],
    shots,
    assets,
    events,
    qa: {
      score: 96,
      passed: true,
      autoRepairCount: 0,
      checks: [
        { id: "timing", label: "时间闭合", status: timeline.valid ? "passed" : "failed", detail: `总时长 ${timeline.totalDuration} 秒` },
        { id: "assets", label: "资产引用", status: unresolvedAssetIds.length === 0 ? "passed" : "failed", detail: "所有资产引用均可解析" },
      ],
    },
    usage: { tokens: 0, costUsd: 0, images: 0, videoSeconds: 0 },
    createdAt: now,
    updatedAt: now,
  };
  return { ...snapshot, timeline, unresolvedAssetIds };
}
