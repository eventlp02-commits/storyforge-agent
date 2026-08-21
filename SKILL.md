---
name: short-drama-creation-master
description: Use when a user needs copy-ready prompts for text-to-video, image-to-video, reference-to-video, video continuation, shot variants, or diagnosis and revision of an AI video prompt.
metadata:
  version: "2.0.0"
---

# AI Video Prompt Director v2

## Purpose

Turn an idea, script beat, image, or prior generated video into the smallest executable prompt that gives the target video model a clear scene job, achievable motion, intentional camera, motivated light, usable sound, and a stable ending.

Optimize for generation, not production paperwork. Do not create a full production package, asset registry, Word document, or project scaffold unless the user separately requests one.

## Read References Selectively

- Read [references/prompt-contract.md](references/prompt-contract.md) before writing or revising any video prompt.
- Read [references/continuity.md](references/continuity.md) for video continuation, multi-shot work, or any request using a prior result.
- Read [references/provider-adaptation.md](references/provider-adaptation.md) when a target model is named or platform limits affect the prompt.
- Read [references/quality-gates.md](references/quality-gates.md) before delivery.
- Read [references/example.md](references/example.md) only when a concrete prompt pattern would resolve ambiguity.

## Output Contract

Default to the copy-ready prompt only. Do not surround it with analysis, headings, explanations, copying instructions, internal IDs, filenames, local paths, or status notes.

If the user asks for analysis, alternatives, or a shot plan, keep those outside the copy-ready prompt and clearly separate them. Never force the user to delete production commentary before pasting the prompt into a model.

## Resolve Only What Changes The Prompt

Determine or reasonably infer:

- target model and generation mode
- duration, aspect ratio, language, and audio capability
- subject, scene job, opening state, and desired ending
- supplied images, videos, or audio and the role of each reference
- whether the shot is continuous, a motivated cut, or independent

Ask only when missing information would materially change the executable prompt. When the target model is unknown, write a provider-neutral prompt and do not invent platform limits.

## Direct Internally

Before writing, answer these questions internally:

1. What changes during this shot?
2. How do blocking and camera make that change readable?
3. What does light reveal, hide, or transform?
4. What should be heard, synchronized, carried, or deliberately absent?

Choose one primary scene job. Add at most one secondary job when the duration can support it. Preserve identity, not a frozen pose.

## Choose The Continuity Mode

- **Continuous:** A prior real video or inspectable ending is required. Start from its last stable usable state.
- **Motivated cut:** Preserve relevant identity, world, time, and story state; explicitly design the new angle or location transition.
- **Independent:** Do not require a previous ending. Preserve only the references and creative bible the user supplies.

Do not force ads, montages, interviews, tutorials, or coverage shots into a continuous chain. Do not claim continuity from an intended ending when no real result is available.

## Write The Prompt

Use this order when applicable:

1. Model-native references and one clear role for each.
2. Opening state or continuity anchor.
3. Local timed beats beginning at 0.
4. Subject action and environmental response.
5. Framing, camera position, movement, and reveal.
6. Light source, direction, quality, color relationship, and change.
7. Dialogue, ambience, synchronized effects, music, or silence.
8. A stable, useful end state.
9. A short set of failure-prevention constraints tied to likely model errors.

Describe change over time, not a static image. Keep time intervals contiguous and end exactly at the requested duration. Put dialogue and sound in the interval where they occur. Avoid incompatible piles of action, camera moves, location changes, transformations, effects, and long dialogue.

## Adapt To The Target Model

Use only syntax and capabilities supported by the named model. Translate internal reference roles into that model's native syntax. If current limits matter and are unknown, verify official documentation or state the assumption outside the prompt; never bake an unverified platform claim into model input.

Keep a provider-neutral creative intent internally so the same shot can be rendered for another model without rewriting the story logic.

## Continue From Real Output

For continuous shots:

1. Inspect the real result or supplied ending frames.
2. Lock the last stable state: subject identity, pose, gaze, screen position, movement direction, action phase, camera axis, framing, light, environment, props, effects, and audio tail.
3. Record plan-versus-result deviations internally.
4. Begin the next prompt from the locked state.

Continue an unfinished action from its current phase. If an action finished, show its consequence. Do not replay entrances, attacks, turns, falls, reveals, or reactions without a new cause.

If the prior result is unavailable or unreadable, write only a provisional opening option when useful and label it outside the prompt. Do not present it as verified continuation.

## Revise Existing Prompts

Diagnose the smallest cause of failure before rewriting:

- identity drift or reference conflict
- overloaded action or dialogue
- ambiguous blocking or screen direction
- competing subject and camera motion
- unmotivated light or environment change
- weak ending state
- provider-incompatible syntax
- explanatory text leaking into model input

Preserve requirements that already work. Revise only the instructions connected to the observed failure.

## Verify Before Delivery

Apply [references/quality-gates.md](references/quality-gates.md). For timed prompts, run:

```bash
python3 scripts/validate_prompt.py <prompt.txt> --duration <seconds>
```

The validator supports editorial judgment; it does not replace visual inspection of generated video.
