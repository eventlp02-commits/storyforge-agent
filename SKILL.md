---
name: short-drama-creation-master
description: Iterative, end-to-end video creation for narrative shorts, commercials, social videos, music videos, trailers, promos, documentaries, explainers, and world-showcase films. Use when turning an idea or references into a brief, script, director plan, one production clip at a time, copy-ready image or video prompts, actual-end continuity analysis, character or scene assets, Word documents, or packaged deliverables. Especially use when the next video clip must continue from the real generated ending rather than a prewritten assumption.
---

# 通用短剧创作大师

## Purpose

Create videos through a verified clip loop:

`plan current clip -> write prompt -> obtain real result -> inspect actual ending -> lock continuity -> write next clip`

Treat the real generated result as the source of truth. A script may describe the full story, but executable video prompts must be authored one clip at a time.

## Read References Selectively

- Read `references/clip-loop.md` before creating or continuing any multi-clip project.
- Read `references/prompt-spec.md` before writing image or video generation prompts.
- Read `references/project-types.md` when choosing structure and pacing for a format.
- Read `references/originality-safety.md` when references, known IP, public figures, platform review, or sensitive content are involved.
- Read `references/delivery-qa.md` before creating Word files, packaging outputs, or declaring completion.

## Non-Negotiable Rules

1. Write only the current executable video Clip.
2. Do not write Clip N+1 until Clip N's real output has been inspected and its actual end state is locked.
3. Start every Clip at `0秒`. Never carry cumulative timecodes into the next Clip.
4. Answer the Director's Four Questions internally before writing a Clip:
   - What is the scene doing?
   - How does the camera express it?
   - What does the light contribute?
   - What does the sound contribute?
5. Keep Director Card analysis out of copy-ready prompt files unless the user explicitly asks to see it.
6. Keep copy-ready prompt files free of explanations, workflow notes, status labels, internal asset IDs, filenames, paths, and backtick-wrapped production references.
7. Never include headings or fields named `资产引用` or `Asset calls` in user-facing prompt documents.
8. Never put strings such as `REF-001`, `CHR-001`, `prompt-only`, `.png`, `.jpg`, `.mp4`, or local paths inside generation prompts.
9. Use model-recognizable references such as `@图片1`, `@视频1`, and `@音频1`, and state the purpose of each reference.
10. Make action change according to story causality. Preserve identity, not identical poses.
11. Do not invent an actual ending when no generated result is available.
12. Do not attempt to evade platform review. Rewrite for originality and safe depiction when needed.

## Separate Production Material From Model Input

Maintain two output surfaces.

### Internal Production Material

May contain:

- brief, story route, full script, Director Cards, continuity analysis
- internal asset registry, source paths, filenames, generation status
- actual end-state records, QA notes, edit notes, and packaging metadata

### Copy-Ready Model Input

May contain only:

- model-native media references and their visual or audio purpose
- scene, subject, action, camera, light, environment, dialogue, and sound instructions
- current Clip's local time intervals starting at 0
- continuity instructions derived from the prior real result
- concrete failure-prevention instructions relevant to the current Clip

Place each Clip prompt in a standalone plain-text file. If a Word prompt document is requested, keep each copy-ready prompt block free of surrounding explanation.

## Delivery Modes

Infer the smallest mode that satisfies the request.

| Mode | Deliverables |
|---|---|
| Quick | Brief, story route, script or outline, and current Clip prompt when requested |
| Standard | Quick mode plus Director Card, local shot plan, current Clip prompt, and actual-end continuity record |
| Full production | Standard mode plus internal asset plan, optional generated assets, polished documents, QA, and package |

All modes obey the one-Clip-at-a-time rule.

## Workflow

### 1. Resolve The Brief

Extract or reasonably infer:

- goal, audience, platform, project type, target total duration, and Clip duration
- aspect ratio, language, visual style, tone, pacing, and narrative density
- dialogue, narration, music, ambience, synchronized sound, and silence policy
- supplied references, target models, requested files, and generation responsibilities

Ask only blocking questions. Keep assumptions in the internal brief, never in the copy-ready prompt.

### 2. Build The Story Route

Create:

- logline, dramatic or communication goal, emotional arc, and ending direction
- ordered story beats or chapter jobs
- world, brand, character, or subject rules
- visual, camera, lighting, motion, and sound grammar
- continuity anchors for identity, wardrobe, props, geography, weather, and time

The Story Route is directional, not an executable prompt archive. Identify future Clip jobs without writing their detailed actions, camera paths, local time intervals, or model prompts.

### 3. Select The Current Clip

For a new project, select Clip 01.

For Clip 02 or later:

1. Require the prior Clip's real video, key frames, or otherwise inspectable output.
2. Inspect the last stable visual state and available audio tail.
3. Record the actual duration and actual end state.
4. Treat actual output as authoritative when it differs from the plan.
5. Continue only after the prior Clip is `end_locked` or `completed`.

If the prior result is unavailable or unreadable, stop at `waiting_for_result`. Do not draft the next executable prompt.

### 4. Direct The Current Clip

Create an internal Director Card using `references/clip-loop.md`.

Resolve:

- one primary scene job and at most one secondary job
- start state inherited from real footage or the project's opening state
- subject blocking and action phases
- framing, camera position, movement, and reveal strategy
- time, direction, hardness, color, and change of light
- ambience, synchronized effects, dialogue, silence, and music behavior
- a target end state that gives the next Clip a usable handoff

Reject pose-only planning. Define how the subject's body, gaze, position, environment, and camera state change through the Clip.

### 5. Write The Current Clip Prompt

Follow `references/prompt-spec.md`.

- Start the first interval at 0.
- Keep all intervals local to the current Clip.
- Make intervals contiguous and end exactly at the current Clip duration.
- Use explicit temporal action rather than a static appearance description.
- Give each `@` reference one clear role.
- Integrate camera, light, and sound with the scene's job.
- Keep content load achievable for the duration.
- Include only current-Clip instructions.

Run the prompt purity check before delivery.

### 6. Generate Or Hand Off The Current Clip

When a compatible video provider is available and the user requests generation, submit only the current Clip. Otherwise deliver the current Clip's standalone prompt for the user to generate.

Set the state to `waiting_for_result`. Do not proceed to the next prompt based on the intended ending.

### 7. Inspect The Real Result

When the result is available:

- read actual duration
- inspect several frames near the ending and choose the last stable, usable handoff
- inspect dialogue and sound tail when audio is accessible
- record subject identity, pose, gaze, screen position, action phase, and movement direction
- record framing, camera position, camera movement tail, and screen direction
- record light direction, contrast, color state, weather, environment, props, effects, and damage or transformation state
- record plan-versus-result deviations

Mark the result `end_locked`. Only then may the next Clip enter directing.

### 8. Continue From The Actual Ending

Begin the next prompt from the locked actual state.

- Continue an unfinished action from its current phase.
- Show consequences when an action has already completed.
- Do not replay entrances, attacks, turns, reveals, or reactions without a narrative cause.
- Preserve screen direction unless the camera visibly crosses the axis.
- Carry sound through a sound bridge or cut it deliberately.
- Preserve light and weather unless the change is shown or motivated.

Reset the next Clip's first timecode to 0.

### 9. Plan Or Generate Image Assets

Keep internal asset management separate from model prompts.

- Inspect user references before generation.
- Preserve requested identity while allowing action, pose, framing, and expression to change.
- Use design sheets for reusable identity and scene assets.
- Use storyboard panels only when explicitly requested.
- Generate in reviewable groups and inspect each result.
- Never imply an ungenerated asset exists.

If the user stops image generation, stop immediately, preserve completed images, keep unfinished items internal, and continue text work unless the user also stops it. Do not insert generation statuses into copy-ready prompts.

### 10. Create Documents And Packages

Use a supplied Word document as the format reference when available. Otherwise separate:

- production guide: brief, script, story route, Director Cards, continuity, internal asset plan, and QA
- prompt document: copy-ready prompt text only

For `.docx`, invoke the documents skill and follow its render-and-verify workflow. Keep temporary renders outside the delivery directory.

### 11. Verify

Apply `references/delivery-qa.md`.

At minimum verify:

- only the current executable Clip exists
- previous actual-end evidence exists for Clip 02 and later
- each Clip's local timing starts at 0 and ends at its own duration
- prompt text contains no forbidden explanations, IDs, filenames, or paths
- actions change logically across intervals and do not reset across Clips
- camera, light, and sound serve the Clip's scene job
- Word and archive files open, render, and extract correctly

## Project Utilities

Create a clip-loop project:

```bash
python3 scripts/init_video_project.py \
  --output <folder> \
  --title "Project Title" \
  --type narrative-short \
  --duration 90 \
  --clip-duration 15 \
  --aspect 16:9 \
  --language zh-CN
```

Validate project state, local timing, continuation gates, and prompt purity:

```bash
python3 scripts/validate_video_project.py <folder>
```

Create the next Clip after locking the prior real ending:

```bash
python3 scripts/create_next_clip.py <folder> --duration 15
```

Lint a standalone prompt:

```bash
python3 scripts/lint_copy_ready_prompt.py <prompt.txt> --duration 15
```

Use utility output to support editorial judgment. Still inspect the real video and rendered documents.
