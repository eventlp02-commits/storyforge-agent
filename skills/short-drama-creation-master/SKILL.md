---
name: short-drama-creation-master
description: End-to-end video project creation for commercials, narrative shorts, social videos, music videos, trailers, promos, documentaries, explainers, and world-showcase films. Use when a user wants a concept developed or revised into a creative brief, world or brand bible, script, dialogue, timed shot list, generation prompts, character/scene/prop assets, asset manifest, Word production guide, or packaged deliverables, including projects based on supplied references and projects where image generation may be paused or stopped mid-workflow.
---

# 通用短剧创作大师

## Purpose

Turn a video idea into a production-ready package while preserving timing, visual continuity, audio intent, originality, and traceable asset use. Support live action, animation, CG, AI-generated video, and hybrid production. Adapt the workflow to the requested format instead of forcing every project into a cinematic or music-video structure.

## Load References Selectively

- Read `references/project-types.md` when choosing structure, pacing, or deliverables for a format.
- Read `references/prompt-spec.md` before writing shot prompts, segment prompts, image-asset prompts, or continuity locks.
- Read `references/originality-safety.md` when references, known IP, public figures, platform review, or sensitive content are involved.
- Read `references/delivery-qa.md` before creating a Word document, packaging assets, or declaring completion.

## Choose The Delivery Mode

Infer the smallest mode that satisfies the request. State the choice briefly and proceed unless a missing decision would materially change the result.

| Mode | Deliverables |
|---|---|
| Quick | Creative direction, structure, and script or outline |
| Standard | Quick mode plus timed shot list and generation prompts |
| Full production | Standard mode plus asset plan, optional generated assets, asset registry, polished document, QA, and packaged folder |

## Workflow

### 1. Resolve The Brief

Extract or reasonably infer:

- goal, audience, platform, project type, duration, aspect ratio, and language
- visual style, tone, pacing, narrative density, and call to action
- dialogue, narration, music, ambient sound, and generated-audio policy
- required files, reference materials, generation tools, and delivery deadline

Ask only blocking questions. Record consequential assumptions in the brief so they can be revised later.

### 2. Establish Creative Foundations

Create the minimum foundation needed for the selected format:

- logline, core promise, emotional arc, and visual thesis
- beat sheet divided into exact time ranges
- original world, brand, character, or subject rules
- visual style lock: rendering approach, palette, materials, lighting, lens language, and motion grammar
- continuity anchors for faces, silhouettes, wardrobe, props, architecture, geography, time, and weather

Use `references/project-types.md` to avoid applying narrative-film conventions to ads, explainers, documentaries, or montage pieces.

### 3. Build The Timing Model

Make segment durations sum exactly to the requested runtime. Then subdivide segments into shots whose start and end times are contiguous.

Never assume a fixed clip duration, segment count, or shot count. Prefer enough shots to make the intended rhythm legible, but do not use rapid cutting to compensate for weak action design. For each segment, define its dramatic job, visual escalation, audio transition, and outgoing match point.

### 4. Write The Script

Write action, narration, dialogue, supers, and transitions in the user's preferred language. Keep dialogue character-specific and playable within the allocated time. Separate spoken content from visual description and sound design.

For factual or documentary material, distinguish verified facts from creative reconstruction. Browse authoritative sources when current facts, platform specifications, laws, prices, or other unstable details matter.

### 5. Design The Shot List

For every shot specify:

- shot ID, start/end time, duration, scene, and dramatic purpose
- framing, lens feel, camera position, camera movement, and subject blocking
- visible action, environment response, lighting, atmosphere, and transition
- dialogue or narration, sound effects, music intent, and silence
- continuity notes and exact asset IDs
- generation prompt and any model-specific constraints

Use the schema in `references/prompt-spec.md`. Also create one consolidated prompt per generation unit when the target video model consumes a full clip rather than separate shot prompts.

### 6. Plan Assets Before Generating Them

Create an asset manifest before image generation. Separate:

- characters and state variants
- species, crowds, costumes, and makeup
- locations, geography, architecture, and interiors
- props, vehicles, food, plants, creatures, products, and effects
- graphics, titles, logos, maps, and interface elements

Prioritize reusable continuity assets over decorative one-offs. Asset images are not storyboard frames: use neutral or informative compositions that reveal design, scale, material, and variants. Generate storyboard images only when explicitly requested.

### 7. Generate Or Curate Assets

Use the `imagegen` skill for bitmap creation or editing. Inspect supplied references before generating. Keep prompts original and use asset IDs in filenames and shot references.

Generate in small, reviewable groups. Validate visual coherence after each group and update the manifest immediately. Never imply that an ungenerated asset exists.

If the user says to pause or stop image generation:

1. Stop active generation work immediately.
2. Preserve every completed asset without regenerating it.
3. Mark unfinished items as `prompt-only`, `deferred`, or `cancelled`.
4. Remove nonexistent asset IDs from active shot calls or label them optional.
5. Continue the script, prompts, document, QA, and packaging unless the user also stops those tasks.

### 8. Assemble The Prompt Package

Write prompts from broad locks to local action:

1. project-wide style and originality lock
2. character, location, prop, and effect locks
3. segment prompt with exact timing
4. shot-level prompt with camera, action, environment, sound, and transition
5. exclusions and failure prevention

Do not claim current platform limits from memory. If exact model syntax, duration limits, safety rules, or audio capabilities matter, check current official documentation.

### 9. Create Deliverables

Use a user-supplied document as the format reference when available. Otherwise create a clean production guide containing:

- project brief and assumptions
- creative foundation or world/brand bible
- character and continuity bible
- full script and exact timing summary
- timed shot prompts and consolidated clip prompts
- asset registry with statuses and shot calls
- editing, audio, caption, and delivery notes
- continuity and final QA checklist

For `.docx`, invoke the documents skill and follow its render-and-verify workflow. Package only final user-facing files; keep temporary render folders outside the delivery directory.

### 10. Verify Before Delivery

Apply `references/delivery-qa.md`. At minimum verify:

- total runtime, segment timing, shot continuity, and shot count
- dialogue fit, language, audio policy, and caption consistency
- asset IDs, file existence, status truthfulness, and prompt/archive alignment
- originality, sensitive-content wording, and absence of unintended protected names
- document integrity, page rendering, typography, image quality, and archive extraction

Do not declare completion until the final files have been opened or parsed successfully and visually inspected where layout matters.

## Project Utilities

Create a reusable project structure:

```bash
python3 scripts/init_video_project.py --output <folder> --title "Project Title" --type narrative-short --duration 90 --aspect 16:9 --language zh-CN
```

Validate timing, IDs, asset references, and declared outputs:

```bash
python3 scripts/validate_video_project.py <folder>
```

Treat utility output as support for editorial judgment, not a substitute for reading the script or inspecting images and rendered documents.
