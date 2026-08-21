# AI 视频提示词导演 v2

这是一个专注于 AI 视频生成提示词撰写、续写、诊断和修订的 Codex Skill。

v2 保留了原版最有效的能力：

- 真实生成结果优先，而不是盲目相信计划结尾
- 导演四问：场景任务、镜头、光线和声音
- 每段使用从 `0秒` 开始的局部时间轴
- 制作分析与可复制提示词严格分离
- 动作阶段、屏幕方向、机位、光线和声音连续性
- 自动拦截内部 ID、文件名、路径、Markdown 标题和制作说明

同时移除了项目脚手架、完整制片包、Word 文档、资产生产和强制串行 Clip 管理，让 Skill 只负责一件事：写出可直接提交给视频模型的高质量提示词。

## 适用场景

- 文生视频
- 图生视频
- 参考图或参考视频驱动的视频生成
- 上一段真实视频的连续续写
- 独立镜头、广告覆盖镜头、MV 蒙太奇和 B-roll
- 提示词失败诊断与定向修订
- 面向不同视频模型的提示词适配

## 连续性模式

v2 不再强迫所有镜头按单一链条串行生成。

- `Continuous`：连续动作，必须依据上一段真实结果续写。
- `Motivated cut`：有动机的切镜，保留相关人物和故事状态。
- `Independent`：独立镜头，可并行撰写和生成。

## 安装

```bash
git clone https://github.com/eventlp02-commits/storyforge-agent.git \
  ~/.codex/skills/short-drama-creation-master
```

新建 Codex 任务后使用：

```text
使用 $short-drama-creation-master，把这个故事片段写成 15 秒、16:9、可直接用于视频模型的提示词。
```

续写真实视频：

```text
使用 $short-drama-creation-master，检查这个视频最后一个稳定画面，并从真实动作阶段续写下一段。
```

## 输出原则

默认只输出可复制提示词，不附加标题、解释、内部资产编号、文件名、路径或复制说明。只有用户明确要求时，才额外提供分析、备选方案或镜头计划。

## 提示词校验

```bash
python3 scripts/validate_prompt.py prompt.txt --duration 15
```

校验器会检查：

- 第一段是否从 0 开始
- 时间区间是否连续、重叠或超出时长
- 最后一段是否准确结束在目标时长
- 是否泄露制作说明、内部 ID、文件名或本地路径

## 测试

```bash
python3 -m unittest discover -s tests -v
```

## 目录

```text
SKILL.md
agents/openai.yaml
references/
  continuity.md
  example.md
  prompt-contract.md
  provider-adaptation.md
  quality-gates.md
scripts/validate_prompt.py
tests/test_validate_prompt.py
```
