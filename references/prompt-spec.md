# Prompt And Continuity Specification

## Contents

- Prompt layers
- Shot record
- Timed clip prompt
- Image asset prompt
- Audio specification
- Transition design
- Exclusion design
- Asset registry rules

## Prompt Layers

Write generation instructions in this order so reusable facts are not buried in shot prose.

### Global Style Lock

Include:

- medium and rendering approach
- realism or stylization level
- palette, contrast, material response, and lighting logic
- aspect ratio, frame rate, resolution target, and camera grammar
- motion quality, detail density, and compositing intent
- originality constraint and exclusions

Do not repeat the complete global lock in every asset prompt when a shared prefix or reference field is available. Archive the exact version used.

### Subject Lock

For each recurring character, product, creature, vehicle, or prop define:

- asset ID and canonical name
- silhouette, proportions, age range, face or form anchors
- materials, colors, wear, logos, and unique asymmetry
- fixed accessories and allowed state variants
- forbidden drift: hairstyle, hand count, costume swaps, scale changes, text mutation, or logo deformation

### Location Lock

Define architecture, floor plan or geography, scale references, materials, lighting sources, weather, population, signage, and entrances/exits. Record screen direction when characters move between shots.

### Effect Lock

Define source, color core, edge behavior, particle direction, interaction with surfaces, light spill, sound character, and dissipation. Effects must illuminate and disturb the environment rather than float independently.

## Shot Record

Each shot should provide the following fields:

```text
Shot ID:
Time:
Scene / purpose:
Asset calls:
Framing / lens feel:
Camera position and motion:
Blocking and visible action:
Environment and secondary motion:
Lighting / color / atmosphere:
Dialogue / narration / on-screen text:
Sound effects / ambience / music intent:
Transition and continuity:
Generation prompt:
Exclusions:
```

The generation prompt should be a coherent instruction, not a keyword dump. State the subject, action, camera, environment response, and temporal progression in that order.

## Timed Clip Prompt

When a video model consumes a full clip, organize the prompt by explicit intervals:

```text
Project-wide style and continuity lock.

00:00-00:03 - Establishing action, framing, camera path, ambience.
00:03-00:06 - Subject action and environmental response.
00:06-00:09 - Escalation or reveal, camera adjustment, sound cue.
00:09-00:12 - Payoff, dialogue or narration, transition setup.
00:12-00:15 - Closing action, end pose, outgoing match point.

Audio policy:
Continuity locks:
Exclusions:
```

Intervals may vary. Their total must equal the requested clip duration, and each interval must be visually achievable.

## Image Asset Prompt

Use this structure for design assets:

```text
Purpose: reusable production asset, not a storyboard frame.
Subject: [asset ID and canonical description].
Views: [front / side / back / detail / state variant / scale comparison].
Design: silhouette, proportions, materials, palette, functional details.
Presentation: neutral readable lighting, uncluttered background, consistent scale.
Style: project global lock.
Exclusions: no copyrighted names, no extra limbs, no unreadable labels, no random redesign.
```

Use environmental overview, cutaway, material callout, or scale-reference compositions for locations. Use separate images when one sheet would make details too small.

## Audio Specification

Separate five layers:

1. dialogue
2. narration
3. ambience
4. synchronized effects
5. music or no-music instruction

State spoken language and performance intent. When the user requests no generated music, say so in each consolidated clip prompt and preserve ambience and effects. Do not assume the model can generate synchronized audio; mark unsupported layers for post-production.

## Transition Design

Choose transitions motivated by shape, movement, light, sound, geography, or narrative cause:

- action match
- graphic or silhouette match
- light or color match
- object wipe
- sound bridge
- camera pass behind foreground
- cut on impact or silence
- dissolve only for time, memory, or tonal continuity

Name the outgoing and incoming visual anchors. Avoid using generic cinematic transitions without a continuity reason.

## Exclusion Design

Use exclusions to prevent concrete failures:

- identity drift, wardrobe drift, architecture drift
- warped anatomy, duplicated subjects, floating props
- illegible text, changing logos, random symbols
- camera teleportation, broken screen direction, scale jumps
- flicker, texture crawling, over-sharpening, unstable exposure
- unintended violence, unsafe acts, or protected characters

Do not write exclusions as a long fear list. Include only failures relevant to the shot or asset.

## Asset Registry Rules

- Use stable zero-padded IDs such as `CHR-001`, `LOC-003`, `PRP-012`, `FX-004`.
- One ID represents one canonical design; variants use suffixes such as `CHR-001-A`.
- List every asset call in both the shot record and asset manifest.
- Use only `planned`, `prompt-only`, `generating`, `done`, `deferred`, or `cancelled` as status values.
- Never mark an item `done` unless the file exists and has been visually inspected.
