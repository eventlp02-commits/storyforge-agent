# Delivery And Quality Gates

## Delivery Structure

Recommended internal structure:

```text
project-name/
  project.json
  01_brief/
  02_writing/
  03_clips/
    CLIP-01/
      clip.json
      director_card.json
      prompt.txt
      result/
      actual_end_state.json
  04_assets/
    references/
    generated/
    asset_manifest.csv
  05_deliverables/
  99_work/
```

Keep prompt files separate from production explanations.

## Current-Clip Gate

- Only the current Clip has an executable prompt in progress.
- Future story beats may exist, but future executable prompts do not.
- Clip 02 and later have a prior real result and locked actual end state.
- The current Clip's start state matches the prior actual end state.
- The current prompt does not replay a completed action.

## Local Timing Gate

- Every Clip starts at 0.
- Intervals within a Clip are ordered, contiguous, and non-negative.
- The last interval ends at the current Clip duration.
- No interval uses project-global cumulative time.
- Clip duration is validated independently from project target duration.
- Dialogue fits the current Clip at the intended delivery speed.

## Director Gate

- The Clip has one primary scene job.
- Camera framing, position, movement, and blocking express that job.
- Light direction, quality, color, and change express that job.
- Ambience, synchronized effects, dialogue, silence, and music express that job.
- Action changes across intervals and produces a usable ending state.

## Actual-End Gate

- Actual duration is recorded.
- The last stable handoff frame is identified.
- Subject pose, gaze, screen position, movement direction, and action phase are recorded.
- Camera framing, side of axis, height, and movement tail are recorded.
- Light, weather, environment, props, effects, and audio tail are recorded.
- Deviations from the planned ending are recorded.
- The real result overrides the planned ending.

## Prompt Purity Gate

- Prompt text contains only model-executable instructions.
- Every model-native reference has a clear role.
- No heading or field named `资产引用` or `Asset calls` appears.
- No internal asset ID appears.
- No filename, extension, local path, or backtick-wrapped production reference appears.
- No `prompt-only` or asset status appears.
- No user-facing explanation, workflow note, copying instruction, apology, or disclaimer appears.
- No future Clip prompt appears before the continuation gate is satisfied.

Run:

```bash
python3 scripts/lint_copy_ready_prompt.py <prompt.txt> --duration <seconds>
python3 scripts/validate_video_project.py <project-folder>
```

## Continuity Gate

- Identity, wardrobe, props, and location remain stable unless visibly changed.
- Pose and action evolve rather than remain identical.
- Screen direction and geography remain legible.
- Camera-axis changes are visible or motivated.
- Light and weather changes have a cause.
- Sound carries across space or cuts with clear intent.
- Damage, transformation, depletion, and environmental consequences persist.

## Content Load Gate

- The number of actions is achievable in the Clip duration.
- Camera movement does not compete with the key action.
- Dialogue does not cover essential visual beats.
- Effects support the scene job rather than obscure it.
- One short Clip does not attempt multiple locations or unrelated turns without a motivated transition.

## Asset Gate

- Internal manifest statuses match real files.
- Items marked `done` exist and were visually inspected.
- Reference upload order is mapped internally to `@图片N`, `@视频N`, or `@音频N`.
- Internal IDs and filenames do not leak into prompt text.
- Storyboard panels preserve identity while changing action, pose, camera, and composition as required.

## Document Gate

When creating a Word document:

1. Use the documents skill.
2. Apply the supplied template or create a restrained production layout.
3. Keep production analysis and copy-ready prompts in separate sections or separate files.
4. Ensure each copy-ready prompt block contains no explanatory text.
5. Use full-width blocks for long prompts rather than narrow table cells.
6. Render the complete document and inspect every page.
7. Check clipping, overlap, orphaned headings, spill pages, missing glyphs, broken tables, and distorted images.
8. Reopen the `.docx` through a structured parser.
9. Run prompt purity checks against the text extracted from prompt-only files or marked prompt blocks.

## Archive Gate

- Include only intended files.
- Exclude temporary renders, caches, duplicate generations, and hidden metadata.
- Verify extraction and Unicode filenames.
- Confirm each delivered prompt corresponds to a real current or completed Clip.
- Report unreadable results or intentionally deferred media without placing those notes inside prompt files.

## Completion Report

Keep the final user message concise. Link the PRD, production document, prompt file, and package as applicable. State:

- current Clip and status
- checks performed
- whether the prior real result was inspected
- anything not completed or not tested
