# Provider Adaptation

## Canonical Intent First

Keep the shot's creative intent independent from provider syntax:

- scene job and emotional change
- subject and opening state
- action phases and end state
- camera, light, environment, dialogue, and sound
- reference roles and continuity mode

Render that intent into the target model's accepted syntax only after the shot is coherent.

## Check When It Matters

Verify current official documentation when the result depends on:

- supported duration and aspect ratio
- image, video, or audio reference count
- first-frame, last-frame, extension, or edit modes
- native dialogue, sound effects, or music generation
- prompt language or structured parameter syntax
- negative-prompt support

Model capabilities change. Do not copy limits from memory into the prompt as facts.

## Adaptation Rules

- Use the provider's native reference tokens; do not expose internal filenames.
- Remove unsupported audio instructions rather than implying they will execute.
- Convert unsupported complex timing into ordered causal beats.
- Keep technical parameters in API fields or UI controls when the provider separates them from prompt text.
- Use negative prompts only when supported and only for likely failures.
- Preserve the same canonical action and continuity state across provider variants.

## Unknown Provider

Write a provider-neutral natural-language prompt. State any important assumption outside the prompt. Do not invent reference syntax, parameter names, or maximum durations.
