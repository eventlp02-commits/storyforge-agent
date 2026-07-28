# Copy-Ready Prompt Specification

## Contents

- Prompt boundary
- Video Clip prompt
- Local timing
- Reference syntax
- Action and camera design
- Light and sound
- Image prompt
- Forbidden content
- Internal asset separation

## Prompt Boundary

A copy-ready prompt is model input, not a production memo. Put only executable generation instructions in the prompt file.

Keep these elsewhere:

- brief, story route, Director Card, assumptions, and creative explanation
- internal IDs, asset registry, source paths, filenames, and generation status
- QA findings, user instructions, handoff notes, and delivery commentary

Do not add an introductory paragraph, copying instructions, reference legend, or explanation above or below the prompt.

## Video Clip Prompt

Build the prompt in this order:

1. model-native references and their roles
2. opening continuity state
3. local timed action with camera, light, environment, and sound
4. dialogue or narration at the moment it occurs
5. ending state and relevant failure prevention

Example structure for a 15-second Clip:

```text
以@视频1最后一个稳定画面为开场，保持人物站位、身体朝向、机位高度、画面轴线和冷暖光关系不变。@图片1锁定主角的面部、发型、服装和武器造型，@图片2锁定大厅的柱列、台阶与门窗结构。

0-3秒：主角保持半蹲，右手撑地，先抬眼看向画面左上方；镜头维持低机位近景并缓慢后移，石屑从肩甲落下，远处风声贴着空旷大厅回旋。
3-7秒：主角借左腿发力站起并把武器拉到身侧，动作从恢复进入戒备；镜头后移成中景，门外冷光在地面延长，室内烛火轻微摇晃，只保留甲片摩擦与脚底擦过石面的声音。
7-11秒：画面左侧高处出现移动阴影，主角立即转肩而不是重复起身；镜头顺着他的视线小幅上摇，冷光压暗面部下半部，一声短促金属碰响从高处传来。
11-15秒：阴影停在柱顶边缘，主角将武器横在胸前并稳定重心；镜头停止移动形成低角度双层构图，环境声突然收窄，只留下呼吸、布料和高处细小碎石落地声，结尾保持双方位置清楚可接续。

语言：中文。无配乐。对白与口型严格同步。保持人物身份、服装、武器、空间结构和屏幕方向稳定；动作连续，不重复起身，不瞬移，不突然改变机位侧别。
```

The example is instructional. For delivered prompt files, output only the actual prompt body.

## Local Timing

Every Clip has an independent local timeline.

Correct:

```text
Clip 01: 0-4秒，4-9秒，9-15秒
Clip 02: 0-3秒，3-8秒，8-15秒
```

Incorrect:

```text
Clip 01: 0-15秒
Clip 02: 15-30秒
```

Requirements:

- first interval starts at 0
- intervals are ordered, contiguous, and non-overlapping
- final interval ends at the current Clip duration
- no interval exceeds the current Clip duration
- do not use project-global timecodes in copy-ready prompts

## Reference Syntax

Use the target model's recognizable positional references:

- `@图片1` for character, scene, prop, composition, first frame, or style
- `@视频1` for motion, continuation, camera, rhythm, or last-frame state
- `@音频1` for timing, voice, ambience, or music reference

Assign each reference a clear role in natural instructions:

```text
@图片1锁定人物外观，@图片2锁定场景结构，以@视频1最后一个稳定画面为动作起点。
```

Do not expose internal filenames, source paths, asset IDs, or upload notes.

## Action And Camera Design

Describe temporal progression, not a static pose.

For each interval specify:

- the action phase at the start
- what physically changes
- where the subject ends
- how the environment responds
- framing, position, and camera movement
- the information or emotion revealed by the shot

Keep subject and camera motion compatible. Do not combine a complex fight, large orbit, rapid zoom, location change, transformation, and long dialogue in one short interval.

Use action phases to prevent repetition:

```text
anticipation -> initiation -> travel -> contact -> reaction -> recovery -> consequence
```

Continue from the inherited phase. Do not restart the action.

## Light And Sound

Light instructions should state useful causes and changes:

- time or practical source
- direction
- soft or hard quality
- warm or cool relationship
- exposure or contrast change
- interaction with faces, surfaces, weather, smoke, dust, or effects

Sound instructions should distinguish:

- spoken language, speaker, voice quality, and delivery
- ambience
- synchronized movement and impact sounds
- silence or sound narrowing
- music, no music, or music behavior

Place sound cues in the time interval where they occur. Do not assume music is required.

## Image Prompt

Image prompts must also be copy-ready and free of production commentary.

Use:

```text
主体与用途、构图或视图、动作或姿态、外观锚点、材质与色彩、场景与尺度、光线、风格、画幅、必要的失败规避。
```

For identity sheets, request readable neutral views. For storyboard panels, change pose, action, camera, and composition according to the actual shot while preserving identity.

Do not include internal IDs, filenames, “仅提示词”, “参考图说明”, or asset-management status.

## Forbidden Content

Copy-ready prompt text must not contain:

- `资产引用`
- `Asset calls`
- `prompt-only`
- `REF-001`, `CHR-001`, `LOC-001`, `PRP-001`, `FX-001`, or similar internal IDs
- `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.mp4`, `.mov`, `.wav`, `.mp3`, `.docx`, or filesystem paths
- “直接使用用户图”
- “直接引用”
- “上图只是”
- “以下正文保留”
- “实际生成时必须分别引用”
- “这是给用户的说明”
- generation status, packaging notes, explanations, or apologies

Do not disguise these items. Remove them and write the model instruction directly.

## Internal Asset Separation

Internal asset registries may use stable IDs and filenames. Maintain a private mapping from internal assets to upload order:

```json
{
  "character_main": "@图片1",
  "location_hall": "@图片2",
  "previous_clip": "@视频1"
}
```

Only the `@` references and their purposes appear in copy-ready prompts.
