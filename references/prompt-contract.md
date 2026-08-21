# Prompt Contract

## Core Principle

A video prompt is executable model input. Every sentence must control a visible or audible result, establish a reference role, preserve continuity, or prevent a likely failure.

## Prompt Layers

Build only the layers the shot needs:

1. **Reference layer:** Assign each image, video, or audio reference one purpose. Avoid giving two references authority over the same identity unless the blend is intentional.
2. **Opening layer:** State subject position, pose, action phase, framing, camera side, light, environment, and relevant audio state.
3. **Temporal layer:** Divide the duration into contiguous beats beginning at 0. Each beat should advance the action or reveal.
4. **Directing layer:** Integrate blocking, camera, light, sound, and environmental response with the scene job.
5. **Ending layer:** Finish on a stable composition, action phase, or transition that serves editing or continuation.
6. **Constraint layer:** Include only concrete failure prevention, such as no repeated rise, no axis flip, stable product geometry, or synchronized mouth movement.

## Content Budget

- Up to 5 seconds: one action or reveal, one dominant camera behavior.
- 6-10 seconds: one action chain, at most one meaningful camera transition.
- 11-15 seconds: one complete dramatic unit, at most one primary turn.
- Longer shots: segment by causal beats, not by arbitrary equal time blocks.

Reduce content before adding more negative instructions. A short prompt with one readable event usually outperforms a dense list of simultaneous demands.

## Action Language

Track physical action through phases:

`anticipation -> initiation -> travel -> contact -> reaction -> recovery -> consequence`

Name the inherited phase for continuation. Specify what changes, where the subject ends, and how the environment responds. Avoid vague verbs such as “be cinematic,” “move naturally,” or “make it dynamic” unless paired with observable direction.

## Camera Language

Specify only useful camera information:

- framing and subject scale
- camera position, height, angle, and side of axis
- movement direction, speed, and stopping behavior
- what the move reveals or emotionally changes

Do not combine a complex subject action with an equally complex orbit, zoom, crane, and handheld shake unless chaos is the intentional scene job and the model can support it.

## Light And Sound

Light should have a source, direction, quality, and purpose. Describe changes through visible causes such as a door opening, cloud cover, passing vehicle, screen glow, fire, or explosion.

Sound should distinguish dialogue, ambience, synchronized effects, music, and deliberate silence. Put cues where they occur. Keep dialogue short enough for the duration and requested delivery speed.

## Reference Syntax

Use the target provider's native media-reference syntax. When a provider accepts ordered references, assign their roles naturally:

```text
@视频1用于继承上一段最后一个稳定画面的动作、站位和机位轴线；@图片1用于锁定主角的面部、发型和服装。
```

Internal filenames, asset IDs, upload instructions, and paths must not appear in the prompt.

## Forbidden Prompt Content

- production explanations, status notes, apologies, or copying instructions
- internal IDs such as `REF-001`, `CHR-001`, or `CLIP-02`
- filenames, extensions, local paths, or Markdown headings
- unverified claims about a model's limits or capabilities
- future shots unrelated to the current generation
- instructions intended to disguise prohibited or infringing content

## Default Delivery

When the user asks for a prompt, return only the copy-ready prompt. Provide rationale or assumptions only when requested or when an unresolved limitation must be disclosed; place them outside the prompt.
