# StoryForge Agent｜通用短剧创作大师

StoryForge Agent 是一个把“一句话视频创意”自动整理成完整制作包的多 Agent 工作台。

用户不用先写需求文档。输入一句话后，系统会补全时长、画幅、语言和风格，依次完成创意简报、世界观、剧本、镜头时间线、资产规划、生成提示词、质量检查和文件导出。整个过程会在页面上实时展示，但不会泄露模型的隐藏推理。

> 当前仓库自带原创《星脉之歌》无密钥演示。它不会调用付费 API，适合招聘方直接查看。真实运行无需 GitHub 登录，用户可以接入自己的 LLM、图片和视频模型 API。

![StoryForge Agent 30 秒演示](docs/demo.gif)

## 最终能得到什么

- 创意简报和 Intake Agent 的推断假设
- 世界观、品牌设定或内容结构
- 完整剧本、对白、旁白和声音设计
- 起止时间精确闭合的镜头时间线
- 角色、场景、道具、交通、食物、植物和特效资产表
- 逐镜视频提示词和统一风格锁
- 时间、对白、连续性、资产引用和原创性 QA 报告
- Markdown、JSON、CSV、DOCX 和 ZIP 制作包
- 可选图片与视频 Provider；媒体服务不可用时自动保留为 `prompt-only`

## 直接运行

需要 Node.js 22+ 和 pnpm 11+。

```bash
git clone https://github.com/eventlp02-commits/storyforge-agent.git
cd storyforge-agent
pnpm install
pnpm dev
```

打开 `http://localhost:3000`。不配置任何密钥也能回放完整演示。

运行检查：

```bash
pnpm typecheck
pnpm test
pnpm eval
pnpm build
pnpm test:e2e
```

## 页面怎么用

1. 在顶部输入一句话创意。
2. 选择“演示”可以免费本地回放；选择“真实运行”会优先使用已配置的云端任务，否则自动使用本地 BYOK Agent。
3. 左侧查看 Agent 当前阶段、并行任务和失败重试。
4. 中间切换简报、世界观、剧本、时间线、资产、提示词和质检。
5. 右侧查看已清洗的事件、耗时、Token 和费用。
6. 随时暂停、继续、取消、停止媒体生成或单独重跑某个阶段。
7. 点击“导出制作包”下载 ZIP。

页面刷新后，演示项目会从 `localStorage` 恢复；生产模式由 Supabase 和 Trigger.dev 恢复。

## Agent 工作流

```mermaid
flowchart TD
  I["Intake"] --> S["Story Architect"]
  I --> A["Art Director"]
  S --> W["Scriptwriter"]
  A --> W
  W --> AD["Asset Director"]
  W --> AU["Audio Director"]
  AD --> SD["Shot Designer"]
  AU --> SD
  SD --> P["Prompt Engineer"]
  P --> Q["QA Critic"]
  Q -->|"通过"| PK["Packager"]
  Q -->|"定向修复，最多两次"| SD
```

这不是让一个模型自由发挥的聊天机器人。代码控制固定 DAG，阶段之间只传递 Zod 校验后的结构化数据。故事与美术、资产与声音会并行执行；QA 失败时只重跑相关阶段。

## 系统架构

```mermaid
flowchart LR
  UI["Next.js 工作台"] --> API["Route Handlers"]
  API --> AUTH["本地会话 / Supabase 匿名会话"]
  API --> DB["Supabase PostgreSQL + RLS"]
  API --> TR["Trigger.dev"]
  TR --> DAG["StoryForge 固定 DAG"]
  DAG --> HUB["Provider Hub"]
  HUB --> SDK["OpenAI-compatible / Anthropic"]
  HUB --> MEDIA["OpenAI Images / Replicate / fal / Runway"]
  SDK --> DB
  MEDIA --> STORE["Supabase Storage"]
  DB --> RT["Realtime 事件"]
  RT --> UI
  UI --> ZIP["Markdown / JSON / CSV / DOCX / ZIP"]
```

## 数据如何流动

```mermaid
sequenceDiagram
  participant U as 用户
  participant W as Web
  participant D as Supabase
  participant T as Trigger.dev
  participant A as Provider Hub
  U->>W: 输入一句话并创建项目
  U->>W: 选择供应商并提交一次性 API Key
  alt 已配置 Supabase 与 Trigger.dev
    W->>D: 匿名会话保存 project、run 与 AES-GCM 密文
    W->>T: 使用幂等键启动长任务
    T->>A: 按固定 DAG 流式执行
    T->>D: 写入阶段、产物和清洗事件
    D-->>W: Realtime 更新
  else 本地 BYOK
    W->>A: 验证密钥后在服务端内存执行固定 DAG
    A-->>W: 实时更新本地项目状态与产物
  end
  W-->>U: 展示图谱、时间线、资产和成本
```

## 技术栈

- 前端：Next.js 16 App Router、React 19、TypeScript、Tailwind CSS、React Flow、Lucide
- Agent：Provider Hub、OpenAI Agents SDK、Anthropic Messages、OpenAI-compatible Chat Completions、Zod、代码控制 DAG
- 后台任务：Trigger.dev，支持断线恢复、重试、取消和幂等执行
- 数据：本地内存运行，或 Supabase PostgreSQL、匿名 Auth、Storage、Realtime、RLS
- 导出：JSZip、docx
- 测试：Vitest、Playwright、GitHub Actions
- 部署：Vercel + Supabase + Trigger.dev

## Monorepo 结构

```text
storyforge-agent/
├── apps/web                         # Next.js 工作台与 API
├── packages/contracts               # Zod 数据协议
├── packages/agent-core              # DAG、状态机、安全、Providers、Agents SDK
├── trigger                           # Trigger.dev 长任务
├── supabase                          # 本地配置、表结构、RLS、Realtime
├── skills/short-drama-creation-master # 原始通用视频创作 Skill
├── evals                             # 12 类视频评测
└── ci/storyforge-ci.yml              # GitHub Actions 工作流模板
```

发布仓库时，将 `ci/storyforge-ci.yml` 放到 `.github/workflows/ci.yml` 即可启用完整 CI。执行该路径变更的 GitHub 凭据必须具有 `workflow` scope。

## Skill 是唯一创作规则来源

应用没有复制一份隐藏 Prompt。`skills/short-drama-creation-master` 中的 Markdown 是唯一规则来源。

构建时运行：

```bash
pnpm skill:compile
```

脚本会收集 Skill 和参考文档，生成带 SHA-256 版本号的 Prompt Bundle。每次运行记录 `skillVersion`，因此可以知道某个制作包到底使用了哪一版创作规则。

## 安全设计

- 公开演示不会调用付费 API。
- 真实运行无需 GitHub 登录；本地模式验证 API Key 后直接启动。
- 云端模式使用 Supabase 匿名会话隔离每位用户的数据，也可以按部署需要增加 GitHub 登录。
- 本地模式不持久化 API Key，只在当前服务端任务的内存中使用，任务结束后立即释放。
- 云端模式使用 AES-256-GCM 加密 API Key，最多保留一小时，任务结束后立即删除。
- 两种模式都不会把密钥写入浏览器存储、日志或 Agent trace。
- Supabase RLS 限制项目、运行、镜头、资产、事件和凭据只能由所有者访问。
- `run_events` 强制保存清洗后的事件，不保存隐藏推理。
- 每次运行限制 Token、费用、图片数、视频秒数和自动重试次数。
- 内容拒绝不会通过改写敏感词来规避审核。

## Provider Hub

“连接模型”不是一个写死的 OpenAI 输入框。LLM、图片和视频可以分别选择供应商、模型、Base URL 和 API Key：

| 类型 | 内置接入 |
|---|---|
| LLM | OpenAI、Anthropic Claude、Google Gemini、DeepSeek、通义千问、Kimi、Groq、Mistral、xAI、OpenRouter、Together、SiliconFlow、自定义 OpenAI-compatible |
| 图片 | OpenAI Images、Replicate、fal、Runway、自定义 OpenAI Images-compatible |
| 视频 | OpenAI Video、Replicate、fal、Runway、自定义 OpenAI Video-compatible |

OpenAI 使用 Agents SDK 和 Responses API；Anthropic 使用原生 Messages API；其余 LLM 通过可配置的 OpenAI-compatible Chat Completions 接入。结构化输出会依次尝试严格 JSON Schema、JSON Object 和普通 JSON，兼容只实现了部分 `response_format` 的服务。Gemini、DeepSeek 和阿里云均有官方兼容接口说明：[Gemini](https://ai.google.dev/gemini-api/docs/openai)、[DeepSeek](https://api-docs.deepseek.com/quick_start/pricing)、[阿里云百炼](https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope)。

Replicate、fal 和 Runway 使用异步任务 ID，因此可覆盖这些平台托管的大量图片与视频模型，不需要在 StoryForge 里为每个模型复制一套工作流。参考：[Replicate Predictions](https://replicate.com/docs/reference/http/)、[fal Queue](https://fal.ai/docs/documentation/model-apis/inference/queue)、[Runway API](https://docs.dev.runwayml.com/api/)。

图片和视频默认关闭。只有用户主动开启并填写数量或秒数上限后，系统才会提交付费媒体任务；失败时文本制作包仍会完成，相关项目保留为 `prompt-only` 或 `deferred`。

## 评测结果

夹具评测覆盖短剧、广告、MV、预告片、宣传片、纪录片、教程、解释视频、品牌故事、社交短视频、美食片和世界观视频。

| 指标 | 结果 |
|---|---:|
| 用例数 | 12 |
| 结构合法率 | 100% |
| 时间闭合率 | 100% |
| 资产引用正确率 | 100% |
| 平均 QA | 96/100 |
| 演示费用 | $0.00 |

完整结果在 [`evals/results/latest.md`](evals/results/latest.md)。这些是确定性夹具结果；提供测试密钥后，应另外记录真实模型的质量、延迟和费用。

## 部署

1. 在 Supabase 创建项目并执行 `supabase/migrations`。
2. 在 Supabase Auth 开启 Anonymous Sign-Ins；GitHub Provider 是可选项。
3. 在 Trigger.dev 创建项目并部署 `trigger/tasks`。
4. 在 Vercel 导入仓库，按 `.env.example` 配置环境变量。
5. 使用 `openssl rand -hex 32` 生成 `CREDENTIAL_ENCRYPTION_KEY`。

本地 Supabase：

```bash
supabase start
supabase db reset
```

本地 Trigger.dev：

```bash
pnpm dlx trigger.dev@latest dev
```

## 单独安装 Codex Skill

应用之外，原始 Skill 仍然可以单独安装：

```text
使用 $skill-installer 安装：
https://github.com/eventlp02-commits/storyforge-agent/tree/main/skills/short-drama-creation-master
```

手动安装：

```bash
git clone https://github.com/eventlp02-commits/storyforge-agent.git
cp -R storyforge-agent/skills/short-drama-creation-master ~/.codex/skills/
```

## 关键技术决策

- 固定 DAG：流程可测试、可观察、可重跑，模型不会自行改变交付标准。
- 结构化阶段协议：Zod 在边界上发现错误，不把自由文本错误传给下游。
- Skill 编译：创作规则和应用代码不会静默漂移。
- 本地演示与云端运行共用数据协议：招聘方不需要密钥，真实用户也不用换一套界面。
- Provider Hub：LLM、图片和视频共用一套安全配置协议，厂商预设和自定义 HTTPS 端点并存。
- 兼容性降级：密钥探测只在厂商明确返回 401 时判为无效；403、公司代理、网络异常或健康检查不兼容时交给首次真实请求确认。

## 简历描述

> 独立设计并实现 StoryForge Agent，一套从一句话生成视频制作包的全栈多 Agent 系统。使用 Next.js、Zod、Trigger.dev、Supabase 和可扩展 Provider Hub，接入 OpenAI、Anthropic、Gemini、DeepSeek、Qwen、Replicate、fal、Runway 等 LLM/图片/视频 API；实现固定 DAG、结构化阶段协议、实时可视化、BYOK 加密、断线恢复、定向重试和多格式导出，并建立 12 类视频自动评测与 Playwright 端到端测试。

## 说明

《星脉之歌》的角色、城市、种族和资产均为本项目原创演示内容。仓库不包含第三方影视、动漫或游戏角色资产。
