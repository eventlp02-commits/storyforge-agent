# Verified Clip Loop

## Contents

- Story route versus executable Clip
- Clip state machine
- Director Card
- Actual end-state inspection
- Continuation gate
- Action continuity
- Camera, light, and sound continuity

## Story Route Versus Executable Clip

The Story Route may describe the full project's ordered dramatic or communication beats. Keep it flexible:

```text
Clip 01 job: establish the threat.
Clip 02 job: reveal the hidden cost.
Clip 03 job: force the irreversible choice.
```

Do not prewrite future Clip actions, camera paths, local time intervals, or generation prompts. Real output may change the usable starting state.

## Clip State Machine

Use:

```text
planned
  -> directing
  -> prompt_ready
  -> waiting_for_result
  -> inspecting
  -> end_locked
  -> completed
```

Use `needs_revision`, `result_unreadable`, or `cancelled` when needed.

Clip 01 may enter `directing` from the opening brief. Clip N+1 may enter `directing` only after Clip N is `end_locked` or `completed`.

## Director Card

Before writing a prompt, answer four questions internally:

1. Scene job: What changes, becomes known, is felt, is demonstrated, or is decided?
2. Camera strategy: Which framing, position, movement, reveal, and blocking make that job visible?
3. Lighting strategy: How do time, direction, hardness, color, and change support the job?
4. Sound strategy: How do ambience, synchronized effects, dialogue, silence, and music support the job?

Use this internal structure:

```json
{
  "clip_id": "CLIP-01",
  "scene_job": "reveal",
  "scene_intent": "",
  "camera_strategy": "",
  "lighting_strategy": "",
  "sound_strategy": "",
  "start_state": {},
  "target_end_state": {},
  "continuity_risks": []
}
```

Do not paste this card into copy-ready prompt files.

## Actual End-State Inspection

Inspect the real result after generation. Choose the final stable frame that can support a continuation, not necessarily the encoded file's last corrupted or transitional frame.

Record:

```json
{
  "clip_id": "CLIP-01",
  "actual_duration_s": 0,
  "last_stable_frame_s": 0,
  "subjects": [
    {
      "name": "",
      "identity_state": "",
      "screen_position": "",
      "pose": "",
      "gaze": "",
      "expression": "",
      "movement_direction": "",
      "action_phase": ""
    }
  ],
  "camera": {
    "framing": "",
    "position": "",
    "height": "",
    "angle": "",
    "movement_tail": "",
    "screen_direction": ""
  },
  "lighting": {
    "time_state": "",
    "key_direction": "",
    "hardness": "",
    "contrast": "",
    "color_state": ""
  },
  "environment": {
    "location_state": "",
    "weather_or_atmosphere": "",
    "moving_elements": ""
  },
  "props_and_effects": [],
  "audio_tail": {
    "ambience": "",
    "synchronized_effect": "",
    "dialogue_tail": "",
    "music_state": ""
  },
  "deviations_from_plan": []
}
```

If video inspection tools are available:

1. Read exact duration and stream information.
2. Extract several frames from the final seconds.
3. Inspect the frames at readable resolution.
4. Use audio inspection or transcription when it affects the continuation.
5. Record evidence before directing the next Clip.

If the result is unavailable or unreadable, set `result_unreadable` or `waiting_for_result`. Do not infer a convenient ending.

## Continuation Gate

Before creating Clip N+1, verify:

- Clip N has a real result.
- Clip N has an actual end-state record.
- Clip N status is `end_locked` or `completed`.
- Clip N+1 start state matches the actual end state.
- Any intended discontinuity is visible and motivated.

Fail closed: missing evidence blocks the next executable prompt.

## Action Continuity

Track action by phase:

```text
anticipation -> initiation -> travel -> contact -> reaction -> recovery -> consequence
```

Examples:

- If a sword swing ends at `contact`, the next Clip starts with `reaction` or `recovery`, not another full wind-up.
- If a character has completed a turn, the next Clip begins facing the new direction.
- If a door is already open, the next Clip shows entry or consequence rather than reopening it.
- If a character has fallen out of frame, do not restore the standing pose without showing the recovery.

Identity should remain stable. Pose and action should change.

## Camera Continuity

Carry forward:

- subject screen position and look direction
- camera side of the action axis
- framing and camera height
- movement direction and speed at the outgoing tail
- foreground occlusion and spatial landmarks

Change these only through a visible camera move, motivated cut, or clear new angle.

## Lighting Continuity

Carry forward:

- time of day
- key-light direction
- shadow hardness
- exposure and contrast
- dominant color relationship
- active practical lights and effects

Show the cause of a major change such as a door opening, spell ignition, cloud cover, explosion, or time transition.

## Sound Continuity

Carry forward or deliberately cut:

- ambience bed
- movement and impact tail
- dialogue breath and final syllable
- ringing, reverberation, machinery, wind, rain, or crowd state
- music phrase, pulse, or silence

Use sound bridges to support continuous space. Use abrupt silence only when it has a dramatic purpose.
