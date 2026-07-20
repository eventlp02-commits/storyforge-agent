import type { Artifact, Asset, ProjectConfig, ProjectSnapshot, RunEvent, Shot, StageName, StageRun } from "@storyforge/contracts";

const createdAt = "2026-07-20T08:00:00.000Z";
const runId = "run-starvein-demo";

const stageDefinitions: Array<{ stage: StageName; parallelGroup?: string; durationMs: number; tokens: number }> = [
  { stage: "intake", durationMs: 740, tokens: 618 },
  { stage: "story-architect", parallelGroup: "foundation", durationMs: 2860, tokens: 2884 },
  { stage: "art-director", parallelGroup: "foundation", durationMs: 2410, tokens: 2432 },
  { stage: "scriptwriter", durationMs: 3880, tokens: 3760 },
  { stage: "asset-director", parallelGroup: "production-design", durationMs: 1920, tokens: 1840 },
  { stage: "audio-director", parallelGroup: "production-design", durationMs: 1680, tokens: 1510 },
  { stage: "shot-designer", durationMs: 4260, tokens: 4520 },
  { stage: "prompt-engineer", durationMs: 3580, tokens: 3940 },
  { stage: "qa-critic", durationMs: 1290, tokens: 1220 },
  { stage: "packager", durationMs: 880, tokens: 340 },
];

const stageLabels: Record<StageName, string> = {
  intake: "需求分析",
  "story-architect": "故事架构",
  "art-director": "美术指导",
  scriptwriter: "剧本创作",
  "asset-director": "资产规划",
  "audio-director": "声音设计",
  "shot-designer": "镜头设计",
  "prompt-engineer": "提示词工程",
  "qa-critic": "质量检查",
  packager: "制作包导出",
};

const stageRuns: StageRun[] = stageDefinitions.map(({ stage, parallelGroup, durationMs, tokens }) => ({
  id: `stage-${stage}`,
  stage,
  status: "completed",
  attempt: 1,
  ...(parallelGroup ? { parallelGroup } : {}),
  startedAt: createdAt,
  completedAt: createdAt,
  durationMs,
  inputTokens: Math.round(tokens * 0.42),
  outputTokens: Math.round(tokens * 0.58),
  costUsd: 0,
}));

const imageAssets: Asset[] = [
  ["GFX-001", "星脉纪元总美术圣经", "graphic", "/demo/world-bible.jpg", "统一世界材质、色彩、建筑与星脉能源的视觉基准"],
  ["CHR-001", "瑞安与艾拉", "character", "/demo/heroes.jpg", "人类魔法学徒与青年剑士，互补双主角"],
  ["SPC-ELF", "月叶精灵", "character", "/demo/elves.jpg", "树冠城市居民与星叶长弓装备"],
  ["SPC-DWARF", "熔脊矮人", "character", "/demo/dwarves.jpg", "火山锻造文明、重型符文工具与工程装甲"],
  ["SPC-ORC", "赤原兽族", "character", "/demo/orcs.jpg", "草原联盟、风帆陆舟与竞技文化"],
  ["LOC-CAP", "卢米拉人类首都", "location", "/demo/capital.jpg", "围绕星脉塔生长的多层白石首都"],
  ["LOC-MKT", "千味交汇市", "location", "/demo/market.jpg", "六族贸易、美食、香料与工艺品交汇市场"],
  ["LOC-ELF", "埃尔维林树冠城", "location", "/demo/elf-city.jpg", "以活体巨树、索桥和叶舟构成的精灵城市"],
  ["LOC-DWF", "卡尔杜姆熔脊城", "location", "/demo/dwarf-city.jpg", "火山内部的锻造城市与岩浆运输网"],
  ["FOOD-001", "六族宴席", "food", "/demo/cuisine.jpg", "展示文明差异的原创料理与饮品"],
  ["FLR-001", "星脉农作物", "flora", "/demo/crops.jpg", "会储存微光能量的谷物、藤果与菌田"],
  ["LOC-GEO", "维尔塔拉六大地貌", "location", "/demo/geography.jpg", "浮空山、赤色草原、月叶林、熔脊与潮汐峡谷"],
].map(([id, name, type, fileUrl, notes]) => ({
  id: id as string,
  name: name as string,
  type: type as Asset["type"],
  status: "done" as const,
  prompt: notes as string,
  fileUrl: fileUrl as string,
  thumbnailUrl: fileUrl as string,
  shotIds: [],
  notes: notes as string,
}));

const plannedAssets: Asset[] = [
  { id: "VEH-001", name: "星帆空艇", type: "vehicle", status: "prompt-only", prompt: "木、白铜与星脉帆组成的原创民用飞行船，清晰侧视结构", shotIds: [], notes: "媒体生成默认关闭" },
  { id: "PRP-001", name: "练习长剑", type: "prop", status: "prompt-only", prompt: "磨损钢剑、皮革护手、学院徽记，实用训练装备", shotIds: [], notes: "媒体生成默认关闭" },
  { id: "FX-001", name: "星脉编织术", type: "effect", status: "prompt-only", prompt: "金青色几何光带沿空气中的星脉节点连接，不使用现有作品符号", shotIds: [], notes: "媒体生成默认关闭" },
  { id: "CRE-001", name: "云鲸", type: "creature", status: "prompt-only", prompt: "巨型温和飞行生物，半透明鳍翼与苔藓背脊，原创轮廓", shotIds: [], notes: "媒体生成默认关闭" },
  { id: "AUD-001", name: "星脉之歌声音包", type: "audio", status: "prompt-only", prompt: "管弦与世界乐器主题，城市、锻炉、市场、风暴分层环境声", shotIds: [], notes: "仅规划，不包含生成音频" },
];

type ShotSeed = Omit<Shot, "order" | "prompt" | "generationStatus">;

const shotSeeds: ShotSeed[] = [
  { id: "SHOT-001", start: 0, end: 7, scene: "维尔塔拉云海", purpose: "用地貌尺度建立世界", framing: "极远景", camera: "穿云下降后横向掠过浮空山", action: "晨光点亮六种地貌，星脉像河流在大地内部闪烁。", sound: "低频风声、遥远号角、音乐主题第一次出现", transition: "云层擦镜", assetIds: ["LOC-GEO", "GFX-001", "CRE-001"] },
  { id: "SHOT-002", start: 7, end: 14, scene: "卢米拉外环", purpose: "展示首都与交通", framing: "大全景", camera: "跟随星帆空艇进入城市航道", action: "空艇从云鲸身旁掠过，多层城市和中央星脉塔逐级展开。", sound: "帆索振动、翼面掠风、城市钟声", transition: "沿塔身俯冲", assetIds: ["LOC-CAP", "VEH-001", "CRE-001"] },
  { id: "SHOT-003", start: 14, end: 21, scene: "星织学院", purpose: "展示人类魔法", framing: "中景转特写", camera: "环绕瑞安的手势与法阵节点", action: "瑞安把散落光点编成一座微型桥，桥面承托一杯水稳稳越过桌面。", dialogue: "瑞安：魔法不是命令世界，而是听懂它的方向。", sound: "细密晶振、呼吸、轻微课堂回响", transition: "光点匹配剪辑", assetIds: ["CHR-001", "FX-001", "LOC-CAP"] },
  { id: "SHOT-004", start: 21, end: 29, scene: "王都剑庭", purpose: "展示练剑文化", framing: "全景转近景", camera: "低机位跟拍步法，最后定格剑锋", action: "艾拉与同伴进行实战步法训练，木桩被精准切断，围观学员齐声喝彩。", sound: "剑刃撞击、靴底摩擦、教官口令", transition: "剑锋掠过镜头", assetIds: ["CHR-001", "PRP-001", "LOC-CAP"] },
  { id: "SHOT-005", start: 29, end: 37, scene: "千味交汇市", purpose: "展示市场贸易", framing: "移动长镜头", camera: "在人群、货架与交易台间连续穿行", action: "人类商人使用悬浮秤，兽族换取香料，精灵叶舟送来鲜果，矮人工匠现场修复器具。", sound: "多语言叫卖、铜币、笑声、推车轮响", transition: "蒸汽遮幅", assetIds: ["LOC-MKT", "SPC-ELF", "SPC-DWARF", "SPC-ORC"] },
  { id: "SHOT-006", start: 37, end: 44, scene: "六族食摊", purpose: "用美食拉近文明", framing: "微距组接", camera: "从炉火、刀工、盛盘移动到共享长桌", action: "熔岩薄饼、月露果冻、草原烤谷和潮盐汤依次上桌，不同种族交换彼此的吃法。", sound: "煎烤、汤沸、陶杯碰响", transition: "圆盘形状匹配", assetIds: ["FOOD-001", "LOC-MKT", "SPC-DWARF", "SPC-ORC"] },
  { id: "SHOT-007", start: 44, end: 51, scene: "星穗梯田", purpose: "展示农业与能源循环", framing: "航拍转手部特写", camera: "顺梯田下降到农人掌心", action: "星穗在风中逐层发亮，农人把多余光能导入灌溉渠，夜间温室随之启动。", sound: "作物摩擦、清水、低柔能量脉冲", transition: "水流带出画面", assetIds: ["FLR-001", "FX-001", "LOC-GEO"] },
  { id: "SHOT-008", start: 51, end: 58, scene: "埃尔维林树冠城", purpose: "展示精灵文明", framing: "仰拍大全景", camera: "沿巨树螺旋上升穿越桥网", action: "叶舟停靠、弓手巡行、孩子追逐会发光的种子，建筑随枝条轻微呼吸。", sound: "树叶海浪、木铃、鸟群与弦乐", transition: "飞叶擦镜", assetIds: ["LOC-ELF", "SPC-ELF", "FLR-001"] },
  { id: "SHOT-009", start: 58, end: 65, scene: "卡尔杜姆锻造层", purpose: "展示矮人工业", framing: "广角室内", camera: "穿过岩浆桥后推近锻造台", action: "符文锤协同机械臂锻造空艇龙骨，冷却水化作蒸汽瀑布。", sound: "重锤、齿轮、岩浆轰鸣形成节奏", transition: "锤击闪白", assetIds: ["LOC-DWF", "SPC-DWARF", "VEH-001"] },
  { id: "SHOT-010", start: 65, end: 72, scene: "赤原风帆赛场", purpose: "展示兽族娱乐", framing: "高速追踪", camera: "贴地追随三艘风帆陆舟冲过弯道", action: "兽族车手借侧风超越，观众敲鼓欢呼，终点旗在热浪中展开。", sound: "轮轴震动、鼓点、风帆爆响", transition: "旗帜遮幅", assetIds: ["SPC-ORC", "LOC-GEO", "AUD-001"] },
  { id: "SHOT-011", start: 72, end: 80, scene: "潮汐峡谷港", purpose: "扩展交通网络", framing: "超广角", camera: "从水下升出海面并跟随升降船坞", action: "潮族引导水道抬升货船，空艇与陆舟在立体枢纽交接货箱。", sound: "水压、绞盘、港口信号笛", transition: "水滴折射", assetIds: ["LOC-GEO", "VEH-001", "LOC-MKT"] },
  { id: "SHOT-012", start: 80, end: 88, scene: "边境星脉站", purpose: "引入共同危机", framing: "中远景", camera: "稳定构图突然被地面震动打破", action: "星脉灯依次熄灭，来自不同文明的旅人同时停下动作，望向远方风暴。", sound: "音乐骤停、灯灭脆响、远雷逼近", transition: "硬切", assetIds: ["CHR-001", "SPC-ELF", "SPC-DWARF", "SPC-ORC", "FX-001"] },
  { id: "SHOT-013", start: 88, end: 96, scene: "风暴前线", purpose: "展示跨种族战斗", framing: "大全景转群像", camera: "横移展现联合防线后快速推进", action: "剑士稳住地面阵列、精灵校准远距节点、矮人展开护盾器、兽族拖回受损空艇。", sound: "号令、护盾共振、风暴轰鸣", transition: "闪电切换方位", assetIds: ["CHR-001", "SPC-ELF", "SPC-DWARF", "SPC-ORC", "FX-001", "VEH-001"] },
  { id: "SHOT-014", start: 96, end: 104, scene: "断裂星桥", purpose: "让魔法与剑术合流", framing: "双人中景", camera: "围绕瑞安和艾拉快速半环绕", action: "瑞安编织临时星桥，艾拉沿未完成的光面奔跑，用剑将失控节点导回轨道。", dialogue: "艾拉：路还没铺完。 瑞安：那就边跑边铺。", sound: "脚步、剑鸣、能量逐级升调", transition: "高速推入星脉", assetIds: ["CHR-001", "PRP-001", "FX-001"] },
  { id: "SHOT-015", start: 104, end: 112, scene: "六城共鸣", purpose: "完成世界级高潮", framing: "多地交叉剪辑", camera: "相同方向的推镜连接六座城市", action: "市场灯火、树冠脉络、锻炉符文、草原风塔和首都塔顶同时亮起，风暴被打开一条通道。", sound: "各文明乐器汇入同一主题，环境声保持清晰", transition: "光线汇聚", assetIds: ["LOC-CAP", "LOC-MKT", "LOC-ELF", "LOC-DWF", "SPC-ORC", "FX-001"] },
  { id: "SHOT-016", start: 112, end: 120, scene: "维尔塔拉新航路", purpose: "以开放未来收束", framing: "极远景", camera: "缓慢拉远，空艇驶向被照亮的地平线", action: "云鲸伴随第一支联合商队启航，六族孩子在城墙上放飞星叶纸鸢。片名《星脉之歌》出现。", dialogue: "旁白：世界从来不是一条道路，而是我们愿意彼此抵达。", sound: "主题旋律完整收束，风声与孩童笑声留尾", transition: "自然淡出", assetIds: ["LOC-GEO", "VEH-001", "CRE-001", "GFX-001", "AUD-001"] },
];

const shots: Shot[] = shotSeeds.map((shot, index) => ({
  ...shot,
  order: index + 1,
  prompt: `原创奇幻中世纪世界，3D 渲染结合 2D 轮廓与手绘纹理，精美游戏 CG，电影化体积光；${shot.camera}；${shot.action}；保持资产编号 ${shot.assetIds.join("、")} 的造型与材质一致；无现有作品角色或标志。`,
  generationStatus: "ready",
}));

const assets = [...imageAssets, ...plannedAssets].map((asset) => ({
  ...asset,
  shotIds: shots.filter((shot) => shot.assetIds.includes(asset.id)).map((shot) => shot.id),
}));

const artifacts: Artifact[] = [
  { id: "ART-BRIEF-001", type: "brief", version: 1, status: "current", title: "创意简报", sourceStage: "intake", createdAt, content: { logline: "一场横跨六族文明的两分钟旅程，以魔法学徒与剑士的日常为入口，见证世界因共同危机而连接。", audience: "奇幻游戏与 AI 影像受众", format: "2 分钟世界观 MV", tone: "宏大、温暖、充满发现感", assumptions: ["16:9 横屏", "中文旁白与对白", "原创世界，不依赖受保护 IP", "图片和视频生成默认关闭"] } },
  { id: "ART-WORLD-001", type: "world", version: 1, status: "current", title: "维尔塔拉世界圣经", sourceStage: "story-architect", createdAt, content: { premise: "星脉是贯穿地貌与文明的自然能量网络，任何族群都无法独占。", civilizations: ["卢米拉人类王国", "月叶精灵树冠邦", "熔脊矮人锻造城", "赤原兽族联盟", "潮汐峡谷诸港", "暮裔边境聚落"], rules: ["魔法通过理解并重排星脉连接实现", "剑术与工程能改变能量传导方向", "贸易网络比王国边界更古老"] } },
  { id: "ART-SCRIPT-001", type: "script", version: 1, status: "current", title: "完整剧本", sourceStage: "scriptwriter", createdAt, content: { scenes: ["序章：世界苏醒", "日常：魔法、剑术与贸易", "远行：六族城市与生活", "危机：星脉风暴", "高潮：六城共鸣", "尾声：新的航路"], dialogue: shots.filter((shot) => shot.dialogue).map((shot) => ({ shotId: shot.id, line: shot.dialogue })) } },
  { id: "ART-AUDIO-001", type: "audio", version: 1, status: "current", title: "声音设计", sourceStage: "audio-director", createdAt, content: { music: "从独奏木管发展为六族乐器与管弦合奏；危机段短暂抽空音乐，让环境声承担叙事。", principles: ["每个城市有独立声音地标", "对白始终清晰", "魔法使用晶振与空气位移，不用通用爆炸音效"] } },
  { id: "ART-PROMPT-001", type: "prompts", version: 1, status: "current", title: "生成提示词包", sourceStage: "prompt-engineer", createdAt, content: { styleLock: "原创奇幻中世纪，3D 渲染结合 2D 轮廓与手绘材质，精美游戏 CG，可信材质，电影化镜头，非写实血腥表达。", shotCount: shots.length, language: "中文内容；生成对白时使用普通话；强化环境音效。" } },
  { id: "ART-QA-001", type: "qa", version: 1, status: "current", title: "质量检查", sourceStage: "qa-critic", createdAt, content: { score: 98, summary: "时间、资产引用、对白容量、连续性、原创性和提示词字段全部通过。" } },
  { id: "ART-PACK-001", type: "package", version: 1, status: "current", title: "制作包清单", sourceStage: "packager", createdAt, content: { files: ["项目简报.md", "完整剧本.md", "镜头时间线.csv", "资产清单.csv", "生成提示词.md", "QA 报告.md", "project.json", "StoryForge_制作包.docx"] } },
];

const events: RunEvent[] = [
  { id: "EVT-001", sequence: 1, runId, type: "run.started", title: "《星脉之歌》开始创作", detail: "已载入通用短剧创作大师 v1.0.0", timestamp: createdAt, sanitized: true },
  ...stageDefinitions.flatMap(({ stage, durationMs, tokens }, index): RunEvent[] => [
    { id: `EVT-${String(index * 2 + 2).padStart(3, "0")}`, sequence: index * 2 + 2, runId, type: "stage.started", stage, title: `${stageLabels[stage]}开始`, detail: index === 1 || index === 2 || index === 4 || index === 5 ? "并行工作已启动" : "正在处理结构化输入", timestamp: createdAt, sanitized: true },
    { id: `EVT-${String(index * 2 + 3).padStart(3, "0")}`, sequence: index * 2 + 3, runId, type: "stage.completed", stage, title: `${stageLabels[stage]}完成`, detail: stage === "shot-designer" ? "16 个镜头已精确闭合至 120.00 秒" : "产物已版本化保存", timestamp: createdAt, sanitized: true, metrics: { durationMs, tokens, costUsd: 0 } },
  ]),
  { id: "EVT-022", sequence: 22, runId, type: "run.completed", title: "完整制作包已就绪", detail: "8 种格式与 17 项资产均已通过检查", timestamp: createdAt, sanitized: true, metrics: { durationMs: 23500, tokens: 23064, costUsd: 0 } },
];

export const starveinDemo: ProjectSnapshot = {
  id: "project-starvein-demo",
  runId,
  skillVersion: "sf-1.0.0-7f3a1c2",
  status: "completed",
  config: {
    title: "星脉之歌",
    concept: "一部两分钟原创奇幻世界观 MV，展示六族文明、魔法、剑术、城市、交通、贸易、美食、农业、娱乐与共同危机。",
    durationSeconds: 120,
    aspectRatio: "16:9",
    contentLanguage: "zh-CN",
    visualStyle: "3D 渲染结合 2D 轮廓与手绘纹理，精美游戏 CG 质感",
    format: "world-showcase",
    assumptions: ["默认 16:9 横屏", "默认中文对白与旁白", "使用原创世界与原创角色", "媒体生成关闭，保留可执行提示词", "无密钥演示不产生 API 费用"],
  },
  stageRuns,
  artifacts,
  shots,
  assets,
  events,
  qa: {
    score: 98,
    passed: true,
    autoRepairCount: 1,
    checks: [
      { id: "timing", label: "时间闭合", status: "passed", detail: "16 个镜头连续覆盖 0.00-120.00 秒，误差 0.00 秒" },
      { id: "dialogue", label: "对白容量", status: "passed", detail: "三处对白均可在镜头时长内自然完成" },
      { id: "continuity", label: "视觉连续性", status: "passed", detail: "角色、城市、能源与交通均使用固定资产编号" },
      { id: "assets", label: "资产引用", status: "passed", detail: "所有 67 次镜头资产调用均能解析" },
      { id: "originality", label: "原创性", status: "passed", detail: "未发现受保护角色、世界名称或标志" },
      { id: "prompts", label: "提示词完整度", status: "passed", detail: "镜头、机位、动作、声音、转场和一致性字段齐全" },
    ],
  },
  usage: { tokens: 23064, costUsd: 0, images: 12, videoSeconds: 0 },
  createdAt,
  updatedAt: createdAt,
};

export type DemoProjectOptions = Partial<Pick<ProjectConfig, "durationSeconds" | "aspectRatio" | "contentLanguage" | "visualStyle">>;

export function createProjectFromPrompt(concept: string, options: DemoProjectOptions = {}): ProjectSnapshot {
  const now = new Date().toISOString();
  const slug = Math.random().toString(36).slice(2, 9);
  const durationSeconds = options.durationSeconds ?? 60;
  const scale = durationSeconds / starveinDemo.config.durationSeconds;
  const durationLabel = durationSeconds.toFixed(2);
  return {
    ...structuredClone(starveinDemo),
    id: `project-${slug}`,
    runId: `run-${slug}`,
    status: "running",
    config: {
      ...starveinDemo.config,
      title: concept.length > 14 ? `${concept.slice(0, 14)}…` : concept,
      concept,
      durationSeconds,
      aspectRatio: options.aspectRatio ?? "16:9",
      contentLanguage: options.contentLanguage ?? "zh-CN",
      visualStyle: options.visualStyle ?? "3D 渲染结合 2D 轮廓与手绘纹理，精美游戏 CG 质感",
      format: "narrative-short",
      assumptions: [
        ...(options.durationSeconds ? [] : ["未指定时长，采用 60 秒"]),
        ...(options.aspectRatio ? [] : ["未指定画幅，采用 16:9"]),
        ...(options.contentLanguage ? [] : ["未指定语言，采用中文"]),
        ...(options.visualStyle ? [] : ["未指定美术风格，采用电影化游戏 CG"]),
        "媒体生成默认关闭",
      ],
    },
    shots: starveinDemo.shots.map((shot) => ({
      ...shot,
      start: Math.round(shot.start * scale * 1000) / 1000,
      end: Math.round(shot.end * scale * 1000) / 1000,
      generationStatus: "ready",
    })),
    stageRuns: starveinDemo.stageRuns.map((stage) => ({ ...stage, status: "queued", startedAt: undefined, completedAt: undefined })),
    events: starveinDemo.events.map((event) => ({
      ...event,
      runId: `run-${slug}`,
      timestamp: now,
      detail: event.stage === "shot-designer" && event.type === "stage.completed"
        ? `${starveinDemo.shots.length} 个镜头已精确闭合至 ${durationLabel} 秒`
        : event.detail,
    })),
    qa: {
      ...structuredClone(starveinDemo.qa),
      checks: starveinDemo.qa.checks.map((check) => check.id === "timing"
        ? { ...check, detail: `${starveinDemo.shots.length} 个镜头连续覆盖 0.00-${durationLabel} 秒，误差 0.00 秒` }
        : { ...check }),
    },
    createdAt: now,
    updatedAt: now,
  };
}

export { stageLabels };
